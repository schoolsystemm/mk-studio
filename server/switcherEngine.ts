/**
 * MK VISION - Central Switcher Engine
 * Single Authoritative State, Transition Locking, and Multi-Device Realtime Broadcast
 * By Melton Konchella
 */

import { WebSocket } from 'ws';
import {
  SwitcherSessionState,
  SwitcherCommand,
  ServerMessage,
  ClientMessage,
  SessionMember,
  AudioTelemetryUpdate,
} from '../src/types/switcher.js';
import { storage } from './storage.js';
import { ObsManager } from './obsManager.js';

interface ConnectedClient {
  ws: WebSocket;
  deviceId: string;
  userId: string;
  userName: string;
  deviceName: string;
  deviceType: any;
  role: 'owner' | 'operator' | 'observer';
  sessionId: string;
  lastPing: number;
}

export class SwitcherEngine {
  private clients = new Map<WebSocket, ConnectedClient>();
  private sessionEngines = new Map<string, SessionRuntime>();
  private telemetryInterval: NodeJS.Timeout | null = null;
  private processedEventIds = new Set<string>();

  constructor() {
    this.startTelemetryLoop();
  }

  public registerClient(
    ws: WebSocket,
    sessionMember: {
      deviceId: string;
      userId: string;
      userName: string;
      deviceName: string;
      deviceType: any;
      role: 'owner' | 'operator' | 'observer';
      sessionId: string;
    }
  ) {
    const client: ConnectedClient = {
      ws,
      ...sessionMember,
      lastPing: Date.now(),
    };
    this.clients.set(ws, client);

    // Update storage presence
    storage.updateDeviceActivity(client.deviceId, true, client.sessionId);
    storage.addOrUpdateSessionMember(client.sessionId, {
      deviceId: client.deviceId,
      userId: client.userId,
      userName: client.userName,
      deviceName: client.deviceName,
      deviceType: client.deviceType,
      role: client.role,
      joinedAt: new Date().toISOString(),
      isOnline: true,
    });

    // Ensure session runtime exists
    this.getOrCreateSessionRuntime(client.sessionId);

    // Send full current state to newly joined client
    const state = storage.getSession(client.sessionId);
    if (state) {
      this.sendToClient(ws, {
        type: 'STATE_UPDATE',
        sessionId: client.sessionId,
        state,
        version: state.version,
      });
    }

    // Broadcast updated member presence
    this.broadcastMembers(client.sessionId);

    console.log(`[MK VISION ENGINE] Device registered: "${client.deviceName}" (${client.role}) in session ${client.sessionId}`);
  }

  public unregisterClient(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    this.clients.delete(ws);
    storage.updateDeviceActivity(client.deviceId, false);
    storage.removeSessionMember(client.sessionId, client.deviceId);

    // Broadcast updated member list
    this.broadcastMembers(client.sessionId);
    console.log(`[MK VISION ENGINE] Device disconnected: "${client.deviceName}" from session ${client.sessionId}`);
  }

  public handleClientMessage(ws: WebSocket, rawMessage: string) {
    try {
      const msg = JSON.parse(rawMessage) as ClientMessage;
      const client = this.clients.get(ws);

      if (msg.type === 'PING') {
        if (client) client.lastPing = Date.now();
        return;
      }

      if (msg.type === 'REQUEST_STATE' && client) {
        const state = storage.getSession(client.sessionId);
        if (state) {
          this.sendToClient(ws, {
            type: 'STATE_UPDATE',
            sessionId: client.sessionId,
            state,
            version: state.version,
          });
        }
        return;
      }

      if (msg.type === 'COMMAND' && msg.command && client) {
        this.processCommand(client, msg.command);
      }
    } catch (err) {
      console.error('[MK VISION ENGINE] Error parsing client message:', err);
    }
  }

