import dns from 'dns';
import net from 'net';
import OBSWebSocket from 'obs-websocket-js';

export interface ObsTestResult {
  success: boolean;
  stage: 'dns' | 'tcp' | 'handshake' | 'auth' | 'connected';
  cleanHost: string;
  cleanPort: number;
  resolvedIp?: string;
  tcpLatencyMs?: number;
  exactError?: string;
  errorCode?: string;
  rawDetails?: string;
  obsInfo?: {
    obsVersion?: string;
    obsWebSocketVersion?: string;
    platform?: string;
    studioModeEnabled?: boolean;
  };
  diagnosticSummary: string;
  actionableAdvice: string;
}

export async function testObsConnection(
  rawHost: string,
  rawPort: number | string,
  password?: string
): Promise<ObsTestResult> {
  const startTime = Date.now();

  let cleanHost = (rawHost || '').trim().replace(/^(tcp:\/\/|ws:\/\/|wss:\/\/|http:\/\/|https:\/\/)/i, '');
  let cleanPort = Number(rawPort) || 4455;

  if (cleanHost.includes(':')) {
    const parts = cleanHost.split(':');
    cleanHost = parts[0];
    if (parts[1] && !isNaN(Number(parts[1]))) {
      cleanPort = Number(parts[1]);
    }
  }

  if (!cleanHost) {
    return {
      success: false,
      stage: 'dns',
      cleanHost: '',
      cleanPort,
      exactError: 'Host/IP address cannot be empty',
      diagnosticSummary: 'No target address was provided.',
      actionableAdvice: 'Please type your OBS PC IP address (e.g. 192.168.1.X or public IP or tunnel domain).',
    };
  }

  // --- STAGE 1: DNS & IP RESOLUTION ---
  let resolvedIp: string | undefined;
  try {
    const lookup = await dns.promises.lookup(cleanHost);
    resolvedIp = lookup.address;
  } catch (err: any) {
    const code = err?.code || 'ENOTFOUND';
    return {
      success: false,
      stage: 'dns',
      cleanHost,
      cleanPort,
      exactError: `DNS Resolution Failed: ${err?.message || code}`,
      errorCode: code,
      rawDetails: String(err?.stack || err),
      diagnosticSummary: `The host "${cleanHost}" could not be resolved to an IP address.`,
      actionableAdvice: 'Verify there are no typos in the host field. If using a domain or DDNS, ensure it points to a valid public IP.',
    };
  }

  // Detect private LAN IPs when running in cloud
  const isPrivateIp =
    resolvedIp.startsWith('192.168.') ||
    resolvedIp.startsWith('10.') ||
    resolvedIp.startsWith('127.') ||
    resolvedIp === '::1' ||
    (resolvedIp.startsWith('172.') &&
      (() => {
        const second = parseInt(resolvedIp.split('.')[1], 10);
        return second >= 16 && second <= 31;
      })());

  // --- STAGE 2: TCP SOCKET PROBE & LATENCY MEASUREMENT ---
  let tcpLatencyMs = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const tcpStart = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.connect(cleanPort, resolvedIp || cleanHost, () => {
        tcpLatencyMs = Date.now() - tcpStart;
        socket.destroy();
        resolve();
      });

      socket.on('timeout', () => {
        socket.destroy();
        const err: any = new Error('Connection timed out after 4000ms (No response from target)');
        err.code = 'ETIMEDOUT';
        reject(err);
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
    });
  } catch (err: any) {
    const code = err?.code || 'TCP_ERROR';
    const msg = err?.message || String(err);

    let summary = `Could not establish a TCP connection to ${cleanHost}:${cleanPort} (${resolvedIp}).`;
    let advice = 'Check that OBS Studio is open and the computer is connected to the network.';

    if (code === 'ECONNREFUSED') {
      summary = `The computer at ${resolvedIp} was reached, but port ${cleanPort} actively rejected the connection (ECONNREFUSED).`;
      advice = `OBS Studio is likely running on that PC, but the WebSocket Server is DISABLED or listening on a different port. In OBS Studio, open Tools → WebSocket Server Settings, check "Enable WebSocket server", and confirm the port is ${cleanPort}.`;
    } else if (code === 'ETIMEDOUT' || msg.includes('timed out')) {
      if (isPrivateIp) {
        summary = `Address ${resolvedIp} is a private local Wi-Fi address (192.168.x.x).`;
        advice = `The cloud server cannot cross into your home private Wi-Fi. Run MK VISION locally on your PC (http://localhost:3000) or use a free tunnel (ssh -p 443 -R0:localhost:4455 tcp@free.pinggy.io).`;
      } else {
        summary = `Packets were sent to ${resolvedIp}:${cleanPort}, but no response was received (ETIMEDOUT).`;
        advice = `The port is blocked by Windows Firewall or your router. In Windows Defender Firewall, allow port ${cleanPort} TCP, or check router port forwarding.`;
      }
    } else if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
      summary = `Target network is unreachable (${code}).`;
      advice = `Check internet connectivity and verify the router is online.`;
    }

    return {
      success: false,
      stage: 'tcp',
      cleanHost,
      cleanPort,
      resolvedIp,
      exactError: `${code}: ${msg}`,
      errorCode: code,
      rawDetails: String(err?.stack || err),
      diagnosticSummary: summary,
      actionableAdvice: advice,
    };
  }

  // --- STAGE 3: OBS WEBSOCKET v5 HANDSHAKE & AUTHENTICATION ---
  const isSecure = cleanPort === 443 || cleanHost.toLowerCase().startsWith('wss://');
  const protocol = isSecure ? 'wss://' : 'ws://';
  const obsUrl = `${protocol}${cleanHost}:${cleanPort}`;

  const obs = new OBSWebSocket();
  try {
    await Promise.race([
      obs.connect(obsUrl, password || undefined, {
        eventSubscriptions: 0x00000001 | 0x00000004,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OBS WebSocket handshake timed out after 5000ms')), 5000);
      }),
    ]);

    // Query version info
    let obsVersion = 'Unknown';
    let obsWebSocketVersion = 'Unknown';
    let platform = 'Unknown';
    let studioModeEnabled = false;

    try {
      const versionData = await obs.call('GetVersion');
      obsVersion = versionData.obsVersion;
      obsWebSocketVersion = versionData.obsWebSocketVersion;
      platform = versionData.platform;
    } catch {
      // ignore
    }

    try {
      const studioData = await obs.call('GetStudioModeEnabled');
      studioModeEnabled = studioData.studioModeEnabled;
    } catch {
      // ignore
    }

    // Disconnect test probe
    try {
      await obs.disconnect();
    } catch {
      // ignore
    }

    return {
      success: true,
      stage: 'connected',
      cleanHost,
      cleanPort,
      resolvedIp,
      tcpLatencyMs,
      obsInfo: {
        obsVersion,
        obsWebSocketVersion,
        platform,
        studioModeEnabled,
      },
      diagnosticSummary: `100% SUCCESS: OBS Studio reached and authenticated! Ping latency: ${tcpLatencyMs}ms.`,
      actionableAdvice: `Connection is fully operational! OBS Studio v${obsVersion} (WebSocket v${obsWebSocketVersion}) is ready to take commands.`,
    };
  } catch (err: any) {
    try {
      await obs.disconnect();
    } catch {
      // ignore
    }

    const msg = err?.message || String(err);
    const code = err?.code;

    // Check if error is authentication-related (OBS error 4009)
    const isAuth =
      msg.toLowerCase().includes('auth') ||
      msg.toLowerCase().includes('password') ||
      code === 4009 ||
      code === 4008;

    if (isAuth) {
      return {
        success: false,
        stage: 'auth',
        cleanHost,
        cleanPort,
        resolvedIp,
        tcpLatencyMs,
        exactError: `OBS Authentication Failed (Code ${code || 4009}): ${msg}`,
        errorCode: String(code || 'AUTH_FAILED'),
        rawDetails: String(err?.stack || err),
        diagnosticSummary: `OBS Studio was reached successfully (${tcpLatencyMs}ms ping), but OBS rejected the password!`,
        actionableAdvice: `In OBS Studio, open Tools → WebSocket Server Settings → click "Show Connect Info", copy the exact Server Password, and paste it into MK VISION. Or uncheck "Enable Authentication" in OBS.`,
      };
    }

    return {
      success: false,
      stage: 'handshake',
      cleanHost,
      cleanPort,
      resolvedIp,
      tcpLatencyMs,
      exactError: `WebSocket Handshake Failed: ${msg}`,
      errorCode: String(code || 'HANDSHAKE_ERROR'),
      rawDetails: String(err?.stack || err),
      diagnosticSummary: `TCP port ${cleanPort} was open, but the service did not complete the OBS WebSocket v5 handshake.`,
      actionableAdvice: `Ensure the service running on port ${cleanPort} is OBS Studio v28+ with OBS-WebSocket v5 enabled, and not a standard web server.`,
    };
  }
}
