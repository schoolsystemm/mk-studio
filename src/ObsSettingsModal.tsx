/**
 * MK VISION - OBS WebSocket v5 Engine Settings
 * Connect, Studio Mode Enforcement, Diagnostics, and Camera Scene Mapping
 * By Melton Konchella
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Radio,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  Download,
  Copy,
  CheckCircle,
  MonitorPlay,
  ExternalLink,
  Activity,
} from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';
import { CameraSourceInfo } from '../types/switcher.js';

interface ObsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ObsSettingsModal: React.FC<ObsSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    switcherState,
    connectObs,
    disconnectObs,
    clearObsError,
    setCameraMapping,
    role,
  } = useSwitcher();

  const obsConnected = switcherState?.obsConnected || false;
  const obsIsConnecting = switcherState?.obsIsConnecting || false;
  const obsConnectionError = switcherState?.obsConnectionError;
  const studioModeActive = switcherState?.studioModeActive || false;
  const initialHost = switcherState?.obsHost || 'localhost';
  const initialPort = switcherState?.obsPort || 4455;

  const [host, setHost] = useState(initialHost);
  const [port, setPort] = useState(initialPort);
  const [password, setPassword] = useState(() => {
    try {
      return localStorage.getItem('mk_vision_obs_pw') || '';
    } catch {
      return '';
    }
  });
  const [bridgeKey] = useState<string>(() => {
    const gen = () => 'mk-' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
    try {
      let k = localStorage.getItem('mk_vision_bridge_key');
      if (!k || k.length < 12) {
        k = gen();
        localStorage.setItem('mk_vision_bridge_key', k);
      }
      return k;
    } catch {
      return gen();
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [localConnecting, setLocalConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const isConnecting = obsIsConnecting || localConnecting;

  // Camera Scene Names
  const [cameras, setCameras] = useState<CameraSourceInfo[]>(
    switcherState?.cameraSources || []
  );

  useEffect(() => {
    if (switcherState?.cameraSources && switcherState.cameraSources.length > 0) {
      setCameras(switcherState.cameraSources);
    }
  }, [switcherState?.cameraSources]);

  useEffect(() => {
    if (obsConnected || obsConnectionError) {
      setLocalConnecting(false);
    }
  }, [obsConnected, obsConnectionError]);

  if (!isOpen) return null;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPw = password.trim();
    try {
      localStorage.setItem('mk_vision_obs_pw', cleanPw);
    } catch {
      // ignore
    }

    setLocalConnecting(true);
    setStatusMsg(`Connecting to OBS at ${host.trim()}:${port}...`);
    connectObs(host.trim(), Number(port), cleanPw);

    // Watchdog: clear connecting spinner after 5.5s if server timed out
    setTimeout(() => {
      setLocalConnecting(false);
      setStatusMsg(null);
    }, 5500);
  };

  const handleDisconnect = () => {
    disconnectObs();
    setStatusMsg('OBS Disconnected.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleSaveMappings = () => {
    setCameraMapping(cameras);
    setStatusMsg('Camera scene mappings saved.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleCameraChange = (id: string, field: keyof CameraSourceInfo, value: string) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleUseStandalone = () => {
    clearObsError();
    onClose();
  };

  const handleDownloadLauncher = () => {
    const batContent = `@echo off
title MK VISION Broadcast Switcher - Local Controller
echo =========================================================
echo   MK VISION Broadcast Video Switcher
echo   Created by Melton Konchella
echo =========================================================
echo.
echo [1/2] Starting local production switcher...
echo [2/2] Opening browser to http://localhost:3000
echo.
echo Connected directly to local OBS on port 4455 with 0ms lag!
echo.
start http://localhost:3000
npm run dev
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start-mk-vision.bat';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Downloaded start-mk-vision.bat! Place it in the project folder and double-click to run locally.');
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const applyBridgeHost = () => {
    setHost(`bridge:${bridgeKey}`);
    setPort(4455);
    clearObsError();
  };

  const handleDownloadBridge = () => {
    applyBridgeHost();
    const a = document.createElement('a');
    a.href = `/bridge/launcher.bat?key=${encodeURIComponent(bridgeKey)}`;
    a.download = 'MK-VISION-Bridge.bat';
    a.click();
    setStatusMsg('Downloaded MK-VISION-Bridge.bat. Double-click it on the OBS PC, keep the window open, then press Connect.');
    setTimeout(() => setStatusMsg(null), 8000);
  };

  const handleCopyBridgeCmd = () => {
    navigator.clipboard.writeText(`curl -fsSL ${window.location.origin}/bridge/launcher.sh?key=${bridgeKey} | bash`);
    applyBridgeHost();
    setStatusMsg('Copied Mac/Linux command. Paste it in Terminal on the OBS computer.');
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleCopyTunnelCmd = () => {
    navigator.clipboard.writeText('ssh -p 443 -R0:localhost:4455 tcp@free.pinggy.io');
    setStatusMsg('Copied free tunnel command! Paste into Windows PowerShell.');
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMsg(`Testing reachability to ${host.trim()}:${port}...`);
    try {
      const res = await fetch('/api/obs/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: host.trim(), port: Number(port), password: password.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setStatusMsg(`SUCCESS: OBS v${data.obsInfo?.obsVersion || ''} reached! (${data.tcpLatencyMs}ms ping)`);
      } else {
        setStatusMsg(`Reachability: ${data.errorCode || data.stage.toUpperCase()}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        stage: 'tcp',
        cleanHost: host,
        cleanPort: Number(port),
        exactError: err?.message || 'Network request failed',
        diagnosticSummary: 'Could not contact the diagnostic test server.',
        actionableAdvice: 'Check your internet connection and try again.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isOwner = role === 'owner';
  const isAuthError =
    obsConnectionError?.toLowerCase().includes('auth') ||
    obsConnectionError?.toLowerCase().includes('password');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#141720] border border-[#2c3345] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252b3b] bg-[#10131a]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide">
                OBS STUDIO ENGINE & SCENE MAPPING
              </h2>
              <p className="text-xs text-slate-400">
                Configure OBS WebSocket v5 connection and production cross-points
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className="mx-5 mt-3 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            {statusMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* OBS WebSocket v5 Connection Form */}
          <div className="p-4 rounded-lg bg-[#181d28] border border-[#283244] space-y-4">
            <div className="flex items-center justify-between border-b border-[#252f42] pb-2">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${obsConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="font-mono font-bold text-xs text-slate-200 uppercase">
                  OBS WEBSOCKET V5 CONFIGURATION
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    obsConnected
                      ? 'bg-emerald-400'
                      : isConnecting
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-amber-400'
                  }`}
                />
                <span
                  className={
                    obsConnected
                      ? 'text-emerald-400 font-bold'
                      : isConnecting
                      ? 'text-amber-300 font-bold'
                      : 'text-amber-400'
                  }
                >
                  {obsConnected
                    ? 'OBS CONNECTED'
                    : isConnecting
                    ? 'CONNECTING...'
                    : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {/* Authentication Failure Specific Guidance */}
            {isAuthError && !obsConnected && (
              <div className="p-4 rounded-lg bg-red-950/60 border-2 border-red-500 space-y-2.5 shadow-xl animate-in fade-in">
                <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold">
                  <KeyRound className="w-4 h-4 shrink-0 text-red-400" />
                  <span>AUTHENTICATION FAILED: OBS REJECTED PASSWORD</span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed">
                  <strong>Great news:</strong> OBS was reached successfully! However, OBS rejected the connection because the password was incorrect or left empty while OBS has authentication enabled.
                </p>

                <div className="p-3 rounded bg-black/60 border border-white/10 text-xs text-slate-300 space-y-2 font-mono">
                  <div className="text-amber-300 font-bold uppercase text-[11px]">
                    How to fix in 10 seconds:
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                    <li>
                      In <strong>OBS Studio</strong>, open <strong>Tools</strong> (top bar) → <strong>WebSocket Server Settings</strong>.
                    </li>
                    <li>
                      Click the button <strong>"Show Connect Info"</strong>.
                    </li>
                    <li>
                      Click the <strong>Eye icon</strong> to view the password (or click <strong>Copy</strong>).
                    </li>
                    <li>
                      Paste that password into the <strong>OBS WEBSOCKET PASSWORD</strong> box below.
                    </li>
                    <li className="text-slate-400">
                      <em>Alternative:</em> Uncheck <strong>"Enable Authentication"</strong> in OBS Studio, click Apply, and leave the password blank here.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* General Connection Error Diagnostics Alert */}
            {obsConnectionError && !isAuthError && !obsConnected && (
              <div className="p-4 rounded-lg bg-red-950/50 border-2 border-red-500/70 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>CONNECTION STATUS: {obsConnectionError}</span>
                  </div>
                  <button
                    onClick={clearObsError}
                    className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-black/40 border border-white/10"
                  >
                    Clear Error
                  </button>
                </div>

                <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    The cloud server in Europe could not reach your OBS WebSocket at <code className="px-1.5 py-0.5 rounded bg-black/60 font-mono text-amber-300">{host}:{port}</code> because private local IPs (like 192.168.x.x) and firewalled connections cannot be reached across the internet without a bridge.
                  </p>

                  {/* 3 Quick Solutions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUseStandalone}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold transition-all shadow-md text-left"
                    >
                      <MonitorPlay className="w-4 h-4 shrink-0" />
                      <div>
                        <div>USE VIRTUAL SWITCHER</div>
                        <div className="text-[10px] font-normal opacity-85">Operate 8 cameras without OBS</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadBridge}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono text-xs font-bold transition-all shadow-md text-left"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <div>
                        <div>DOWNLOAD MK BRIDGE</div>
                        <div className="text-[10px] font-normal opacity-85">One click, works from any network</div>
                      </div>
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Standalone Virtual Switcher Banner */}
            {!obsConnected && !obsConnectionError && (
              <div className="p-3.5 rounded-lg bg-sky-950/40 border border-sky-600/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MonitorPlay className="w-5 h-5 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-sky-200">
                      VIRTUAL SWITCHER MODE IS ALWAYS READY
                    </div>
                    <div className="text-[11px] text-slate-300">
                      You can operate all 8 cameras, transitions, audio meters, and multiview immediately without OBS!
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUseStandalone}
                  className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold shrink-0 transition-colors"
                >
                  START SWITCHING
                </button>
              </div>
            )}

            {/* Studio Mode Status Banner */}
            <div className="p-3 rounded bg-[#10131a] border border-[#242c3d] flex items-start gap-2.5">
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${studioModeActive ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div className="text-xs leading-relaxed">
                <span className="font-bold text-slate-200">OBS Studio Mode: </span>
                {studioModeActive ? (
                  <span className="text-emerald-400 font-medium">Verified Active. Program and Preview buses are linked to OBS Studio Mode.</span>
                ) : (
                  <span className="text-amber-300 font-medium">OBS Studio Mode is REQUIRED. MK VISION will automatically request Studio Mode upon connection.</span>
                )}
              </div>
            </div>

            {/* MK Bridge panel */}
            <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-600/30 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-300 font-mono">CONNECT OBS FROM ANY NETWORK (MK BRIDGE)</div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    On the computer running OBS: download, double-click, keep the window open. Then press Connect. No IP, port forwarding or router setup.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBridge}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  WINDOWS
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                <span>
                  Your bridge ID: <span className="text-amber-300 select-all">{bridgeKey}</span> (keep private)
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={handleCopyBridgeCmd} className="underline hover:text-amber-300">
                    Mac / Linux command
                  </button>
                  <button type="button" onClick={applyBridgeHost} className="underline hover:text-amber-300">
                    Use bridge
                  </button>
                </span>
              </div>
            </div>

            <form onSubmit={handleConnect} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  OBS HOST / IP
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost or 192.168.1.X"
                  className="w-full px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  OBS PORT (DEFAULT: 4455)
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="4455"
                  className="w-full px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-mono text-slate-400">
                    OBS WEBSOCKET PASSWORD
                  </label>
                  <span className="text-[10px] font-mono text-amber-400/80">
                    From OBS Connect Info
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Paste Server Password here"
                    className="w-full pl-3 pr-8 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Live Reachability Diagnostic Result Card */}
              {testResult && (
                <div className={`sm:col-span-3 p-3.5 rounded-lg border text-xs font-mono space-y-2 animate-in fade-in ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/70 text-red-200'
                }`}>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">OBS REACHED SUCCESSFULLY! (Ping: {testResult.tcpLatencyMs}ms)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-red-300">TEST FAILED AT STAGE: [{testResult.stage.toUpperCase()}] {testResult.errorCode || ''}</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestResult(null)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-200 font-sans leading-relaxed">
                    <div className="font-mono text-[11px] text-slate-300">
                      <strong>Probed Target:</strong> <code className="text-amber-300 font-mono">{testResult.cleanHost}:{testResult.cleanPort}</code>
                      {testResult.resolvedIp && (
                        <span> → IP: <code className="text-slate-200 font-mono">{testResult.resolvedIp}</code></span>
                      )}
                    </div>

                    {testResult.exactError && (
                      <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-red-300 border border-red-900/50">
                        <strong>Exact Error:</strong> {testResult.exactError}
                      </div>
                    )}

                    <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                      <div className="font-bold text-slate-200 font-mono text-[11px]">DIAGNOSIS:</div>
                      <div className="text-slate-300">{testResult.diagnosticSummary}</div>
                      <div className="font-bold text-amber-300 font-mono text-[11px] pt-1">RECOMMENDED ACTION:</div>
                      <div className="text-amber-200/90">{testResult.actionableAdvice}</div>
                    </div>

                    {testResult.obsInfo && (
                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-emerald-300 bg-emerald-950/20 p-2 rounded border border-emerald-800/40">
                        <div>OBS Version: <strong>{testResult.obsInfo.obsVersion}</strong></div>
                        <div>WebSocket: <strong>v{testResult.obsInfo.obsWebSocketVersion}</strong></div>
                        <div>Platform: <strong>{testResult.obsInfo.platform}</strong></div>
                        <div>Studio Mode: <strong>{testResult.obsInfo.studioModeEnabled ? 'ACTIVE' : 'INACTIVE'}</strong></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !host}
                  className="px-4 py-2 rounded bg-[#202738] hover:bg-[#2c364d] disabled:opacity-40 border border-[#3d4a66] text-sky-300 hover:text-white font-mono text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : 'text-sky-400'}`} />
                  <span>{isTesting ? 'PROBING NETWORK...' : 'TEST REACHABILITY & PING'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {obsConnected ? (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-4 py-1.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 text-xs font-mono font-medium transition-colors"
                    >
                      DISCONNECT OBS
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isConnecting}
                      className="px-5 py-2 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-colors shadow-md flex items-center gap-1.5"
                    >
                      {isConnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isConnecting ? 'CONNECTING...' : 'CONNECT TO OBS STUDIO'}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Camera Cross-Point Scene Mapping (CAM 1 to CAM 8) */}
          <div className="p-4 rounded-lg bg-[#181d28] border border-[#283244] space-y-3">
            <div className="flex items-center justify-between border-b border-[#252f42] pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="font-mono font-bold text-xs text-slate-200 uppercase">
                  CAMERA SCENE MAPPING (CAM 1 – CAM 8)
                </span>
              </div>
              <button
                onClick={handleSaveMappings}
                className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>SAVE MAPPINGS</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Map each switcher hardware button to the exact scene name in your OBS Studio collection.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cameras.map((cam) => (
                <div
                  key={cam.id}
                  className="p-2.5 rounded bg-[#10131a] border border-[#242c3d] flex items-center gap-2"
                >
                  <span className="w-12 text-xs font-mono font-black text-amber-400 shrink-0">
                    {cam.label}
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={cam.obsSceneName}
                      onChange={(e) => handleCameraChange(cam.id, 'obsSceneName', e.target.value)}
                      placeholder="OBS Scene Name"
                      className="w-full px-2 py-1 rounded bg-[#181d28] border border-[#2c364a] text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      value={cam.description}
                      onChange={(e) => handleCameraChange(cam.id, 'description', e.target.value)}
                      placeholder="Label (e.g. Stage Wide)"
                      className="w-full px-2 py-0.5 rounded bg-[#181d28] border border-[#2c364a] text-[11px] text-slate-400 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#252b3b] bg-[#10131a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