  public processCommand(client: ConnectedClient, cmd: SwitcherCommand) {
    // 1. Check device revocation
    const dev = storage.getDeviceById(client.deviceId);
    if (!dev || dev.isRevoked) {
      this.sendToClient(client.ws, {
        type: 'DEVICE_REVOKED',
        reason: 'This device has been revoked by the production owner.',
      });
      client.ws.close();
      return;
    }

    // 2. Role permission check (Observer is strictly read-only)
    if (client.role === 'observer') {
      this.sendToClient(client.ws, {
        type: 'COMMAND_REJECT',
        eventId: cmd.eventId,
        reason: 'Observer role does not have switcher control permissions.',
      });
      return;
    }

    // 3. Prevent duplicate event execution
    if (this.processedEventIds.has(cmd.eventId)) {
      console.warn(`[MK VISION ENGINE] Duplicate event ID ignored: ${cmd.eventId}`);
      return;
    }
    this.processedEventIds.add(cmd.eventId);
    if (this.processedEventIds.size > 2000) {
      // Keep cache bounded
      const it = this.processedEventIds.values();
      for (let i = 0; i < 500; i++) {
        this.processedEventIds.delete(it.next().value!);
      }
    }

    const runtime = this.getOrCreateSessionRuntime(client.sessionId);
    runtime.handleCommand(client, cmd);
  }

  public revokeDevice(deviceId: string) {
    storage.revokeDevice(deviceId);
    // Find any connected sockets for this device and terminate
    for (const [ws, client] of this.clients.entries()) {
      if (client.deviceId === deviceId) {
        this.sendToClient(ws, {
          type: 'DEVICE_REVOKED',
          reason: 'This device was revoked by the production owner.',
        });
        ws.close();
        this.clients.delete(ws);
      }
    }
  }

