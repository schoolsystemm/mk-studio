/**
 * MK VISION - Storage Engine
 * In-memory state with JSON persistence for users, devices, and sessions
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, Device, SwitcherSessionState, SessionMember, CameraSourceInfo, AudioChannelState } from '../src/types/switcher.js';

interface StorageData {
  users: Record<string, User & { passwordHash: string; salt: string }>;
  devices: Record<string, Device>;
  sessions: Record<string, SwitcherSessionState>;
  sessionMembers: Record<string, SessionMember[]>; // sessionId -> members
  inviteTokens: Record<string, { sessionId: string; expiresAt: number; role: 'operator' | 'observer' }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'mk-vision-store.json');

const INITIAL_CAMERAS: CameraSourceInfo[] = [
  { id: 'cam1', label: 'CAM 1', obsSceneName: 'Camera 1 - Wide', description: 'Main Stage Wide', color: '#3b82f6' },
  { id: 'cam2', label: 'CAM 2', obsSceneName: 'Camera 2 - Pulpit', description: 'Speaker Close-Up', color: '#10b981' },
  { id: 'cam3', label: 'CAM 3', obsSceneName: 'Camera 3 - Altar', description: 'Altar Center', color: '#f59e0b' },
  { id: 'cam4', label: 'CAM 4', obsSceneName: 'Camera 4 - Choir', description: 'Choir & Musicians', color: '#8b5cf6' },
  { id: 'cam5', label: 'CAM 5', obsSceneName: 'Camera 5 - Crowd', description: 'Congregation Wide', color: '#ec4899' },
  { id: 'cam6', label: 'CAM 6', obsSceneName: 'Camera 6 - Balcony', description: 'Overhead Angle', color: '#06b6d4' },
  { id: 'cam7', label: 'CAM 7', obsSceneName: 'Camera 7 - Slides', description: 'Presentation & Lyrics', color: '#14b8a6' },
  { id: 'cam8', label: 'CAM 8', obsSceneName: 'Camera 8 - Graphics', description: 'Media Video Roll', color: '#6366f1' },
];

const INITIAL_AUDIO_CHANNELS: AudioChannelState[] = [
  { id: 'cam1', name: 'CAM 1', db: -6, volumeMultiplier: 0.75, isMuted: false, peak: -18, isClipping: false, obsSourceName: 'Cam 1 Audio' },
  { id: 'cam2', name: 'CAM 2', db: -4, volumeMultiplier: 0.8, isMuted: false, peak: -12, isClipping: false, obsSourceName: 'Cam 2 Audio' },
  { id: 'cam3', name: 'CAM 3', db: -10, volumeMultiplier: 0.6, isMuted: true, peak: -60, isClipping: false, obsSourceName: 'Cam 3 Audio' },
  { id: 'cam4', name: 'CAM 4', db: -8, volumeMultiplier: 0.7, isMuted: false, peak: -22, isClipping: false, obsSourceName: 'Cam 4 Audio' },
  { id: 'cam5', name: 'CAM 5', db: -14, volumeMultiplier: 0.5, isMuted: true, peak: -60, isClipping: false, obsSourceName: 'Cam 5 Audio' },
  { id: 'cam6', name: 'CAM 6', db: -12, volumeMultiplier: 0.55, isMuted: true, peak: -60, isClipping: false, obsSourceName: 'Cam 6 Audio' },
  { id: 'cam7', name: 'CAM 7', db: -10, volumeMultiplier: 0.6, isMuted: false, peak: -24, isClipping: false, obsSourceName: 'Cam 7 Audio' },
  { id: 'cam8', name: 'CAM 8', db: -6, volumeMultiplier: 0.75, isMuted: false, peak: -16, isClipping: false, obsSourceName: 'Cam 8 Audio' },
  { id: 'mic1', name: 'MIC 1 (Host)', db: -2, volumeMultiplier: 0.88, isMuted: false, peak: -8, isClipping: false, obsSourceName: 'Host Wireless Mic' },
  { id: 'music', name: 'MUSIC (BGM)', db: -12, volumeMultiplier: 0.52, isMuted: false, peak: -20, isClipping: false, obsSourceName: 'BGM Player' },
];

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export class StorageEngine {
  private data: StorageData = {
    users: {},
    devices: {},
    sessions: {},
    sessionMembers: {},
    inviteTokens: {},
  };

  constructor() {
    this.load();
    this.seedDefaultData();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        for (const sess of Object.values(this.data.sessions)) {
          sess.obsIsConnecting = false;
          if (!sess.cameraSources || sess.cameraSources.length === 0) {
            sess.cameraSources = JSON.parse(JSON.stringify(INITIAL_CAMERAS));
          }
        }
      }
    } catch (err) {
      console.error('Error loading data file:', err);
    }
  }

  public save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      for (const sess of Object.values(this.data.sessions)) {
        sess.obsIsConnecting = false;
        if (!sess.cameraSources || sess.cameraSources.length === 0) {
          sess.cameraSources = JSON.parse(JSON.stringify(INITIAL_CAMERAS));
        }
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving data file:', err);
    }
  }

  private seedDefaultData() {
    // Seed default user: Melton Konchella (konchellamelton@gmail.com)
    const defaultEmail = 'konchellamelton@gmail.com';
    let defaultUser = Object.values(this.data.users).find((u) => u.email.toLowerCase() === defaultEmail);

    if (!defaultUser) {
      const { hash, salt } = hashPassword('Switcher2026!');
      const userId = 'usr-melton-01';
      defaultUser = {
        id: userId,
        email: defaultEmail,
        name: 'Melton Konchella',
        createdAt: new Date().toISOString(),
        passwordHash: hash,
        salt,
      };
      this.data.users[userId] = defaultUser;
    }

    // Seed default production session: "Sunday Service"
    const defaultSessionId = 'session-sunday-service';
    if (!this.data.sessions[defaultSessionId]) {
      const initialSession: SwitcherSessionState = {
        sessionId: defaultSessionId,
        sessionName: 'Sunday Service Live',
        ownerId: defaultUser.id,
        programSceneId: 'cam1',
        previewSceneId: 'cam2',
        transitionType: 'Cut',
        transitionDuration: 300,
        transitionProgress: 0,
        isTransitioning: false,
        dskActive: false,
        dskSourceName: 'Lower Third Graphics',
        audioFollowVideo: false,
        audioChannels: INITIAL_AUDIO_CHANNELS,
        masterAudio: {
          db: -4,
          volumeMultiplier: 0.82,
          isMuted: false,
          peak: -10,
          isClipping: false,
        },
        streamState: {
          isStreaming: false,
          durationSec: 0,
          kbitsPerSec: 6000,
          fps: 60,
        },
        recordingState: {
          isRecording: false,
          isPaused: false,
          durationSec: 0,
        },
        cameraSources: INITIAL_CAMERAS,
        obsConnected: false,
        obsHost: 'localhost',
        obsPort: 4455,
        studioModeActive: true,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      this.data.sessions[defaultSessionId] = initialSession;
      this.data.sessionMembers[defaultSessionId] = [];
    }

    this.save();
  }

  // Users
  getUserByEmail(email: string) {
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): User | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    const { passwordHash, salt, ...safeUser } = user;
    return safeUser;
  }

  createUser(name: string, email: string, password: string): User {
    const id = 'usr-' + crypto.randomUUID().slice(0, 8);
    const { hash, salt } = hashPassword(password);
    const userRecord = {
      id,
      name,
      email: email.toLowerCase(),
      createdAt: new Date().toISOString(),
      passwordHash: hash,
      salt,
    };
    this.data.users[id] = userRecord;
    this.save();
    const { passwordHash: _ph, salt: _s, ...safeUser } = userRecord;
    return safeUser;
  }

  // Devices
  getDeviceById(id: string): Device | undefined {
    return this.data.devices[id];
  }

  getUserDevices(userId: string): Device[] {
    return Object.values(this.data.devices).filter((d) => d.userId === userId);
  }

  registerDevice(userId: string, name: string, type: Device['type'], userAgent?: string): Device {
    const id = 'dev-' + crypto.randomUUID().slice(0, 8);
    const device: Device = {
      id,
      userId,
      name,
      type,
      registeredAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isOnline: true,
      isRevoked: false,
      currentSessionId: null,
      userAgent,
    };
    this.data.devices[id] = device;
    this.save();
    return device;
  }

  updateDeviceActivity(deviceId: string, isOnline: boolean, sessionId?: string) {
    const dev = this.data.devices[deviceId];
    if (dev) {
      dev.lastActive = new Date().toISOString();
      dev.isOnline = isOnline;
      if (sessionId !== undefined) {
        dev.currentSessionId = sessionId;
      }
      this.save();
    }
  }

  revokeDevice(deviceId: string): boolean {
    const dev = this.data.devices[deviceId];
    if (dev) {
      dev.isRevoked = true;
      dev.isOnline = false;
      this.save();
      return true;
    }
    return false;
  }

  deleteDevice(deviceId: string): boolean {
    if (this.data.devices[deviceId]) {
      delete this.data.devices[deviceId];
      this.save();
      return true;
    }
    return false;
  }

  // Sessions
  getSession(sessionId: string): SwitcherSessionState | undefined {
    return this.data.sessions[sessionId];
  }

  getAllSessions(): SwitcherSessionState[] {
    return Object.values(this.data.sessions);
  }

  createSession(name: string, ownerId: string): SwitcherSessionState {
    const sessionId = 'session-' + crypto.randomUUID().slice(0, 8);
    const session: SwitcherSessionState = {
      sessionId,
      sessionName: name,
      ownerId,
      programSceneId: 'cam1',
      previewSceneId: 'cam2',
      transitionType: 'Cut',
      transitionDuration: 300,
      transitionProgress: 0,
      isTransitioning: false,
      dskActive: false,
      dskSourceName: 'Lower Third Graphics',
      audioFollowVideo: false,
      audioChannels: JSON.parse(JSON.stringify(INITIAL_AUDIO_CHANNELS)),
      masterAudio: {
        db: -4,
        volumeMultiplier: 0.82,
        isMuted: false,
        peak: -10,
        isClipping: false,
      },
      streamState: {
        isStreaming: false,
        durationSec: 0,
        kbitsPerSec: 6000,
        fps: 60,
      },
      recordingState: {
        isRecording: false,
        isPaused: false,
        durationSec: 0,
      },
      cameraSources: JSON.parse(JSON.stringify(INITIAL_CAMERAS)),
      obsConnected: false,
      obsHost: 'localhost',
      obsPort: 4455,
      studioModeActive: true,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    this.data.sessions[sessionId] = session;
    this.data.sessionMembers[sessionId] = [];
    this.save();
    return session;
  }

  updateSessionState(sessionId: string, updater: (prev: SwitcherSessionState) => SwitcherSessionState): SwitcherSessionState | undefined {
    const prev = this.data.sessions[sessionId];
    if (!prev) return undefined;
    const next = updater(prev);
    next.updatedAt = new Date().toISOString();
    this.data.sessions[sessionId] = next;
    // Don't sync to disk on every single microtick, but do save state changes
    this.save();
    return next;
  }

  // Session Members
  getSessionMembers(sessionId: string): SessionMember[] {
    return this.data.sessionMembers[sessionId] || [];
  }

  addOrUpdateSessionMember(sessionId: string, member: SessionMember) {
    if (!this.data.sessionMembers[sessionId]) {
      this.data.sessionMembers[sessionId] = [];
    }
    const list = this.data.sessionMembers[sessionId];
    const idx = list.findIndex((m) => m.deviceId === member.deviceId);
    if (idx >= 0) {
      list[idx] = member;
    } else {
      list.push(member);
    }
    this.save();
  }

  removeSessionMember(sessionId: string, deviceId: string) {
    if (this.data.sessionMembers[sessionId]) {
      const idx = this.data.sessionMembers[sessionId].findIndex((m) => m.deviceId === deviceId);
      if (idx >= 0) {
        this.data.sessionMembers[sessionId][idx].isOnline = false;
        this.save();
      }
    }
  }

  // Invite Tokens
  createInviteToken(sessionId: string, role: 'operator' | 'observer' = 'operator', durationMs = 3600000): string {
    const token = 'inv-' + crypto.randomBytes(8).toString('hex');
    this.data.inviteTokens[token] = {
      sessionId,
      role,
      expiresAt: Date.now() + durationMs,
    };
    this.save();
    return token;
  }

  validateInviteToken(token: string): { sessionId: string; role: 'operator' | 'observer' } | null {
    const invite = this.data.inviteTokens[token];
    if (!invite) return null;
    if (Date.now() > invite.expiresAt) {
      delete this.data.inviteTokens[token];
      this.save();
      return null;
    }
    return { sessionId: invite.sessionId, role: invite.role };
  }
}

export const storage = new StorageEngine();
