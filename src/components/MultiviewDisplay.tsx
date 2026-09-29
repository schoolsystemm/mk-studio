/**
 * MK VISION - Broadcast Multiview Production Display
 * Authentic SDI Studio Monitors: PREVIEW (Left / Green Staged) & PROGRAM (Right / Red On-Air)
 * By Melton Konchella
 */

import React, { useEffect, useState } from 'react';
import { useSwitcher } from '../context/SwitcherContext.js';

export const MultiviewDisplay: React.FC = () => {
  const { switcherState } = useSwitcher();

  const programSceneId = switcherState?.programSceneId || 'cam1';
  const previewSceneId = switcherState?.previewSceneId || 'cam2';
  const isTransitioning = switcherState?.isTransitioning || false;
  const transitionProgress = switcherState?.transitionProgress || 0;
  const dskActive = switcherState?.dskActive || false;
  const obsConnected = switcherState?.obsConnected || false;
  const cameraSources = switcherState?.cameraSources || [];

  const programCam = cameraSources.find((c) => c.id === programSceneId) || {
    id: 'cam1',
    label: 'CAM 1',
    obsSceneName: 'Camera 1 - Wide',
    description: 'Stage Wide',
  };
  const previewCam = cameraSources.find((c) => c.id === previewSceneId) || {
    id: 'cam2',
    label: 'CAM 2',
    obsSceneName: 'Camera 2 - Pulpit',
    description: 'Speaker Close',
  };

  // Broadcast SDI timecode generator
  const [timecode, setTimecode] = useState('00:00:00:00');
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const frames = String(Math.floor((now.getMilliseconds() / 1000) * 30)).padStart(2, '0');
      setTimecode(`${hrs}:${mins}:${secs}:${frames}`);
    }, 33);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2.5 bg-[#0e1015] rounded-lg border border-[#1f2430]">
      {/* 1. PREVIEW SDI MONITOR (STAGED / GREEN TALLY) - LEFT */}
      <div className="flex flex-col">
        {/* Monitor Header Band */}
        <div className="flex items-center justify-between px-2.5 py-1 bg-[#101915] border-t border-x border-emerald-700/60 rounded-t text-xs font-mono select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span className="font-black text-emerald-400 tracking-wider">PREVIEW NEXT</span>
            <span className="text-[10px] text-slate-400">· 1080p59.94</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 tabular-nums">
            <span className="text-emerald-400 font-bold">STAGED</span>
            <span>NEXT TRANSITION</span>
          </div>
        </div>

        {/* Video Screen Viewport */}
        <div className="relative aspect-video w-full bg-[#050608] rounded-b border-2 border-emerald-600 overflow-hidden shadow-2xl flex items-center justify-center">
          {/* SMPTE Broadcast Pattern Backdrop */}
          <div className="absolute inset-0 flex flex-col opacity-30">
            <div className="flex flex-1 w-full">
              <div className="flex-1 bg-[#c0c0c0]" />
              <div className="flex-1 bg-[#c0c000]" />
              <div className="flex-1 bg-[#00c0c0]" />
              <div className="flex-1 bg-[#00c000]" />
              <div className="flex-1 bg-[#c000c0]" />
              <div className="flex-1 bg-[#c00000]" />
              <div className="flex-1 bg-[#0000c0]" />
            </div>
            <div className="h-1/4 w-full flex">
              <div className="flex-1 bg-[#0000c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#c000c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#00c0c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#c0c0c0]" />
            </div>
          </div>

          {/* Broadcast Safe Area Reticle */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[5%] border border-white/10" />
            <div className="absolute inset-[10%] border border-dashed border-white/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
            </div>
          </div>

          {/* Preview Information Plaque */}
          <div className="relative z-10 text-center px-4 py-2 bg-black/75 rounded border border-white/10 backdrop-blur-sm shadow-xl">
            <div className="font-mono font-black text-xl text-white tracking-widest uppercase">
              {previewCam.label}
            </div>
            <div className="text-xs font-mono font-medium text-emerald-300 tracking-wide mt-0.5">
              {previewCam.obsSceneName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {previewCam.description}
            </div>
          </div>

          {/* Top-Left PREVIEW Tally Banner */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold tracking-widest shadow uppercase">
            PREVIEW
          </div>

          {/* Bottom-Right Audio Channel Telemetry */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 border border-white/10 font-mono text-[9px] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CH 1/2</span>
          </div>
        </div>
      </div>

      {/* 2. PROGRAM SDI MONITOR (ON-AIR / RED TALLY) - RIGHT */}
      <div className="flex flex-col">
        {/* Monitor Header Band */}
        <div className="flex items-center justify-between px-2.5 py-1 bg-[#171114] border-t border-x border-red-700/60 rounded-t text-xs font-mono select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#dc2626]" />
            <span className="font-black text-red-400 tracking-wider">PROGRAM OUT</span>
            <span className="text-[10px] text-slate-400">· 1080p59.94</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 tabular-nums">
            <span className="text-red-400 font-bold">{obsConnected ? 'OBS LINKED' : 'OBS STANDBY'}</span>
            <span>TC {timecode}</span>
          </div>
        </div>

        {/* Video Screen Viewport */}
        <div className="relative aspect-video w-full bg-[#050608] rounded-b border-2 border-red-600 overflow-hidden shadow-2xl flex items-center justify-center">
          {/* SMPTE Broadcast Pattern Backdrop */}
          <div className="absolute inset-0 flex flex-col opacity-35">
            {/* Top 75% Color Bars */}
            <div className="flex flex-1 w-full">
              <div className="flex-1 bg-[#c0c0c0]" />
              <div className="flex-1 bg-[#c0c000]" />
              <div className="flex-1 bg-[#00c0c0]" />
              <div className="flex-1 bg-[#00c000]" />
              <div className="flex-1 bg-[#c000c0]" />
              <div className="flex-1 bg-[#c00000]" />
              <div className="flex-1 bg-[#0000c0]" />
            </div>
            {/* Bottom 25% Calibration Pluge */}
            <div className="h-1/4 w-full flex">
              <div className="flex-1 bg-[#0000c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#c000c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#00c0c0]" />
              <div className="flex-1 bg-[#131313]" />
              <div className="flex-1 bg-[#c0c0c0]" />
            </div>
          </div>

          {/* Broadcast Safe Area Reticle (90% Action / 80% Title) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 90% Safe Action Border */}
            <div className="absolute inset-[5%] border border-white/10" />
            {/* 80% Safe Title Border */}
            <div className="absolute inset-[10%] border border-dashed border-white/10" />
            {/* Center Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
            </div>
          </div>

          {/* Program Information Plaque */}
          <div className="relative z-10 text-center px-4 py-2 bg-black/75 rounded border border-white/10 backdrop-blur-sm shadow-xl">
            <div className="font-mono font-black text-xl text-white tracking-widest uppercase">
              {programCam.label}
            </div>
            <div className="text-xs font-mono font-medium text-red-300 tracking-wide mt-0.5">
              {programCam.obsSceneName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {programCam.description}
            </div>
          </div>

          {/* Active Transition Wipe / Progress Overlay */}
          {isTransitioning && (
            <div
              className="absolute inset-0 bg-emerald-950/80 border-r-2 border-amber-400 flex items-center justify-center transition-all backdrop-blur-[1px]"
              style={{ width: `${transitionProgress * 100}%` }}
            >
              <div className="bg-black/90 px-3 py-1 rounded border border-amber-400 text-amber-300 font-mono text-xs font-bold tracking-widest uppercase">
                TAKE ➔ {previewCam.label}
              </div>
            </div>
          )}

          {/* DSK Lower Third Graphic Bug */}
          {dskActive && (
            <div className="absolute bottom-3 left-4 right-4 p-2 bg-[#121622]/95 border-l-4 border-amber-400 rounded-r shadow-2xl flex items-center justify-between">
              <div>
                <div className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                  MK VISION BROADCAST
                </div>
                <div className="text-[10px] text-amber-300 font-mono">
                  {switcherState?.dskSourceName || 'Lower Third Graphics'} · ON-AIR
                </div>
              </div>
              <div className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-black text-[9px]">
                DSK 1
              </div>
            </div>
          )}

          {/* Top-Left ON AIR Tally Banner */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold tracking-widest shadow uppercase">
            ON AIR
          </div>

          {/* Bottom-Right Audio Channel Telemetry Dots */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 border border-white/10 font-mono text-[9px] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CH 1/2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
