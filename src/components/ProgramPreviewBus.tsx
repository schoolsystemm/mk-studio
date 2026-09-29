/**
 * MK VISION - Program & Preview Cross-Point Bus
 * Broadcast Standard Tactile Buttons with RED (Program) and GREEN (Preview) Tallies
 * By Melton Konchella
 */

import React from 'react';
import { useSwitcher } from '../context/SwitcherContext.js';

interface ProgramPreviewBusProps {
  compact?: boolean;
}

export const ProgramPreviewBus: React.FC<ProgramPreviewBusProps> = ({ compact = false }) => {
  const { switcherState, setProgram, setPreview, role } = useSwitcher();

  const programSceneId = switcherState?.programSceneId || 'cam1';
  const previewSceneId = switcherState?.previewSceneId || 'cam2';
  const isTransitioning = switcherState?.isTransitioning || false;
  const cameraSources = switcherState?.cameraSources || [
    { id: 'cam1', label: 'CAM 1', description: 'Stage Wide' },
    { id: 'cam2', label: 'CAM 2', description: 'Speaker Close' },
    { id: 'cam3', label: 'CAM 3', description: 'Altar Center' },
    { id: 'cam4', label: 'CAM 4', description: 'Choir & Music' },
    { id: 'cam5', label: 'CAM 5', description: 'Congregation' },
    { id: 'cam6', label: 'CAM 6', description: 'Balcony Angle' },
    { id: 'cam7', label: 'CAM 7', description: 'Slides & Media' },
    { id: 'cam8', label: 'CAM 8', description: 'Lower Graphics' },
  ];

  const isReadOnly = role === 'observer';

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#151821] rounded-lg border border-[#232838] shadow-inner">
      {/* PROGRAM BUS (RED TALLY) */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/80 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-red-400 uppercase">
              PROGRAM BUS
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              (ON-AIR LIVE BROADCAST)
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
            {cameraSources.find((c) => c.id === programSceneId)?.label || programSceneId.toUpperCase()} LIVE
          </span>
        </div>

        {/* 8 Program Cross-Point Buttons */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {cameraSources.map((cam, idx) => {
            const isLive = programSceneId === cam.id;
            const isStagedInTransition = isTransitioning && previewSceneId === cam.id;

            return (
              <button
                key={`pgm-${cam.id}`}
                disabled={isReadOnly}
                onClick={() => setProgram(cam.id)}
                className={`group relative flex flex-col items-center justify-between p-2 rounded transition-all duration-100 select-none border text-center ${
                  compact ? 'h-16' : 'h-20'
                } ${
                  isLive
                    ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400 text-white shadow-lg shadow-red-600/40 translate-y-0.5'
                    : isStagedInTransition
                    ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400 text-white animate-pulse'
                    : 'bg-[#1b202c] hover:bg-[#222938] active:bg-[#161a24] border-[#2e374d] text-slate-300 hover:border-slate-500'
                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {/* Top Tally Lamp Strip */}
                <div
                  className={`w-full h-1.5 rounded-sm mb-1 transition-all ${
                    isLive
                      ? 'bg-red-300 shadow-[0_0_8px_#ef4444]'
                      : isStagedInTransition
                      ? 'bg-amber-300 shadow-[0_0_8px_#f59e0b]'
                      : 'bg-slate-700/50'
                  }`}
                />

                {/* Camera Name */}
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight leading-none">
                  {cam.label}
                </span>

                {/* Description Subtext */}
                <span
                  className={`text-[10px] leading-tight truncate w-full px-0.5 font-medium ${
                    isLive ? 'text-red-100' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {cam.description}
                </span>

                {/* Live Indicator / Direct Cut Hint */}
                <div className="w-full flex items-center justify-center mt-1">
                  {isLive ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-red-950/80 text-red-200 px-1.5 py-0.2 rounded border border-red-400/40">
                      ON AIR
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-400 opacity-60 group-hover:opacity-100">
                      CUT
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PREVIEW BUS (GREEN TALLY) */}
      <div className="pt-2 border-t border-[#222736]">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/80" />
            <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase">
              PREVIEW BUS
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              (STAGED FOR NEXT TRANSITION)
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            {cameraSources.find((c) => c.id === previewSceneId)?.label || previewSceneId.toUpperCase()} READY
          </span>
        </div>

        {/* 8 Preview Cross-Point Buttons */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {cameraSources.map((cam, idx) => {
            const isStaged = previewSceneId === cam.id;

            return (
              <button
                key={`pvw-${cam.id}`}
                disabled={isReadOnly}
                onClick={() => setPreview(cam.id)}
                className={`group relative flex flex-col items-center justify-between p-2 rounded transition-all duration-100 select-none border text-center ${
                  compact ? 'h-16' : 'h-20'
                } ${
                  isStaged
                    ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-400 text-white shadow-lg shadow-emerald-600/40 translate-y-0.5'
                    : 'bg-[#1b202c] hover:bg-[#222938] active:bg-[#161a24] border-[#2e374d] text-slate-300 hover:border-slate-500'
                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {/* Top Tally Lamp Strip */}
                <div
                  className={`w-full h-1.5 rounded-sm mb-1 transition-all ${
                    isStaged ? 'bg-emerald-300 shadow-[0_0_8px_#10b981]' : 'bg-slate-700/50'
                  }`}
                />

                {/* Camera Name */}
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight leading-none">
                  {cam.label}
                </span>

                {/* Description Subtext */}
                <span
                  className={`text-[10px] leading-tight truncate w-full px-0.5 font-medium ${
                    isStaged ? 'text-emerald-100' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {cam.description}
                </span>

                {/* Hotkey hint */}
                <div className="w-full flex items-center justify-center mt-1">
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold ${
                      isStaged
                        ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-400/40'
                        : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                    }`}
                  >
                    KEY [{idx + 1}]
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
