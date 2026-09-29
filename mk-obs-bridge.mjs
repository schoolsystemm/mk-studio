#!/usr/bin/env node
/**
 * MK VISION - OBS Bridge (run on the PC that runs OBS)
 *
 *   node mk-obs-bridge.mjs <APP_URL> <KEY> [obsHost=127.0.0.1] [obsPort=4455]
 *
 * Example:
 *   node mk-obs-bridge.mjs https://my-app.run.app church-live-01
 *
 * Then in MK VISION set OBS Host to:  bridge:church-live-01
 * (port ignored, password = your OBS WebSocket password)
 *
 * Requires Node 22+ (built-in WebSocket) or the `ws` package alongside.
 */

let WS;
try {
  WS = (await import('ws')).WebSocket;
} catch {
  WS = globalThis.WebSocket;
}
if (!WS) {
  console.error('Need Node 22+ (or run `npm i ws` next to this file).');
  process.exit(1);
}

const [appUrl, key, obsHost = '127.0.0.1', obsPort = '4455'] = process.argv.slice(2);
if (!appUrl || !key || key.length < 6) {
  console.error('Usage: node mk-obs-bridge.mjs <APP_URL> <KEY (6+ chars)> [obsHost] [obsPort]');
  process.exit(1);
}

const wsBase = appUrl.replace(/\/+$/, '').replace(/^http/i, 'ws');
const cloudUrl = `${wsBase}/obs-bridge?key=${encodeURIComponent(key)}`;
const obsUrl = `ws://${obsHost}:${obsPort}`;

let retry = 0;

function connect() {
  const cloud = new WS(cloudUrl);
  let obs = null;

  const toCloud = (o) => cloud.readyState === 1 && cloud.send(JSON.stringify(o));
  const closeObs = () => {
    if (obs) {
      try { obs.close(); } catch { /* ignore */ }
      obs = null;
    }
  };

  cloud.addEventListener('open', () => {
    retry = 0;
    console.log(`[bridge] Connected to ${wsBase}. Key: ${key}`);
    console.log(`[bridge] OBS target: ${obsUrl}. Set OBS Host in MK VISION to  bridge:${key}`);
  });

  cloud.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(String(ev.data)); } catch { return; }

    if (msg.t === 'open') {
      closeObs();
      const sock = new WS(obsUrl, 'obswebsocket.json');
      obs = sock;
      sock.addEventListener('message', (e) => {
        if (typeof e.data === 'string') toCloud({ t: 'data', d: e.data });
      });
      sock.addEventListener('error', () => {
        toCloud({ t: 'error', e: `Cannot reach OBS at ${obsUrl}. Is OBS open with WebSocket enabled?` });
      });
      sock.addEventListener('close', () => {
        if (obs === sock) {
          obs = null;
          toCloud({ t: 'closed' });
        }
      });
      console.log('[bridge] Session opened -> OBS');
    } else if (msg.t === 'data') {
      if (obs && obs.readyState === 1) obs.send(msg.d);
    } else if (msg.t === 'close') {
      closeObs();
      console.log('[bridge] Session closed');
    }
  });

  const again = () => {
    closeObs();
    retry = Math.min(retry + 1, 6);
    const wait = retry * 2000;
    console.log(`[bridge] Disconnected from cloud. Retrying in ${wait / 1000}s...`);
    setTimeout(connect, wait);
  };
  let done = false;
  const once = () => { if (!done) { done = true; again(); } };
  cloud.addEventListener('close', once);
  cloud.addEventListener('error', once);
}

connect();
