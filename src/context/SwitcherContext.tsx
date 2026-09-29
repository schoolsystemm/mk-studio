/**
 * MK VISION - React Switcher Context & State Provider
 * Provides unified authoritative state, role management, and switcher actions
 * By Melton Konchella
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  SwitcherSessionState,
  User,
  Device,
  SessionMember,
  AudioTelemetryUpdate,
  CameraSourceInfo,
  UserRole,
} from '../types/switcher.js';
import { SwitcherClient, ConnectionStatus } from '../services/switcherClient.js';

interface SwitcherContextValue {
  user: User | null;
  device: Device | null;
  userDevices: Device[];
  sessionId: string;
  sessionName: string;
  switcherState: SwitcherSessionState | null;
  audioTelemetry: AudioTelemetryUpdate | null;
  members: SessionMember[];
  connectionStatus: ConnectionStatus;
  role: UserRole;
  revocationReason: string | null;
  error: string | null;

  // Switcher actions
  setPreview: (camId: string) => void;
  setProgram: (camId: string) => void;
  cut: () => void;
  autoTake: (duration?: number) => void;
  setTBar: (progress: number) => void;
  toggleDsk: (active?: boolean) => void;
  setAudioVolume: (channelId: string, db?: number, multiplier?: number) => void;
  toggleAudioMute: (channelId: string, muted?: boolean) => void;
  setMasterVolume: (db?: number, multiplier?: number) => void;
  toggleMasterMute: () => void;
  toggleAfv: () => void;
  toggleStream: () => void;
  toggleRecord: () => void;
  connectObs: (host: string, port: number, password?: string) => void;
  disconnectObs: () => void;
  clearObsError: () => void;
  setCameraMapping: (sources: CameraSourceInfo[]) => void;

  // Management actions
  login: (email: string, password: string) => Promise<boolean>;
  registerUser: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  registerDevice: (name: string, type: Device['type']) => Promise<Device>;
  revokeDevice: (deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  createSession: (name: string) => Promise<SwitcherSessionState>;
  joinSession: (codeOrToken: string) => Promise<boolean>;
  createInviteToken: (role?: 'operator' | 'observer') => Promise<string>;
  switchSession: (sessionId: string) => void;
  clearError: () => void;
}

const SwitcherContext = createContext<SwitcherContextValue | null>(null);

function detectDeviceType(): Device['type'] {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/windows/.test(ua)) return 'windows';
  if (/macintosh|mac os x/.test(ua)) return 'mac';
  if (/tablet/.test(ua)) return 'tablet';
  return 'windows';
}

function getStoredDevice(): Device | null {
  try {
    const raw = localStorage.getItem('mk_vision_device');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return null;
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('mk_vision_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  // Default fallback user for instant testing
  return {
    id: 'usr-melton-01',
    name: 'Melton Konchella',
    email: 'konchellamelton@gmail.com',
    createdAt: new Date().toISOString(),
  };
}

export const SwitcherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [device, setDevice] = useState<Device | null>(getStoredDevice);
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [sessionId, setSessionId] = useState<string>('session-sunday-service');
  const [role, setRole] = useState<UserRole>('owner');
  const [switcherState, setSwitcherState] = useState<SwitcherSessionState | null>(null);
  const [audioTelemetry, setAudioTelemetry] = useState<AudioTelemetryUpdate | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [revocationReason, setRevocationReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SwitcherClient | null>(null);

  // Initialize or auto-register device if not present
  useEffect(() => {
    async function initDevice() {
      if (!device && user) {
        const detectedType = detectDeviceType();
        const defaultName =
          detectedType === 'android'
            ? 'Android Phone'
            : detectedType === 'ios'
            ? 'iPhone / iPad'
            : 'Windows Workstation';

        try {
          const res = await fetch('/api/devices/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              name: defaultName,
              type: detectedType,
            }),
          });
          const data = await res.json();
          if (data.device) {
            setDevice(data.device);
            localStorage.setItem('mk_vision_device', JSON.stringify(data.device));
          }
        } catch (err) {
          console.warn('Auto device registration failed:', err);
        }
      }
    }
    initDevice();
  }, [user, device]);

  // Connect WebSocket client when user and device are ready
  useEffect(() => {
    if (!device || !user) return;

    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    const client = new SwitcherClient(
      {
        sessionId,
        deviceId: device.id,
        userId: user.id,
        userName: user.name,
        deviceName: device.name,
        deviceType: device.type,
        role,
      },
      {
        onStateUpdate: (state) => {
          setSwitcherState(state);
          // If we are owner of this session, enforce role
          if (state.ownerId === user.id) {
            setRole('owner');
          }
        },
        onAudioTelemetry: (telemetry) => {
          setAudioTelemetry(telemetry);
        },
        onMembersUpdate: (mList) => {
          setMembers(mList);
        },
        onConnectionStatusChange: (status) => {
          setConnectionStatus(status);
        },
        onDeviceRevoked: (reason) => {
          setRevocationReason(reason);
          setConnectionStatus('revoked');
        },
        onError: (err) => {
          setError(err);
        },
      }
    );

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sessionId, device?.id, user?.id, role]);

  // Load user's device list
  const refreshDevices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/devices?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (data.devices) {
        setUserDevices(data.devices);
      }
    } catch (err) {
      console.warn('Failed to fetch devices:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // --- Switcher Actions ---
  const setPreview = useCallback((camId: string) => {
    clientRef.current?.sendCommand('SET_PREVIEW', { sceneId: camId });
  }, []);

  const setProgram = useCallback((camId: string) => {
    clientRef.current?.sendCommand('SET_PROGRAM', { sceneId: camId });
  }, []);

  const cut = useCallback(() => {
    clientRef.current?.sendCommand('CUT');
  }, []);

  const autoTake = useCallback((duration?: number) => {
    clientRef.current?.sendCommand('AUTO_TAKE', { duration });
  }, []);

  const setTBar = useCallback((progress: number) => {
    clientRef.current?.sendCommand('SET_TBAR', { progress });
  }, []);

  const toggleDsk = useCallback((active?: boolean) => {
    clientRef.current?.sendCommand('TOGGLE_DSK', { active });
  }, []);

  const setAudioVolume = useCallback((channelId: string, db?: number, multiplier?: number) => {
    clientRef.current?.sendCommand('SET_AUDIO_VOLUME', { channelId, db, multiplier });
  }, []);

  const toggleAudioMute = useCallback((channelId: string, muted?: boolean) => {
    clientRef.current?.sendCommand('TOGGLE_AUDIO_MUTE', { channelId, muted });
  }, []);

  const setMasterVolume = useCallback((db?: number, multiplier?: number) => {
    clientRef.current?.sendCommand('SET_MASTER_VOLUME', { db, multiplier });
  }, []);

  const toggleMasterMute = useCallback(() => {
    clientRef.current?.sendCommand('TOGGLE_MASTER_MUTE');
  }, []);

  const toggleAfv = useCallback(() => {
    clientRef.current?.sendCommand('TOGGLE_AFV');
  }, []);

  const toggleStream = useCallback(() => {
    clientRef.current?.sendCommand('TOGGLE_STREAM');
  }, []);

  const toggleRecord = useCallback(() => {
    clientRef.current?.sendCommand('TOGGLE_RECORD');
  }, []);

  const connectObs = useCallback((host: string, port: number, password?: string) => {
    clientRef.current?.sendCommand('CONNECT_OBS', { host, port, password });
  }, []);

  const disconnectObs = useCallback(() => {
    clientRef.current?.sendCommand('DISCONNECT_OBS');
  }, []);

  const clearObsError = useCallback(() => {
    clientRef.current?.sendCommand('CLEAR_OBS_ERROR');
  }, []);

  const setCameraMapping = useCallback((sources: CameraSourceInfo[]) => {
    clientRef.current?.sendCommand('SET_CAMERA_MAPPING', { cameraSources: sources });
  }, []);

  // --- Auth & Session Operations ---
  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setError(data.error || 'Login failed');
        return false;
      }
      setUser(data.user);
      localStorage.setItem('mk_vision_user', JSON.stringify(data.user));
      return true;
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      return false;
    }
  };

  const registerUser = async (name: string, email: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setError(data.error || 'Registration failed');
        return false;
      }
      setUser(data.user);
      localStorage.setItem('mk_vision_user', JSON.stringify(data.user));
      return true;
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setDevice(null);
    localStorage.removeItem('mk_vision_user');
    localStorage.removeItem('mk_vision_device');
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  };

  const registerDevice = async (name: string, type: Device['type']): Promise<Device> => {
    if (!user) throw new Error('Must be logged in to register device');
    const res = await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name, type }),
    });
    const data = await res.json();
    if (!res.ok || !data.device) {
      throw new Error(data.error || 'Device registration failed');
    }
    setDevice(data.device);
    localStorage.setItem('mk_vision_device', JSON.stringify(data.device));
    await refreshDevices();
    return data.device;
  };

  const revokeDevice = async (deviceIdToRevoke: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/devices/${deviceIdToRevoke}/revoke`, {
        method: 'POST',
      });
      const data = await res.json();
      await refreshDevices();
      return !!data.success;
    } catch (err) {
      console.error('Revoke device failed:', err);
      return false;
    }
  };

  const createSession = async (name: string): Promise<SwitcherSessionState> => {
    if (!user) throw new Error('Login required');
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerId: user.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.session) {
      throw new Error(data.error || 'Failed to create session');
    }
    setSessionId(data.session.sessionId);
    setRole('owner');
    return data.session;
  };

  const joinSession = async (codeOrToken: string): Promise<boolean> => {
    try {
      const isToken = codeOrToken.startsWith('inv-');
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isToken ? { inviteToken: codeOrToken } : { sessionCode: codeOrToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.session) {
        setError(data.error || 'Could not join session');
        return false;
      }
      setSessionId(data.session.sessionId);
      if (data.role) {
        setRole(data.role);
      }
      return true;
    } catch (err: any) {
      setError(err?.message || 'Join failed');
      return false;
    }
  };

  const createInviteToken = async (targetRole: 'operator' | 'observer' = 'operator'): Promise<string> => {
    const res = await fetch(`/api/sessions/${sessionId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: targetRole }),
    });
    const data = await res.json();
    if (!res.ok || !data.inviteToken) {
      throw new Error(data.error || 'Failed to generate invitation');
    }
    return data.inviteToken;
  };

  const switchSession = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  const clearError = () => setError(null);

  const sessionName = switcherState?.sessionName || 'MK VISION Production';

  return (
    <SwitcherContext.Provider
      value={{
        user,
        device,
        userDevices,
        sessionId,
        sessionName,
        switcherState,
        audioTelemetry,
        members,
        connectionStatus,
        role,
        revocationReason,
        error,

        setPreview,
        setProgram,
        cut,
        autoTake,
        setTBar,
        toggleDsk,
        setAudioVolume,
        toggleAudioMute,
        setMasterVolume,
        toggleMasterMute,
        toggleAfv,
        toggleStream,
        toggleRecord,
        connectObs,
        disconnectObs,
        clearObsError,
        setCameraMapping,

        login,
        registerUser,
        logout,
        registerDevice,
        revokeDevice,
        refreshDevices,
        createSession,
        joinSession,
        createInviteToken,
        switchSession,
        clearError,
      }}
    >
      {children}
    </SwitcherContext.Provider>
  );
};

export const useSwitcher = () => {
  const ctx = useContext(SwitcherContext);
  if (!ctx) {
    throw new Error('useSwitcher must be used within a SwitcherProvider');
  }
  return ctx;
};
