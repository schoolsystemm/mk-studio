/**
 * MK VISION - Professional Digital Production Switcher
 * Universal Authoritative State and Protocol Definitions
 * By Melton Konchella
 */

export type UserRole = 'owner' | 'operator' | 'observer';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  type: 'windows' | 'android' | 'ios' | 'tablet' | 'mac' | 'other';
  registeredAt: string;
  lastActive: string;
  isOnline: boolean;
  isRevoked: boolean;
  currentSessionId: string | null;
  userAgent?: string;
}

export interface SessionMember {
  deviceId: string;
  userId: string;
  userName: string;
  deviceName: string;
  deviceType: Device['type'];
  role: UserRole;
  joinedAt: string;
  isOnline: boolean;
}

export interface AudioChannelState {
  id: string; // 'cam1' | 'cam2' | ... | 'cam8' | 'mic1' | 'music'
  name: string;
  db: number; // -60 to +6
  volumeMultiplier: number; // 0.0 to 1.0
  isMuted: boolean;
  peak: number; // -60 to +6 dB
  isClipping: boolean;
  obsSourceName?: string;
}

export interface MasterAudioState {
  db: number;
  volumeMultiplier: number;
  isMuted: boolean;
  peak: number;
  isClipping: boolean;
}

export interface StreamState {
  isStreaming: boolean;
  durationSec: number;
  kbitsPerSec?: number;
  fps?: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
}

export interface CameraSourceInfo {
  id: string; // 'cam1' .. 'cam8'
  label: string;
  obsSceneName: string;
  description: string;
  color: string;
}

export interface SwitcherSessionState {
  sessionId: string;
  sessionName: string;
  ownerId: string;

  // Video Switcher Buses
  programSceneId: string; // e.g. 'cam1'
  previewSceneId: string; // e.g. 'cam2'

  // Transitions
  transitionType: 'Cut' | 'Fade' | 'Slide' | 'Wipe' | 'Stinger';
  transitionDuration: number; // milliseconds (e.g. 300)
  transitionProgress: number; // 0.0 to 1.0 for T-Bar
  isTransitioning: boolean;

  // DSK (Downstream Keyer)
  dskActive: boolean;
  dskSourceName: string;

  // Audio System
  audioFollowVideo: boolean;
  audioChannels: AudioChannelState[];
  masterAudio: MasterAudioState;

  // Broadcast Telemetry
  streamState: StreamState;
  recordingState: RecordingState;

  // Camera Mappings
  cameraSources: CameraSourceInfo[];

  // OBS Engine Link
  obsConnected: boolean;
  obsHost: string;
  obsPort: number;
  studioModeActive: boolean;
  obsConnectionError?: string;
  obsIsConnecting?: boolean;

  // Authoritative Versioning
  version: number;
  updatedAt: string;
}

export interface SwitcherCommand {
  eventId: string;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  version?: number;
  type:
    | 'SET_PROGRAM'
    | 'SET_PREVIEW'
    | 'CUT'
    | 'AUTO_TAKE'
    | 'SET_TBAR'
    | 'TOGGLE_DSK'
    | 'SET_AUDIO_VOLUME'
    | 'TOGGLE_AUDIO_MUTE'
    | 'SET_MASTER_VOLUME'
    | 'TOGGLE_MASTER_MUTE'
    | 'TOGGLE_AFV'
    | 'TOGGLE_STREAM'
    | 'TOGGLE_RECORD'
    | 'CONNECT_OBS'
    | 'DISCONNECT_OBS'
    | 'CLEAR_OBS_ERROR'
    | 'SET_CAMERA_MAPPING';
  payload?: any;
}

export interface AudioTelemetryUpdate {
  type: 'AUDIO_TELEMETRY';
  sessionId: string;
  timestamp: number;
  channels: {
    id: string;
    peak: number;
    isClipping: boolean;
  }[];
  master: {
    peak: number;
    isClipping: boolean;
  };
}

export interface ServerMessage {
  type:
    | 'STATE_UPDATE'
    | 'AUDIO_TELEMETRY'
    | 'MEMBERS_UPDATE'
    | 'COMMAND_ACK'
    | 'COMMAND_REJECT'
    | 'DEVICE_REVOKED'
    | 'ERROR'
    | 'SESSION_CLOSED';
  sessionId?: string;
  state?: SwitcherSessionState;
  telemetry?: AudioTelemetryUpdate;
  members?: SessionMember[];
  eventId?: string;
  reason?: string;
  version?: number;
}

export interface ClientMessage {
  type:
    | 'JOIN_SESSION'
    | 'LEAVE_SESSION'
    | 'COMMAND'
    | 'PING'
    | 'REQUEST_STATE';
  sessionId?: string;
  deviceId?: string;
  token?: string;
  command?: SwitcherCommand;
}
