/**
 * MK VISION - Professional Broadcast Audio Mixer
 * PPM Meters (0 to -48 dB), Clip Indicators, Channel Faders, AFV, and Master Output
 * By Melton Konchella
 */

import React from 'react';
import { Volume2, VolumeX, Mic, Music, Sliders, AlertTriangle, Radio } from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';
import { AudioChannelState } from '../types/switcher.js';

interface AudioMixerProps {
  compact?: boolean;
}

export const AudioMixer: React.FC<AudioMixerProps> = ({ compact = false }) => {
  const {
    switcherState,
    audioTelemetry,
    setAudioVolume,
    toggleAudioMute,
    setMasterVolume,
    toggleMasterMute,
    toggleAfv,
    role,
  } = useSwitcher();

  const isReadOnly = role === 'observer';
  const audioChannels = switcherState?.audioChannels || [];
  const masterAudio = switcherState?.masterAudio || {
    db: -4,
    volumeMultiplier: 0.8,
    isMuted: false,
    peak: -12,
    isClipping: false,
  };
  const afvActive = switcherState?.audioFollowVideo || false;

  // PPM scale values for ticks
  const DB_TICKS = [0, -3, -6, -12, -18, -24, -36, -48];

  const dbToPercent = (db: number) => {
    // Map -48dB to 0%, 0dB to 90%, +3dB to 100%
    if (db <= -48) return 0;
    if (db >= 3) return 100;
    return Math.max(0, Math.min(100, ((db + 48) / 51) * 100));
  };

  const getMeterColor = (percent: number, isClipping: boolean) => {
    if (isClipping || percent > 94) return 'bg-red-500 shadow-[0_0_6px_#ef4444]';
    if (percent > 78) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex flex-col bg-[#151821] p-3 rounded-lg border border-[#232838] shadow-inner select-none">
      {/* Mixer Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222736]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            AUDIO MIXER & PPM METERS
          </span>
        </div>

        {/* Audio Follow Video (AFV) Toggle */}
        <button
          disabled={isReadOnly}
          onClick={toggleAfv}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-all border ${
            afvActive
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-[#1b202c] border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Audio Follows Video: automatically un-mutes active Program camera audio"
        >
          <Radio className={`w-3.5 h-3.5 ${afvActive ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          <span>AFV: {afvActive ? 'ENABLED' : 'OFF'}</span>
        </button>
      </div>

      {/* Main Mixer Surface: Inputs Grid + Master Channel */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {/* Source Strips: CAM 1-8, MIC 1, MUSIC */}
        <div className="flex gap-2 flex-1">
          {audioChannels.map((ch) => {
            const telemetryChannel = audioTelemetry?.channels.find((t) => t.id === ch.id);
            const livePeak = telemetryChannel ? telemetryChannel.peak : ch.peak;
            const liveClip = telemetryChannel ? telemetryChannel.isClipping : ch.isClipping;
            const meterPct = ch.isMuted ? 0 : dbToPercent(livePeak);

            const isMic = ch.id.startsWith('mic');
            const isMusic = ch.id.startsWith('music');

            return (
              <div
                key={ch.id}
                className={`flex flex-col items-center justify-between p-2 rounded border bg-[#111319] min-w-[62px] sm:min-w-[70px] ${
                  ch.isMuted ? 'border-red-950/40 opacity-70' : 'border-[#222736]'
                }`}
              >
                {/* Channel Label */}
                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-1">
                    {isMic ? (
                      <Mic className="w-3 h-3 text-amber-400" />
                    ) : isMusic ? (
                      <Music className="w-3 h-3 text-sky-400" />
                    ) : null}
                    <span className="font-mono font-bold text-[11px] text-slate-200 truncate">
                      {ch.name}
                    </span>
                  </div>
                  {/* Clip Indicator LED */}
                  <div className="flex items-center justify-center mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        liveClip && !ch.isMuted ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-slate-800'
                      }`}
                      title={liveClip ? 'AUDIO CLIPPING!' : 'Normal Headroom'}
                    />
                  </div>
                </div>

                {/* Vertical PPM Meter & Level Slider */}
                <div className="flex items-center justify-center gap-1.5 my-2 h-28 sm:h-32">
                  {/* Meter Trough */}
                  <div className="relative w-2.5 h-full bg-[#0a0c0f] rounded-sm overflow-hidden border border-[#1e2330]">
                    <div
                      className={`absolute bottom-0 w-full rounded-sm transition-all duration-75 ${getMeterColor(
                        meterPct,
                        liveClip
                      )}`}
                      style={{ height: `${meterPct}%` }}
                    />
                  </div>

                  {/* Vertical Fader Slider */}
                  <div className="relative h-full flex items-center">
                    <input
                      type="range"
                      min={-48}
                      max={6}
                      step={1}
                      disabled={isReadOnly}
                      value={ch.db}
                      onChange={(e) => setAudioVolume(ch.id, Number(e.target.value))}
                      className="accent-slate-200 h-full w-4 cursor-pointer"
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        WebkitAppearance: 'slider-vertical',
                      }}
                    />
                  </div>
                </div>

                {/* dB Readout */}
                <div className="font-mono text-[10px] text-slate-300 font-semibold tabular-nums">
                  {ch.db > 0 ? `+${ch.db}` : ch.db} dB
                </div>

                {/* Mute Button */}
                <button
                  disabled={isReadOnly}
                  onClick={() => toggleAudioMute(ch.id)}
                  className={`w-full mt-1.5 py-1 rounded text-[10px] font-mono font-bold transition-colors flex items-center justify-center gap-1 border ${
                    ch.isMuted
                      ? 'bg-red-950/80 border-red-500 text-red-300 shadow-sm shadow-red-900/40'
                      : 'bg-[#1b202c] border-[#2b3345] text-slate-300 hover:text-white'
                  }`}
                >
                  {ch.isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-slate-400" />}
                  <span>{ch.isMuted ? 'MUTED' : 'ON'}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* MASTER AUDIO CHANNEL (PROMINENT RIGHT STRIP) */}
        <div className="flex flex-col items-center justify-between p-2.5 rounded-lg border-2 border-red-500/50 bg-gradient-to-b from-[#1c1316] via-[#141217] to-[#0e0e13] min-w-[84px] sm:min-w-[94px] shadow-lg shadow-red-950/40">
          {/* Master Badge */}
          <div className="w-full text-center">
            <span className="font-mono font-black text-xs text-red-400 tracking-wider uppercase block">
              MASTER
            </span>
            {/* Prominent Master Clip LED */}
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  masterAudio.isClipping && !masterAudio.isMuted
                    ? 'bg-red-500 shadow-[0_0_8px_#ef4444] animate-ping'
                    : 'bg-slate-800'
                }`}
              />
              <span className="text-[9px] font-mono font-semibold text-slate-400">
                {masterAudio.isClipping ? 'CLIP' : 'OUTPUT'}
              </span>
            </div>
          </div>

          {/* Master Dual PPM Meters & Fader */}
          <div className="flex items-center justify-center gap-2 my-2 h-28 sm:h-32">
            {/* Left & Right Master Meter Troughs */}
            <div className="flex gap-1 h-full">
              <div className="relative w-2 h-full bg-[#0a0c0f] rounded-sm overflow-hidden border border-[#2b1f24]">
                <div
                  className={`absolute bottom-0 w-full rounded-sm transition-all duration-75 ${getMeterColor(
                    masterAudio.isMuted ? 0 : dbToPercent(masterAudio.peak),
                    masterAudio.isClipping
                  )}`}
                  style={{
                    height: `${masterAudio.isMuted ? 0 : dbToPercent(masterAudio.peak)}%`,
                  }}
                />
              </div>
              <div className="relative w-2 h-full bg-[#0a0c0f] rounded-sm overflow-hidden border border-[#2b1f24]">
                <div
                  className={`absolute bottom-0 w-full rounded-sm transition-all duration-75 ${getMeterColor(
                    masterAudio.isMuted ? 0 : dbToPercent(masterAudio.peak - 0.5),
                    masterAudio.isClipping
                  )}`}
                  style={{
                    height: `${masterAudio.isMuted ? 0 : Math.max(0, dbToPercent(masterAudio.peak - 0.5))}%`,
                  }}
                />
              </div>
            </div>

            {/* Master Heavy-Duty Fader */}
            <div className="relative h-full flex items-center">
              <input
                type="range"
                min={-48}
                max={6}
                step={1}
                disabled={isReadOnly}
                value={masterAudio.db}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="accent-red-500 h-full w-5 cursor-pointer"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  WebkitAppearance: 'slider-vertical',
                }}
              />
            </div>
          </div>

          {/* Master dB Readout */}
          <div className="font-mono text-xs text-red-300 font-bold tabular-nums">
            {masterAudio.db > 0 ? `+${masterAudio.db}` : masterAudio.db} dB
          </div>

          {/* Master Mute Button */}
          <button
            disabled={isReadOnly}
            onClick={toggleMasterMute}
            className={`w-full mt-1.5 py-1.5 rounded text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 border-2 ${
              masterAudio.isMuted
                ? 'bg-red-600 border-red-400 text-white shadow-md shadow-red-600/50'
                : 'bg-[#231b22] border-red-900/60 text-red-200 hover:bg-[#30212a]'
            }`}
          >
            {masterAudio.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-red-400" />}
            <span>{masterAudio.isMuted ? 'MUTE ON' : 'MAIN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