  public broadcastToSession(sessionId: string, message: ServerMessage) {
    const raw = JSON.stringify(message);
    for (const [ws, client] of this.clients.entries()) {
      if (client.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  private broadcastMembers(sessionId: string) {
    const members = storage.getSessionMembers(sessionId);
    this.broadcastToSession(sessionId, {
      type: 'MEMBERS_UPDATE',
      sessionId,
      members,
    });
  }

  private sendToClient(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private getOrCreateSessionRuntime(sessionId: string): SessionRuntime {
    let runtime = this.sessionEngines.get(sessionId);
    if (!runtime) {
      runtime = new SessionRuntime(sessionId, this);
      this.sessionEngines.set(sessionId, runtime);
    }
    return runtime;
  }

  private startTelemetryLoop() {
    // 15 fps telemetry loop for audio PPM meters and live stats
    this.telemetryInterval = setInterval(() => {
      for (const runtime of this.sessionEngines.values()) {
        runtime.tickTelemetry();
      }
    }, 66);
  }
}

/**
 * SessionRuntime: Authoritative state machine for one production session
 */
export class SessionRuntime {
  private sessionId: string;
  private engine: SwitcherEngine;
  private obsManager: ObsManager;
  private transitionTimer: NodeJS.Timeout | null = null;
  private simTime = 0;
  private liveInputMeters = new Map<string, number>();

  constructor(sessionId: string, engine: SwitcherEngine) {
    this.sessionId = sessionId;
    this.engine = engine;

    this.obsManager = new ObsManager({
      onProgramChange: (sceneName) => this.handleObsProgramChange(sceneName),
      onPreviewChange: (sceneName) => this.handleObsPreviewChange(sceneName),
      onStudioModeChange: (enabled) => this.handleObsStudioModeChange(enabled),
      onTransitionStarted: () => this.handleObsTransitionStarted(),
      onTransitionEnded: () => this.handleObsTransitionEnded(),
      onStreamStateChange: (active, dur, kbps) => this.handleObsStreamState(active, dur, kbps),
      onRecordStateChange: (active, paused, dur) => this.handleObsRecordState(active, paused, dur),
      onInputVolumeChange: (name, db, mul) => this.handleObsVolumeChange(name, db, mul),
      onInputMuteChange: (name, muted) => this.handleObsMuteChange(name, muted),
      onInputMeters: (levels) => this.handleObsMeters(levels),
      onSceneList: (scenes) => this.handleObsSceneList(scenes),
      onConnectionChange: (connected, error) => this.handleObsConnectionChange(connected, error),
    });
  }

  public getState(): SwitcherSessionState | undefined {
    return storage.getSession(this.sessionId);
  }

  public handleCommand(client: ConnectedClient, cmd: SwitcherCommand) {
    const state = storage.getSession(this.sessionId);
    if (!state) return;

    switch (cmd.type) {
      case 'SET_PREVIEW': {
        const sceneId = cmd.payload?.sceneId;
        if (!sceneId || sceneId === state.previewSceneId) return;

        this.updateState((s) => {
          s.previewSceneId = sceneId;
          return s;
        });

        // Trigger OBS if connected
        if (state.obsConnected) {
          const cam = state.cameraSources.find((c) => c.id === sceneId);
          if (cam) {
            this.obsManager.setPreviewScene(cam.obsSceneName);
          }
        }
        break;
      }

      case 'SET_PROGRAM': {
        const sceneId = cmd.payload?.sceneId;
        if (!sceneId || sceneId === state.programSceneId) return;

        this.updateState((s) => {
          s.programSceneId = sceneId;
          return s;
        });

        if (state.obsConnected) {
          const cam = state.cameraSources.find((c) => c.id === sceneId);
          if (cam) {
            this.obsManager.setProgramScene(cam.obsSceneName);
          }
        }
        break;
      }

      case 'CUT': {
        // Multi-device transition lock protection!
        if (state.isTransitioning) {
          console.log(`[MK VISION] CUT rejected for ${client.deviceName}: transition already in progress`);
          return;
        }

        const oldProgram = state.programSceneId;
        const newProgram = state.previewSceneId;
        const newPreview = oldProgram; // Standard broadcast flip-flop bus

        // Immediately update authoritative state
        this.updateState((s) => {
          s.programSceneId = newProgram;
          s.previewSceneId = newPreview;
          s.transitionProgress = 0;
          return s;
        });

        // Audio Follow Video check
        if (state.audioFollowVideo) {
          this.handleAudioFollowVideo(newProgram);
        }

        // Trigger OBS Cut
        if (state.obsConnected) {
          this.obsManager.cut();
        }
        break;
      }

      case 'AUTO_TAKE': {
        // Multi-device transition lock protection!
        if (state.isTransitioning) {
          console.log(`[MK VISION] AUTO TAKE rejected for ${client.deviceName}: transition in progress`);
          return;
        }

        const duration = cmd.payload?.duration || state.transitionDuration || 300;
        const oldProgram = state.programSceneId;
        const newProgram = state.previewSceneId;
        const newPreview = oldProgram;

        // Mark transition as active across all devices
        this.updateState((s) => {
          s.isTransitioning = true;
          s.transitionProgress = 0;
          s.transitionDuration = duration;
          return s;
        });

        // Trigger OBS transition
        if (state.obsConnected) {
          this.obsManager.autoTake(state.transitionType, duration);
        }

        // Animate progress and complete
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1.0, elapsed / duration);

          if (progress >= 1.0) {
            clearInterval(interval);
            this.updateState((s) => {
              s.programSceneId = newProgram;
              s.previewSceneId = newPreview;
              s.isTransitioning = false;
              s.transitionProgress = 0;
              return s;
            });

            if (state.audioFollowVideo) {
              this.handleAudioFollowVideo(newProgram);
            }
          } else {
            this.updateState((s) => {
              s.transitionProgress = progress;
              return s;
            }, false); // don't persist every micro-frame to disk, but broadcast
          }
        }, 33);
        break;
      }

      case 'SET_TBAR': {
        const progress = Math.max(0, Math.min(1, Number(cmd.payload?.progress) || 0));

        if (progress >= 0.98) {
          // Flip-flop transition completes at end of fader travel
          const oldProgram = state.programSceneId;
          const newProgram = state.previewSceneId;
          this.updateState((s) => {
            s.programSceneId = newProgram;
            s.previewSceneId = oldProgram;
            s.transitionProgress = 0;
            s.isTransitioning = false;
            return s;
          });

          if (state.obsConnected) {
            this.obsManager.setTBarPosition(1.0);
          }
        } else {
          this.updateState((s) => {
            s.transitionProgress = progress;
            s.isTransitioning = progress > 0.02;
            return s;
          }, false);

          if (state.obsConnected) {
            this.obsManager.setTBarPosition(progress);
          }
        }
        break;
      }

      case 'TOGGLE_DSK': {
        const target = cmd.payload?.active !== undefined ? !!cmd.payload.active : !state.dskActive;
        this.updateState((s) => {
          s.dskActive = target;
          return s;
        });
        if (state.obsConnected) {
          this.obsManager.setDskActive(state.dskSourceName, target);
        }
        break;
      }

      case 'SET_AUDIO_VOLUME': {
        const { channelId, db, multiplier } = cmd.payload || {};
        this.updateState((s) => {
          const ch = s.audioChannels.find((c) => c.id === channelId);
          if (ch) {
            if (db !== undefined) ch.db = Math.max(-60, Math.min(6, db));
            if (multiplier !== undefined) ch.volumeMultiplier = Math.max(0, Math.min(1, multiplier));
          }
          return s;
        });

        if (state.obsConnected) {
          const ch = state.audioChannels.find((c) => c.id === channelId);
          if (ch && ch.obsSourceName) {
            this.obsManager.setInputVolume(ch.obsSourceName, ch.db);
          }
        }
        break;
      }

      case 'TOGGLE_AUDIO_MUTE': {
        const { channelId, muted } = cmd.payload || {};
        let finalMuted = false;
        this.updateState((s) => {
          const ch = s.audioChannels.find((c) => c.id === channelId);
          if (ch) {
            ch.isMuted = muted !== undefined ? !!muted : !ch.isMuted;
            finalMuted = ch.isMuted;
          }
          return s;
        });

        if (state.obsConnected) {
          const ch = state.audioChannels.find((c) => c.id === channelId);
          if (ch && ch.obsSourceName) {
            this.obsManager.setInputMute(ch.obsSourceName, finalMuted);
          }
        }
        break;
      }

      case 'SET_MASTER_VOLUME': {
        const { db, multiplier } = cmd.payload || {};
        this.updateState((s) => {
          if (db !== undefined) s.masterAudio.db = Math.max(-60, Math.min(6, db));
          if (multiplier !== undefined) s.masterAudio.volumeMultiplier = Math.max(0, Math.min(1, multiplier));
          return s;
        });
        break;
      }

      case 'TOGGLE_MASTER_MUTE': {
        const { muted } = cmd.payload || {};
        this.updateState((s) => {
          s.masterAudio.isMuted = muted !== undefined ? !!muted : !s.masterAudio.isMuted;
          return s;
        });
        break;
      }

      case 'TOGGLE_AFV': {
        this.updateState((s) => {
          s.audioFollowVideo = !s.audioFollowVideo;
          return s;
        });
        break;
      }

      case 'TOGGLE_STREAM': {
        if (state.obsConnected) {
          this.obsManager.toggleStream();
        } else {
          // Demo simulation
          this.updateState((s) => {
            s.streamState.isStreaming = !s.streamState.isStreaming;
            s.streamState.durationSec = s.streamState.isStreaming ? 1 : 0;
            return s;
          });
        }
        break;
      }

      case 'TOGGLE_RECORD': {
        if (state.obsConnected) {
          this.obsManager.toggleRecord();
        } else {
          // Demo simulation
          this.updateState((s) => {
            s.recordingState.isRecording = !s.recordingState.isRecording;
            s.recordingState.durationSec = s.recordingState.isRecording ? 1 : 0;
            return s;
          });
        }
        break;
      }

      case 'CONNECT_OBS': {
        const { host, port, password } = cmd.payload || {};
        const targetHost = host || state.obsHost;
        const targetPort = Number(port) || state.obsPort;
        this.updateState((s) => {
          s.obsHost = targetHost;
          s.obsPort = targetPort;
          s.obsIsConnecting = true;
          s.obsConnectionError = undefined;
          return s;
        });
        this.obsManager.connect(targetHost, targetPort, password).then((res) => {
          if (!res.success) {
            this.updateState((s) => {
              s.obsConnected = false;
              s.obsIsConnecting = false;
              s.obsConnectionError = res.message || 'Connection failed';
              return s;
            });
          }
        }).catch((err) => {
          const msg = err?.message || String(err);
          this.updateState((s) => {
            s.obsConnected = false;
            s.obsIsConnecting = false;
            s.obsConnectionError = msg;
            return s;
          });
        });
        break;
      }

      case 'DISCONNECT_OBS': {
        this.obsManager.disconnect();
        this.updateState((s) => {
          s.obsConnected = false;
          s.obsIsConnecting = false;
          s.obsConnectionError = undefined;
          return s;
        });
        break;
      }

      case 'CLEAR_OBS_ERROR': {
        this.updateState((s) => {
          s.obsConnectionError = undefined;
          s.obsIsConnecting = false;
          return s;
        });
        break;
      }

      case 'SET_CAMERA_MAPPING': {
        const sources = cmd.payload?.cameraSources;
        if (Array.isArray(sources)) {
          this.updateState((s) => {
            s.cameraSources = sources;
            return s;
          });
        }
        break;
      }
    }
  }

  private handleAudioFollowVideo(newProgramCamId: string) {
    this.updateState((s) => {
      for (const ch of s.audioChannels) {
        if (ch.id.startsWith('cam')) {
          ch.isMuted = ch.id !== newProgramCamId;
        }
      }
      return s;
    });
  }

  private updateState(updater: (s: SwitcherSessionState) => SwitcherSessionState, shouldSave = true): SwitcherSessionState {
    let updated: SwitcherSessionState | undefined;
    if (shouldSave) {
      updated = storage.updateSessionState(this.sessionId, (s) => {
        s.version++;
        return updater(s);
      });
    } else {
      const current = storage.getSession(this.sessionId);
      if (current) {
        current.version++;
        current.updatedAt = new Date().toISOString();
        updated = updater(current);
      }
    }

    if (updated) {
      this.engine.broadcastToSession(this.sessionId, {
        type: 'STATE_UPDATE',
        sessionId: this.sessionId,
        state: updated,
        version: updated.version,
      });
      return updated;
    }
    return storage.getSession(this.sessionId)!;
  }

  // Telemetry loop for PPM audio meters & live elapsed stream/rec timers
  public tickTelemetry() {
    const state = storage.getSession(this.sessionId);
    if (!state) return;

    this.simTime += 0.066;

    // Increment live stream/rec timers if active
    if (state.streamState.isStreaming && Math.floor(this.simTime) % 1 === 0) {
      state.streamState.durationSec++;
    }
    if (state.recordingState.isRecording && Math.floor(this.simTime) % 1 === 0) {
      state.recordingState.durationSec++;
    }

    // Audio meter calculation
    const channelLevels: { id: string; peak: number; isClipping: boolean }[] = [];
    let masterPower = 0;

    for (let i = 0; i < state.audioChannels.length; i++) {
      const ch = state.audioChannels[i];
      let peakDb = -60;

      if (!ch.isMuted && state.obsConnected) {
        const realLevel = ch.obsSourceName
          ? this.liveInputMeters.get(ch.obsSourceName) ?? this.liveInputMeters.get(ch.name)
          : undefined;
        if (realLevel !== undefined) {
          peakDb = Math.max(-60, Math.min(3, realLevel));
        }
      }

      const isClipping = peakDb > 0.0;
      ch.peak = peakDb;
      ch.isClipping = isClipping;

      channelLevels.push({
        id: ch.id,
        peak: peakDb,
        isClipping,
      });

      if (!ch.isMuted && peakDb > -50) {
        masterPower += Math.pow(10, peakDb / 10);
      }
    }

    // Master Meter calculation (logarithmic summation of active channels)
    let masterPeakDb = -60;
    if (!state.masterAudio.isMuted && masterPower > 0) {
      const sumDb = 10 * Math.log10(masterPower);
      masterPeakDb = Math.max(-60, Math.min(3, sumDb + state.masterAudio.db));
    }
    state.masterAudio.peak = masterPeakDb;
    state.masterAudio.isClipping = masterPeakDb > 0.0;

    // Send high-frequency lightweight telemetry packet
    const telemetry: AudioTelemetryUpdate = {
      type: 'AUDIO_TELEMETRY',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      channels: channelLevels,
      master: {
        peak: masterPeakDb,
        isClipping: state.masterAudio.isClipping,
      },
    };

    this.engine.broadcastToSession(this.sessionId, {
      type: 'AUDIO_TELEMETRY',
      sessionId: this.sessionId,
      telemetry,
    });
  }

  // OBS Callbacks
  private handleObsProgramChange(sceneName: string) {
    const state = storage.getSession(this.sessionId);
    if (!state) return;
    const match = state.cameraSources.find((c) => c.obsSceneName === sceneName);
    if (match && match.id !== state.programSceneId) {
      this.updateState((s) => {
        s.programSceneId = match.id;
        return s;
      });
    }
  }

  private handleObsPreviewChange(sceneName: string) {
    const state = storage.getSession(this.sessionId);
    if (!state) return;
    const match = state.cameraSources.find((c) => c.obsSceneName === sceneName);
    if (match && match.id !== state.previewSceneId) {
      this.updateState((s) => {
        s.previewSceneId = match.id;
        return s;
      });
    }
  }

  private handleObsStudioModeChange(enabled: boolean) {
    this.updateState((s) => {
      s.studioModeActive = enabled;
      return s;
    });
  }

  private handleObsTransitionStarted() {
    this.updateState((s) => {
      s.isTransitioning = true;
      return s;
    });
  }

  private handleObsTransitionEnded() {
    this.updateState((s) => {
      s.isTransitioning = false;
      s.transitionProgress = 0;
      return s;
    });
  }

  private handleObsStreamState(isStreaming: boolean, durationSec: number, kbitsPerSec?: number) {
    this.updateState((s) => {
      s.streamState.isStreaming = isStreaming;
      if (kbitsPerSec !== undefined) s.streamState.kbitsPerSec = kbitsPerSec;
      return s;
    });
  }

  private handleObsRecordState(isRecording: boolean, isPaused: boolean, durationSec: number) {
    this.updateState((s) => {
      s.recordingState.isRecording = isRecording;
      s.recordingState.isPaused = isPaused;
      return s;
    });
  }

  private handleObsVolumeChange(inputName: string, db: number, mul: number) {
    this.updateState((s) => {
      const ch = s.audioChannels.find((c) => c.obsSourceName === inputName);
      if (ch) {
        ch.db = db;
        ch.volumeMultiplier = mul;
      }
      return s;
    });
  }

  private handleObsMuteChange(inputName: string, muted: boolean) {
    this.updateState((s) => {
      const ch = s.audioChannels.find((c) => c.obsSourceName === inputName);
      if (ch) {
        ch.isMuted = muted;
      }
      return s;
    });
  }

  private handleObsMeters(levels: { inputName: string; peak: number }[]) {
    for (const lvl of levels) {
      this.liveInputMeters.set(lvl.inputName, lvl.peak);
    }
  }

  private handleObsSceneList(scenes: string[]) {
    const state = storage.getSession(this.sessionId);
    if (!state || scenes.length === 0) return;
    this.updateState((s) => {
      scenes.slice(0, 8).forEach((sceneName, idx) => {
        if (s.cameraSources[idx]) {
          s.cameraSources[idx].obsSceneName = sceneName;
          s.cameraSources[idx].description = sceneName;
        }
      });
      return s;
    });
    console.log(`[MK VISION] Synced ${scenes.length} real OBS scenes to Switcher Camera cross-points.`);
  }

  private handleObsConnectionChange(connected: boolean, error?: string) {
    this.updateState((s) => {
      s.obsConnected = connected;
      s.obsIsConnecting = false;
      if (connected) {
        s.obsConnectionError = undefined;
      } else if (error) {
        s.obsConnectionError = error;
      }
      return s;
    });
    console.log(`[MK VISION] OBS Connection changed for session ${this.sessionId}: connected=${connected}${error ? ` (${error})` : ''}`);
  }
}
