/**
 * MK VISION - Professional Production Switcher Server
 * Express + WebSockets + Central Switcher Engine + Vite Middleware
 * By Melton Konchella
 */

import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { storage, hashPassword } from './server/storage.js';
import { SwitcherEngine } from './server/switcherEngine.js';
import { testObsConnection } from './server/obsTester.js';
import { handleBridgeUpgrade } from './server/obsBridge.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (handleBridgeUpgrade(req, socket, head)) return;
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (!pathname.startsWith('/__vite') && pathname !== '/') {
    socket.destroy();
  }
});
const switcherEngine = new SwitcherEngine();

// --- REST API ENDPOINTS ---

// Auth: Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const existing = storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const user = storage.createUser(name, email, password);
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Registration failed' });
  }
});

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const userRecord = storage.getUserByEmail(email);
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { hash } = hashPassword(password, userRecord.salt);
    if (hash !== userRecord.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const safeUser = storage.getUserById(userRecord.id);
    return res.json({ user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Login failed' });
  }
});

// Devices: Register a Device
app.post('/api/devices/register', (req, res) => {
  try {
    const { userId, name, type } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }
    const user = storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const deviceType = type || 'windows';
    const userAgent = req.headers['user-agent'];
    const device = storage.registerDevice(userId, name, deviceType, userAgent);
    return res.json({ device });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Device registration failed' });
  }
});

// Devices: List User Devices
app.get('/api/devices', (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }
    const devices = storage.getUserDevices(userId);
    return res.json({ devices });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to list devices' });
  }
});

// Devices: Revoke Device (Owner Action)
app.post('/api/devices/:deviceId/revoke', (req, res) => {
  try {
    const { deviceId } = req.params;
    switcherEngine.revokeDevice(deviceId);
    return res.json({ success: true, message: 'Device revoked' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to revoke device' });
  }
});

// Sessions: List Sessions
app.get('/api/sessions', (_req, res) => {
  try {
    const sessions = storage.getAllSessions();
    return res.json({ sessions });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to list sessions' });
  }
});

// Sessions: Create Session
app.post('/api/sessions', (req, res) => {
  try {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Session name and ownerId are required' });
    }
    const session = storage.createSession(name, ownerId);
    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create session' });
  }
});

// Sessions: Get Session Details
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const members = storage.getSessionMembers(sessionId);
    return res.json({ session, members });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to get session' });
  }
});

// Sessions: Create Invitation Token
app.post('/api/sessions/:sessionId/invite', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role } = req.body;
    const session = storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const inviteToken = storage.createInviteToken(sessionId, role || 'operator');
    return res.json({ inviteToken, sessionId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to generate invitation' });
  }
});

// Sessions: Join via Invite Token or Code
app.post('/api/sessions/join', (req, res) => {
  try {
    const { inviteToken, sessionCode } = req.body;
    if (inviteToken) {
      const invite = storage.validateInviteToken(inviteToken);
      if (!invite) {
        return res.status(400).json({ error: 'Invalid or expired invite token' });
      }
      const session = storage.getSession(invite.sessionId);
      return res.json({ session, role: invite.role });
    }

    if (sessionCode) {
      // Find session matching code or sessionId
      const all = storage.getAllSessions();
      const match = all.find((s) => s.sessionId === sessionCode || s.sessionId.endsWith(sessionCode));
      if (!match) {
        return res.status(404).json({ error: 'Production session not found' });
      }
      return res.json({ session: match, role: 'operator' });
    }

    return res.status(400).json({ error: 'Invite token or session code required' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to join session' });
  }
});

// OBS Connection Reachability Diagnostic Probe
app.post('/api/obs/test-connection', async (req, res) => {
  try {
    const { host, port, password } = req.body || {};
    const result = await testObsConnection(host, port, password);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      stage: 'tcp',
      exactError: err?.message || String(err),
      diagnosticSummary: 'Internal server error while probing target host.',
      actionableAdvice: 'Check network connectivity and retry.',
    });
  }
});

// --- WEBSOCKET CONNECTION HANDLING ---
wss.on('connection', (ws: WebSocket, req) => {
  console.log('[MK VISION WS] Client connected from', req.socket.remoteAddress);

  ws.on('message', (data: Buffer | string) => {
    try {
      const raw = data.toString();
      const parsed = JSON.parse(raw);

      if (parsed.type === 'JOIN_SESSION') {
        const { sessionId, deviceId, userId, userName, deviceName, deviceType, role } = parsed;
        const dev = storage.getDeviceById(deviceId);
        if (dev && dev.isRevoked) {
          ws.send(JSON.stringify({ type: 'DEVICE_REVOKED', reason: 'Device is revoked' }));
          ws.close();
          return;
        }

        switcherEngine.registerClient(ws, {
          sessionId: sessionId || 'session-sunday-service',
          deviceId: deviceId || 'anon-' + Math.random().toString(36).slice(2, 6),
          userId: userId || 'usr-guest',
          userName: userName || 'Operator',
          deviceName: deviceName || 'Web Control Surface',
          deviceType: deviceType || 'windows',
          role: role || 'operator',
        });
        return;
      }

      switcherEngine.handleClientMessage(ws, raw);
    } catch (err) {
      console.error('[MK VISION WS] Message error:', err);
    }
  });

  ws.on('close', () => {
    switcherEngine.unregisterClient(ws);
  });

  ws.on('error', (err) => {
    console.error('[MK VISION WS] Error:', err);
    switcherEngine.unregisterClient(ws);
  });
});

// --- VITE MIDDLEWARE OR STATIC SERVING ---
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MK VISION] Switcher Control Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MK VISION] Fatal server startup error:', err);
});
