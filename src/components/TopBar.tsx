/**
 * MK VISION - Tactical Broadcast Top Bar
 * Status telemetry, presence counter, OBS link, and quick action bar
 * By Melton Konchella
 */

import React from 'react';
import {
  Radio,
  Video,
  Disc,
  Users,
  QrCode,
  Laptop,
  Settings,
  LogOut,
  Maximize2,
  Shield,
  Activity,
  Zap,
} from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

interface TopBarProps {
  onOpenDevices: () => void;
  onOpenShare: () => void;
  onOpenObsSettings: () => void;
  onOpenAuth: () => void;
  onOpenSessions: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenDevices,
  onOpenShare,
  onOpenObsSettings,
  onOpenAuth,
  onOpenSessions,
}) => {
  const {
    user,
    device,
    sessionName,
    role,
    switcherState,
    members,
    connectionStatus,
    toggleStream,
    toggleRecord,
  } = useSwitcher();

  const isStreaming = switcherState?.streamState?.isStreaming || false;
  const isRecording = switcherState?.recordingState?.isRecording || false;
  const streamDuration = switcherState?.streamState?.durationSec || 0;
  const recordDuration = switcherState?.recordingState?.durationSec || 0;
  const obsConnected = switcherState?.obsConnected || false;

  const onlineMembersCount = members.filter((m) => m.isOnline).length || 1;

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-14 bg-[#12141a] border-b border-[#262a36] px-3 sm:px-4 flex items-center justify-between select-none text-slate-200">
      {/* Zone 1: Brand & Session Lockup */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center font-black text-white text-xs tracking-tighter shadow-md shadow-red-950/40 border border-red-500/30">
            MK
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-sm tracking-wider text-slate-100 font-mono">MK VISION</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[140px] sm:max-w-[200px]">
              By Melton Konchella
            </p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        {/* Session Selector Button */}
        <button
          onClick={onOpenSessions}
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#1a1e28] hover:bg-[#232938] border border-[#2b3345] transition-colors text-xs text-left"
          title="Change or create production session"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-200 truncate max-w-[120px] lg:max-w-[180px]">
            {sessionName}
          </span>
          <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-amber-300 ml-1">
            {role}
          </span>
        </button>
      </div>

      {/* Zone 2: Broadcast Status Telemetry (STREAM / REC / OBS / DEMO) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Stream Status & Trigger */}
        <button
          onClick={toggleStream}
          disabled={role === 'observer'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all text-xs font-mono font-medium ${
            isStreaming
              ? 'bg-red-600/20 border-red-500 text-red-400 shadow-sm shadow-red-500/20'
              : 'bg-[#181c26] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title="Toggle Live Stream Output"
        >
          <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
          <span className="hidden xs:inline">{isStreaming ? 'LIVE' : 'STREAM'}</span>
          {isStreaming && <span className="text-[11px] tabular-nums font-semibold">{formatTimer(streamDuration)}</span>}
        </button>

        {/* Record Status & Trigger */}
        <button
          onClick={toggleRecord}
          disabled={role === 'observer'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all text-xs font-mono font-medium ${
            isRecording
              ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/20'
              : 'bg-[#181c26] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title="Toggle Recording Output"
        >
          <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-amber-500 animate-spin' : 'text-slate-500'}`} />
          <span className="hidden xs:inline">{isRecording ? 'REC' : 'RECORD'}</span>
          {isRecording && <span className="text-[11px] tabular-nums font-semibold">{formatTimer(recordDuration)}</span>}
        </button>

        {/* OBS / Standalone Connection Tally */}
        {obsConnected ? (
          <button
            onClick={onOpenObsSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#13221b] border border-emerald-500/50 text-emerald-400 text-xs font-mono font-medium hover:border-emerald-400 transition-colors"
            title="OBS Studio v5 Connected - Click for Configuration"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">OBS CONNECTED</span>
            <span className="sm:hidden">OBS</span>
          </button>
        ) : (
          <button
            onClick={onOpenObsSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/40 border border-sky-500/40 text-sky-300 text-xs font-mono font-medium hover:border-sky-400 hover:text-white transition-colors"
            title="Standalone Virtual Switcher Engine Active - Click to connect OBS Studio"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="hidden sm:inline">VIRTUAL SWITCHER</span>
            <span className="sm:hidden">VIRTUAL</span>
          </button>
        )}
      </div>

      {/* Zone 3: Presence & Device Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Multi-Device Presence Counter */}
        <button
          onClick={onOpenDevices}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181c26] hover:bg-[#202534] border border-[#2b3345] transition-colors text-xs text-slate-300"
          title="Active Connected Devices in this Production"
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono font-semibold text-slate-200 tabular-nums">{onlineMembersCount}</span>
          <span className="text-[11px] text-slate-400 hidden md:inline">ONLINE</span>
        </button>

        {/* QR Code / Share Invite */}
        <button
          onClick={onOpenShare}
          className="p-1.5 rounded bg-[#181c26] hover:bg-[#202534] border border-[#2b3345] text-slate-300 hover:text-white transition-colors"
          title="Share Session / Pair Mobile Device with QR Code"
        >
          <QrCode className="w-4 h-4 text-emerald-400" />
        </button>

        {/* OBS Settings */}
        <button
          onClick={onOpenObsSettings}
          className="p-1.5 rounded bg-[#181c26] hover:bg-[#202534] border border-[#2b3345] text-slate-300 hover:text-white transition-colors"
          title="OBS Connection & Scene Mapping Settings"
        >
          <Settings className="w-4 h-4 text-slate-400" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          className="p-1.5 rounded bg-[#181c26] hover:bg-[#202534] border border-[#2b3345] text-slate-300 hover:text-white transition-colors hidden sm:block"
          title="Toggle Fullscreen Surface"
        >
          <Maximize2 className="w-4 h-4 text-slate-400" />
        </button>

        {/* User Profile / Auth */}
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#181c26] hover:bg-[#202534] border border-[#2b3345] text-xs text-slate-300 transition-colors"
          title={`Logged in as ${user?.name || 'Guest'}`}
        >
          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-200 uppercase">
            {user?.name?.slice(0, 1) || 'U'}
          </div>
          <span className="font-medium truncate max-w-[80px] hidden lg:inline">
            {user?.name?.split(' ')[0] || 'Account'}
          </span>
        </button>
      </div>
    </header>
  );
};
