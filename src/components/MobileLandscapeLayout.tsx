/**
 * MK VISION - Dedicated Mobile Landscape Control Surface
 * Ergonomic high-density touch layout for phone and small tablet operators
 * By Melton Konchella
 */

import React, { useState } from 'react';
import { Play, Zap, Layers, Volume2, VolumeX, Shield, Users, Radio, Disc } from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

export const MobileLandscapeLayout: React.FC = () => {
  const {
    switcherState,
    audioTelemetry,
    setProgram,
    setPreview,
    cut,
    autoTake,
    setTBar,
    toggleDsk,
    setMasterVolume,
    toggleMasterMute,
    role,
  } = useSwitcher();

  const programSceneId = switcherState?.programSceneId || 'cam1';
  const previewSceneId = switcherState?.previewSceneId || 'cam2';
  const isTransitioning = switcherState?.isTransitioning || false;
  const transitionProgress = switcherState?.transitionProgress || 0;
  const dskActive = switcherState?.dskActive || false;
  const cameraSources = switcherState?.cameraSources || [];
  const masterAudio = switcherState?.masterAudio || { db: -4, isMuted: false, peak: -10, isClipping: false };
  const isReadOnly = role === 'observer';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0f14] text-slate-100 select-none overflow-hidden p-1.5 touch-none">
      {/* Micro Status Bar */}
      <div className="h-6 flex items-center justify-between px-2 text-[10px] font-mono text-slate-400 bg-[#12141a] rounded mb-1 border border-[#222736]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-200">MK VISION MOBILE</span>
          <span className="text-amber-400">· {switcherState?.sessionName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${switcherState?.obsConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{switcherState?.obsConnected ? 'OBS LIVE' : 'OBS OFFLINE'}</span>
          </div>
          <span className="text-red-400 font-bold">PGM: {programSceneId.toUpperCase()}</span>
          <span className="text-emerald-400 font-bold">PVW: {previewSceneId.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Switcher Split: Left (PGM/PVW 8-way Cross-point) + Right (Cut/Auto/T-Bar/Master) */}
      <div className="flex-1 grid grid-cols-12 gap-1.5 min-h-0">
        {/* Left 8 Cols: Cross-Point Buses */}
        <div className="col-span-8 flex flex-col justify-between gap-1 bg-[#141720] p-1.5 rounded-lg border border-[#242c3d]">
          {/* PROGRAM BUS (RED) */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[9px] font-mono text-red-400 font-bold px-1 mb-0.5">
              <span>PROGRAM (ON AIR)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 h-full">
              {cameraSources.slice(0, 8).map((cam) => {
                const isLive = programSceneId === cam.id;
                return (
                  <button
                    key={`mob-pgm-${cam.id}`}
                    disabled={isReadOnly}
                    onClick={() => setProgram(cam.id)}
                    className={`rounded flex flex-col items-center justify-center border font-mono font-bold transition-all text-xs active:scale-95 ${
                      isLive
                        ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400 text-white shadow-md shadow-red-700/50'
                        : 'bg-[#1c222e] border-[#2d384c] text-slate-300'
                    }`}
                  >
                    <span className="text-[11px] leading-tight">{cam.label}</span>
                    <span className="text-[8px] text-slate-400 font-normal truncate max-w-full px-0.5">
                      {cam.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PREVIEW BUS (GREEN) */}
          <div className="flex-1 flex flex-col justify-center pt-1 border-t border-[#222838]">
            <div className="flex items-center justify-between text-[9px] font-mono text-emerald-400 font-bold px-1 mb-0.5">
              <span>PREVIEW (NEXT)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 h-full">
              {cameraSources.slice(0, 8).map((cam) => {
                const isStaged = previewSceneId === cam.id;
                return (
                  <button
                    key={`mob-pvw-${cam.id}`}
                    disabled={isReadOnly}
                    onClick={() => setPreview(cam.id)}
                    className={`rounded flex flex-col items-center justify-center border font-mono font-bold transition-all text-xs active:scale-95 ${
                      isStaged
                        ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-400 text-white shadow-md shadow-emerald-700/50'
                        : 'bg-[#1c222e] border-[#2d384c] text-slate-300'
                    }`}
                  >
                    <span className="text-[11px] leading-tight">{cam.label}</span>
                    <span className="text-[8px] text-slate-400 font-normal truncate max-w-full px-0.5">
                      {cam.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Hardware Controls (CUT, AUTO TAKE, DSK, MASTER) */}
        <div className="col-span-4 flex flex-col justify-between gap-1.5 bg-[#141720] p-1.5 rounded-lg border border-[#242c3d]">
          {/* Top Row: DSK & Master Volume */}
          <div className="flex gap-1.5">
            {/* DSK Toggle */}
            <button
              disabled={isReadOnly}
              onClick={() => toggleDsk()}
              className={`flex-1 py-1 px-1.5 rounded border text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all ${
                dskActive
                  ? 'bg-amber-600 border-amber-400 text-white shadow'
                  : 'bg-[#1b202c] border-[#2a3447] text-slate-300'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>DSK: {dskActive ? 'ON' : 'OFF'}</span>
            </button>

            {/* Master Mute */}
            <button
              disabled={isReadOnly}
              onClick={toggleMasterMute}
              className={`flex-1 py-1 px-1.5 rounded border text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all ${
                masterAudio.isMuted
                  ? 'bg-red-600 border-red-400 text-white shadow'
                  : 'bg-[#1b202c] border-[#2a3447] text-slate-300'
              }`}
            >
              {masterAudio.isMuted ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-red-400" />}
              <span>{masterAudio.isMuted ? 'MUTED' : 'MSTR'}</span>
            </button>
          </div>

          {/* AUTO TAKE Button */}
          <button
            disabled={isReadOnly || isTransitioning}
            onClick={() => autoTake()}
            className={`py-2 rounded font-mono font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
              isTransitioning
                ? 'bg-amber-500 border-amber-300 text-slate-950 animate-pulse'
                : 'bg-gradient-to-b from-[#262e40] to-[#1c2230] border-[#37445e] text-amber-300 active:bg-amber-600 active:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isTransitioning ? 'TRANSITION' : 'AUTO TAKE'}</span>
          </button>

          {/* Large Tactile CUT Button */}
          <button
            disabled={isReadOnly || isTransitioning}
            onClick={cut}
            className={`flex-1 rounded font-mono font-black text-xl tracking-widest uppercase border-2 transition-all flex items-center justify-center gap-2 active:scale-98 ${
              isTransitioning
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-b from-red-600 via-red-700 to-red-900 border-red-400 text-white shadow-lg shadow-red-700/50'
            }`}
          >
            <Zap className="w-6 h-6 fill-current" />
            <span>CUT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
