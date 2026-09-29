/**
 * MK VISION - OBS WebSocket v5 Manager
 * Professional Hardware/Engine Adapter for OBS Studio 28+
 * By Melton Konchella
 */

import { OBSWebSocket } from 'obs-websocket-js';
import { isBridgeHost, bridgeKeyFromHost, isBridgeOnline, relayUrl } from './obsBridge.js';
import { CameraSourceInfo } from '../src/types/switcher.js';

export interface ObsCallbacks {
  onProgramChange: (sceneName: string) => void;
  onPreviewChange: (sceneName: string) => void;
  onStudioModeChange: (enabled: boolean) => void;
  onTransitionStarted: (transitionName: string) => void;
  onTransitionEnded: () => void;
  onStreamStateChange: (isStreaming: boolean, durationSec: number, kbitsPerSec?: number) => void;
  onRecordStateChange: (isRecording: boolean, isPaused: boolean, durationSec: number) => void;
  onInputVolumeChange: (inputName: string, db: number, mul: number) => void;
  onInputMuteChange: (inputName: string, muted: boolean) => void;
  onInputMeters?: (levels: { inputName: string; peak: number }[]) => void;
  onSceneList?: (scenes: string[]) => void;
  onConnectionChange: (connected: boolean, error?: string) => void;
}

export class ObsManager {
  private obs: OBSWebSocket | null = null;
  private isConnected = false;
  private host = 'localhost';
  private port = 4455;
  private password = '';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private shouldAutoReconnect = false;
  private callbacks: ObsCallbacks;

