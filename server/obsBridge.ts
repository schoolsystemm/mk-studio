/**
 * MK VISION - OBS Reverse Bridge
 * A tiny agent on the OBS PC dials OUT to this server (/obs-bridge?key=K).
 * ObsManager then connects to an internal relay (/obs-relay/K) that pipes
 * raw obs-websocket frames through the bridge to OBS on the PC's localhost.
 * No port forwarding, tunnels or firewall rules required.
 */

import type http from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';

const bridges = new Map<string, WebSocket>();
const bridgeWss = new WebSocketServer({ noServer: true });
const relayWss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => (protocols.has('obswebsocket.json') ? 'obswebsocket.json' : false),
});

export const BRIDGE_PREFIX = 'bridge:';

export function isBridgeHost(host: string): boolean {
  return (host || '').trim().toLowerCase().startsWith(BRIDGE_PREFIX);
}

export function bridgeKeyFromHost(host: string): string {
  return host.trim().slice(BRIDGE_PREFIX.length).trim();
}

export function isBridgeOnline(key: string): boolean {
  const ws = bridges.get(key);
  return !!ws && ws.readyState === WebSocket.OPEN;
}

export function relayUrl(key: string, port: number): string {
  return `ws://127.0.0.1:${port}/obs-relay/${encodeURIComponent(key)}`;
}

function reject(socket: Duplex, code: number, msg: string) {
  socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Returns true if the upgrade was handled here. */
export function handleBridgeUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): boolean {
  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname === '/obs-bridge') {
    const key = (url.searchParams.get('key') || '').trim();
    if (key.length < 6) {
      reject(socket, 400, 'Bridge key must be at least 6 characters');
      return true;
    }
    bridgeWss.handleUpgrade(req, socket, head, (ws) => attachBridge(key, ws));
    return true;
  }

  if (url.pathname.startsWith('/obs-relay/')) {
    // Internal only: ObsManager connects from the same machine.
    const addr = req.socket.remoteAddress || '';
    const local = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!local) {
      reject(socket, 403, 'Forbidden');
      return true;
    }
    const key = decodeURIComponent(url.pathname.slice('/obs-relay/'.length));
    const bridge = bridges.get(key);
    if (!bridge || bridge.readyState !== WebSocket.OPEN) {
      reject(socket, 404, 'Bridge offline');
      return true;
    }
    relayWss.handleUpgrade(req, socket, head, (ws) => attachRelay(key, bridge, ws));
    return true;
  }

  return false;
}

function attachBridge(key: string, ws: WebSocket) {
  const old = bridges.get(key);
  if (old && old !== ws) {
    try { old.close(1000, 'Replaced by a new bridge'); } catch { /* ignore */ }
  }
  bridges.set(key, ws);
  console.log(`[MK VISION BRIDGE] Bridge online: ${key.slice(0, 3)}***`);

  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 20000);

  ws.on('close', () => {
    clearInterval(ping);
    if (bridges.get(key) === ws) bridges.delete(key);
    console.log(`[MK VISION BRIDGE] Bridge offline: ${key.slice(0, 3)}***`);
  });
  ws.on('error', () => { /* close handler cleans up */ });
}

function attachRelay(key: string, bridge: WebSocket, relay: WebSocket) {
  const send = (obj: object) => {
    if (bridge.readyState === WebSocket.OPEN) bridge.send(JSON.stringify(obj));
  };

  const onBridgeMessage = (raw: WebSocket.RawData) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === 'data' && typeof msg.d === 'string') {
      if (relay.readyState === WebSocket.OPEN) relay.send(msg.d);
    } else if (msg.t === 'error') {
      relay.close(1011, String(msg.e || 'OBS unreachable from bridge').slice(0, 120));
    } else if (msg.t === 'closed') {
      relay.close(1000, 'OBS closed');
    }
  };
  const onBridgeGone = () => {
    if (relay.readyState === WebSocket.OPEN) relay.close(1011, 'Bridge disconnected');
  };

  bridge.on('message', onBridgeMessage);
  bridge.on('close', onBridgeGone);

  relay.on('message', (data, isBinary) => {
    if (isBinary) return; // obswebsocket.json is text-only
    send({ t: 'data', d: data.toString() });
  });
  relay.on('close', () => {
    bridge.off('message', onBridgeMessage);
    bridge.off('close', onBridgeGone);
    send({ t: 'close' });
  });
  relay.on('error', () => { /* close handler cleans up */ });

  send({ t: 'open' });
}
