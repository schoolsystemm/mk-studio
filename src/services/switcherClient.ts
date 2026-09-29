/**
 * MK VISION - WebSocket Switcher Client
 * Single Authoritative Universal State Replicator & Command Dispatcher
 * By Melton Konchella
 */

import {
  SwitcherSessionState,
  SwitcherCommand,
  ServerMessage,
  ClientMessage,
  SessionMember,
  AudioTelemetryUpdate,
} from '../types/switcher.js';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'revoked';

export interface SwitcherClientListeners {
  onStateUpdate: (state: SwitcherSessionState) => void;
  onAudioTelemetry: (telemetry: AudioTelemetryUpdate) => void;
  onMembersUpdate: (members: SessionMember[]) => void;
  onConnectionStatusChange: (status: ConnectionStatus) => void;
  onDeviceRevoked: (reason: string) => void;
  onError: (error: string) => void;
}

export class SwitcherClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private deviceId: string;
  private userId: string;
  private userName: string;
  private deviceName: string;
  private deviceType: string;
  private role: 'owner' | 'operator' | 'observer';
  private token?: string;
  private listeners: SwitcherClientListeners;

  private currentVersion = 0;
  private isIntentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    config: {
      sessionId: string;
      deviceId: string;
      userId: string;
      userName: string;
      deviceName: string;
      deviceType: string;
      role?: 'owner' | 'operator' | 'observer';
      token?: string;
    },
    listeners: SwitcherClientListeners
  ) {
    this.sessionId = config.sessionId;
    this.deviceId = config.deviceId;
    this.userId = config.userId;
    this.userName = config.userName;
    this.deviceName = config.deviceName;
    this.deviceType = config.deviceType;
    this.role = config.role || 'operator';
    this.token = config.token;
    this.listeners = listeners;
  }

  public updateSession(sessionId: string, role?: 'owner' | 'operator' | 'observer') {
    this.sessionId = sessionId;
    if (role) this.role = role;
    this.currentVersion = 0;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJoinMessage();
    } else {
      this.connect();
    }
  }

  public connect() {
    this.isIntentionalClose = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

      this.listeners.onConnectionStatusChange(this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected');
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[MK VISION CLIENT] WebSocket connected to central switcher engine');
        this.reconnectAttempts = 0;
        this.listeners.onConnectionStatusChange('connected');
        this.sendJoinMessage();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[MK VISION CLIENT] Error handling message:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopPing();
        if (!this.isIntentionalClose) {
          this.listeners.onConnectionStatusChange('reconnecting');
          this.scheduleReconnect();
        } else {
          this.listeners.onConnectionStatusChange('disconnected');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[MK VISION CLIENT] WebSocket error:', err);
      };
    } catch (err: any) {
      console.error('[MK VISION CLIENT] Connect failed:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.isIntentionalClose = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.onConnectionStatusChange('disconnected');
  }

  private sendJoinMessage() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const joinMsg = {
      type: 'JOIN_SESSION',
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      userId: this.userId,
      userName: this.userName,
      deviceName: this.deviceName,
      deviceType: this.deviceType,
      role: this.role,
      token: this.token,
    };
    this.ws.send(JSON.stringify(joinMsg));
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'STATE_UPDATE': {
        if (!msg.state) return;
        // RULE 24: Version Control - ignore stale state packets
        if (msg.state.version < this.currentVersion) {
          console.warn(`[MK VISION] Ignored stale state version ${msg.state.version} (current: ${this.currentVersion})`);
          return;
        }
        this.currentVersion = msg.state.version;
        this.listeners.onStateUpdate(msg.state);
        break;
      }

      case 'AUDIO_TELEMETRY': {
        if (msg.telemetry) {
          this.listeners.onAudioTelemetry(msg.telemetry);
        }
        break;
      }

      case 'MEMBERS_UPDATE': {
        if (msg.members) {
          this.listeners.onMembersUpdate(msg.members);
        }
        break;
      }

      case 'DEVICE_REVOKED': {
        this.listeners.onConnectionStatusChange('revoked');
        this.listeners.onDeviceRevoked(msg.reason || 'This device has been revoked.');
        this.disconnect();
        break;
      }

      case 'ERROR': {
        this.listeners.onError(msg.reason || 'Unknown error');
        break;
      }
    }
  }

  public sendCommand(type: SwitcherCommand['type'], payload?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[MK VISION] Cannot send command: socket not connected');
      return;
    }

    const command: SwitcherCommand = {
      eventId: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      version: this.currentVersion,
      type,
      payload,
    };

    const clientMsg: ClientMessage = {
      type: 'COMMAND',
      command,
    };

    this.ws.send(JSON.stringify(clientMsg));
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectTimer = setTimeout(() => {
      console.log(`[MK VISION CLIENT] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