  constructor(callbacks: ObsCallbacks) {
    this.callbacks = callbacks;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async connect(host = 'localhost', port = 4455, password = ''): Promise<{ success: boolean; message?: string }> {
    this.host = host;
    this.port = port;
    this.password = password;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.obs && this.isConnected) {
        await this.disconnect();
      }

      this.obs = new OBSWebSocket();
      this.setupEventListeners();

      if (isBridgeHost(host)) {
        const key = bridgeKeyFromHost(host);
        if (!isBridgeOnline(key)) {
          throw new Error(`Bridge "${key}" is offline. On the OBS PC run: node mk-obs-bridge.mjs <APP_URL> ${key}`);
        }
        const relay = relayUrl(key, Number(process.env.PORT) || 3000);
        console.log(`[MK VISION OBS] Connecting via bridge ${key.slice(0, 3)}***...`);
        await Promise.race([
          this.obs.connect(relay, password || undefined, {
            eventSubscriptions: 0x00000001 | 0x00000004 | 0x00000008 | 0x00000040 | 0x00010000,
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Bridge connection timed out after 8000ms.')), 8000)),
        ]);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.shouldAutoReconnect = true;
        this.callbacks.onConnectionChange(true);
        await this.enforceStudioMode();
        await this.reconcileState();
        return { success: true };
      }

      let cleanHost = host.trim().replace(/^(tcp:\/\/|ws:\/\/|wss:\/\/|http:\/\/|https:\/\/)/i, '');
      // If user pasted host:port into the host field (e.g. "free.pinggy.io:41234")
      let cleanPort = Number(port);
      if (cleanHost.includes(':')) {
        const parts = cleanHost.split(':');
        cleanHost = parts[0];
        if (parts[1] && !isNaN(Number(parts[1]))) {
          cleanPort = Number(parts[1]);
        }
      }

      const isSecure = cleanPort === 443 || host.toLowerCase().startsWith('wss://') || host.toLowerCase().startsWith('https://');
      const protocol = isSecure ? 'wss://' : 'ws://';
      const address = `${protocol}${cleanHost}:${cleanPort}`;
      console.log(`[MK VISION OBS] Attempting connection to ${address}...`);

      const connectPromise = this.obs.connect(address, password || undefined, {
        eventSubscriptions: 0x00000001 | 0x00000004 | 0x00000008 | 0x00000040 | 0x00010000,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection to ${address} timed out after 5000ms. Host is unreachable or blocked by firewall.`));
        }, 5000);
      });

      await Promise.race([connectPromise, timeoutPromise]);

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.shouldAutoReconnect = true;
      console.log('[MK VISION OBS] Connected successfully to OBS Studio v5!');
      this.callbacks.onConnectionChange(true);

      // Verify and enforce Studio Mode
      await this.enforceStudioMode();

      // Query initial state
      await this.reconcileState();

      return { success: true };
    } catch (err: any) {
      if (this.obs) {
        try {
          this.obs.disconnect();
        } catch {
          // ignore
        }
        this.obs = null;
      }
      let errMsg = err?.message || String(err);
      if (
        err?.code === 4009 ||
        errMsg.toLowerCase().includes('auth') ||
        errMsg.toLowerCase().includes('password')
      ) {
        errMsg =
          'Authentication failed: The password did not match OBS Studio. In OBS, go to Tools → WebSocket Server Settings → Show Connect Info to copy your Server Password (or uncheck "Enable Authentication").';
      }
      console.log(`[MK VISION OBS] Connection failed at ${this.host}:${this.port}: ${errMsg}`);
      this.isConnected = false;
      this.shouldAutoReconnect = false;
      this.callbacks.onConnectionChange(false, errMsg);
      return { success: false, message: errMsg };
    }
  }

  async disconnect() {
    this.shouldAutoReconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.obs) {
      try {
        await this.obs.disconnect();
      } catch (err) {
        // ignore
      }
      this.obs = null;
    }
    this.isConnected = false;
    this.callbacks.onConnectionChange(false);
    console.log('[MK VISION OBS] Disconnected.');
  }

  private scheduleReconnect() {
    if (!this.shouldAutoReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[MK VISION OBS] Reconnect limit reached (${this.maxReconnectAttempts} attempts). Pausing auto-reconnect.`);
      this.shouldAutoReconnect = false;
      return;
    }
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = 5000 * this.reconnectAttempts;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.isConnected && this.shouldAutoReconnect) {
        console.log(`[MK VISION OBS] Attempting auto-reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        const res = await this.connect(this.host, this.port, this.password);
        if (!res.success && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private setupEventListeners() {
    if (!this.obs) return;

    this.obs.on('ConnectionClosed', () => {
      console.log('[MK VISION OBS] Connection closed by host');
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.callbacks.onConnectionChange(false, 'OBS connection closed');
      if (wasConnected && this.shouldAutoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.obs.on('ConnectionError', (err) => {
      console.log('[MK VISION OBS] Connection notice:', err?.message || err);
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.callbacks.onConnectionChange(false, err?.message || 'Connection error');
      if (wasConnected && this.shouldAutoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      if (data && data.sceneName) {
        this.callbacks.onProgramChange(data.sceneName);
      }
    });

    this.obs.on('CurrentPreviewSceneChanged', (data) => {
      if (data && data.sceneName) {
        this.callbacks.onPreviewChange(data.sceneName);
      }
    });

    this.obs.on('StudioModeStateChanged', (data) => {
      if (data) {
        this.callbacks.onStudioModeChange(data.studioModeEnabled);
      }
    });

    this.obs.on('SceneTransitionStarted', (data) => {
      this.callbacks.onTransitionStarted(data.transitionName);
    });

    this.obs.on('SceneTransitionEnded', () => {
      this.callbacks.onTransitionEnded();
    });

    this.obs.on('StreamStateChanged', (data) => {
      this.callbacks.onStreamStateChange(data.outputActive, 0);
    });

    this.obs.on('RecordStateChanged', (data: any) => {
      this.callbacks.onRecordStateChange(data.outputActive, data.outputPaused || false, 0);
    });

    this.obs.on('InputVolumeChanged', (data) => {
      this.callbacks.onInputVolumeChange(data.inputName, data.inputVolumeDb, data.inputVolumeMul);
    });

    this.obs.on('InputMuteStateChanged', (data) => {
      this.callbacks.onInputMuteChange(data.inputName, data.inputMuted);
    });

    this.obs.on('InputVolumeMeters', (data: any) => {
      if (data && Array.isArray(data.inputs) && this.callbacks.onInputMeters) {
        const levels = data.inputs.map((inp: any) => ({
          inputName: inp.inputName,
          peak: Array.isArray(inp.inputLevelsMul) && inp.inputLevelsMul[0]
            ? 20 * Math.log10(Math.max(inp.inputLevelsMul[0][1] || 0.0001, 0.0001))
            : -60,
        }));
        this.callbacks.onInputMeters(levels);
      }
    });
  }

  async enforceStudioMode(): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      const { studioModeEnabled } = await this.obs.call('GetStudioModeEnabled');
      if (!studioModeEnabled) {
        console.log('[MK VISION OBS] Studio Mode is OFF. Enforcing OBS Studio Mode...');
        await this.obs.call('SetStudioModeEnabled', { studioModeEnabled: true });
        this.callbacks.onStudioModeChange(true);
      } else {
        this.callbacks.onStudioModeChange(true);
      }
      return true;
    } catch (err) {
      console.warn('[MK VISION OBS] Failed to check/enable Studio Mode:', err);
      return false;
    }
  }

  async reconcileState() {
    if (!this.obs || !this.isConnected) return;
    try {
      const [prog, prev, studio] = await Promise.all([
        this.obs.call('GetCurrentProgramScene'),
        this.obs.call('GetCurrentPreviewScene'),
        this.obs.call('GetStudioModeEnabled'),
      ]);

      if (prog && prog.currentProgramSceneName) {
        this.callbacks.onProgramChange(prog.currentProgramSceneName);
      }
      if (prev && prev.currentPreviewSceneName) {
        this.callbacks.onPreviewChange(prev.currentPreviewSceneName);
      }
      if (studio) {
        this.callbacks.onStudioModeChange(studio.studioModeEnabled);
      }

      // Check stream & record status
      try {
        const streamStatus = await this.obs.call('GetStreamStatus');
        this.callbacks.onStreamStateChange(
          streamStatus.outputActive,
          streamStatus.outputTimecode ? 0 : 0,
          streamStatus.outputBytes ? ((streamStatus.outputBytes * 8) / 1000) : 0
        );
      } catch (e) {
        // ignore
      }

      try {
        const recStatus = (await this.obs.call('GetRecordStatus')) as any;
        this.callbacks.onRecordStateChange(recStatus.outputActive, recStatus.outputPaused || false, 0);
      } catch (e) {
        // ignore
      }
      // Query and notify scene list
      const scenes = await this.getSceneList();
      if (scenes.length > 0 && this.callbacks.onSceneList) {
        this.callbacks.onSceneList(scenes);
      }
    } catch (err) {
      console.warn('[MK VISION OBS] Error reconciling state:', err);
    }
  }

  async getSceneList(): Promise<string[]> {
    if (!this.obs || !this.isConnected) return [];
    try {
      const res = await this.obs.call('GetSceneList');
      return (res.scenes as any[]).map((s: any) => s.sceneName || s.name || String(s)).reverse();
    } catch (err) {
      console.warn('[MK VISION OBS] Error fetching scenes:', err);
      return [];
    }
  }

  // Switcher Cross-Point Controls
  async setPreviewScene(sceneName: string): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('SetCurrentPreviewScene', { sceneName });
      return true;
    } catch (err) {
      console.error(`[MK VISION OBS] SetCurrentPreviewScene failed for "${sceneName}":`, err);
      return false;
    }
  }

  async setProgramScene(sceneName: string): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('SetCurrentProgramScene', { sceneName });
      return true;
    } catch (err) {
      console.error(`[MK VISION OBS] SetCurrentProgramScene failed for "${sceneName}":`, err);
      return false;
    }
  }

  async cut(): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      // In OBS Studio Mode, setting transition to Cut ensures true instantaneous switch
      await this.obs.call('SetCurrentSceneTransition', { transitionName: 'Cut' }).catch(() => {});
      await this.obs.call('TriggerStudioModeTransition');
      return true;
    } catch (err) {
      console.error('[MK VISION OBS] Cut transition failed:', err);
      return false;
    }
  }

  async autoTake(transitionName?: string, durationMs?: number): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      if (transitionName && transitionName !== 'Cut') {
        await this.obs.call('SetCurrentSceneTransition', { transitionName }).catch(() => {});
      }
      if (durationMs) {
        await this.obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: durationMs }).catch(() => {});
      }
      await this.obs.call('TriggerStudioModeTransition');
      return true;
    } catch (err) {
      console.error('[MK VISION OBS] Auto Take failed:', err);
      return false;
    }
  }

  async setDskActive(sourceName: string, enabled: boolean): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      const prog = await this.obs.call('GetCurrentProgramScene');
      if (prog && prog.currentProgramSceneName) {
        const itemRes = await this.obs.call('GetSceneItemId', {
          sceneName: prog.currentProgramSceneName,
          sourceName,
        }).catch(() => null);
        if (itemRes && itemRes.sceneItemId !== undefined) {
          await this.obs.call('SetSceneItemEnabled', {
            sceneName: prog.currentProgramSceneName,
            sceneItemId: itemRes.sceneItemId,
            sceneItemEnabled: enabled,
          });
          return true;
        }
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  async setTBarPosition(position: number): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      // OBS v5 supports SetTBarPosition
      await this.obs.call('SetTBarPosition' as any, {
        position: Math.max(0, Math.min(1, position)),
        release: position >= 1.0 || position <= 0.0,
      });
      return true;
    } catch (err) {
      // Not all OBS setups support manual T-Bar if unsupported transition type
      return false;
    }
  }

  // Audio Controls
  async setInputVolume(inputName: string, db: number): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('SetInputVolume', { inputName, inputVolumeDb: db });
      return true;
    } catch (err) {
      return false;
    }
  }

  async setInputMute(inputName: string, muted: boolean): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('SetInputMute', { inputName, inputMuted: muted });
      return true;
    } catch (err) {
      return false;
    }
  }

  // Streaming / Recording
  async toggleStream(): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('ToggleStream');
      return true;
    } catch (err) {
      console.error('[MK VISION OBS] ToggleStream failed:', err);
      return false;
    }
  }

  async toggleRecord(): Promise<boolean> {
    if (!this.obs || !this.isConnected) return false;
    try {
      await this.obs.call('ToggleRecord');
      return true;
    } catch (err) {
      console.error('[MK VISION OBS] ToggleRecord failed:', err);
      return false;
    }
  }
}
