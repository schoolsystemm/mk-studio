/**
 * MK VISION - Transition Control Panel
 * DSK 1, AUTO TAKE, Tactile T-BAR, and Multi-Device CUT Protection
 * By Melton Konchella
 */

import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeftRight, Layers, Play, Zap, ShieldCheck } from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

interface TransitionControlProps {
  compact?: boolean;
}

export const TransitionControl: React.FC<TransitionControlProps> = ({ compact = false }) => {
  const { switcherState, cut, autoTake, setTBar, toggleDsk, role } = useSwitcher();

  const isTransitioning = switcherState?.isTransitioning || false;
  const transitionProgress = switcherState?.transitionProgress || 0;
  const dskActive = switcherState?.dskActive || false;
  const dskSourceName = switcherState?.dskSourceName || 'Lower Third Graphics';
  const transitionDuration = switcherState?.transitionDuration || 300;
  const transitionType = switcherState?.transitionType || 'Cut';

  const [selectedDuration, setSelectedDuration] = useState<number>(transitionDuration);
  const isReadOnly = role === 'observer';

  // T-Bar dragging ref & state
  const tbarTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingTBar, setIsDraggingTBar] = useState(false);

  const handleTBarMove = (clientY: number) => {
    if (!tbarTrackRef.current) return;
    const rect = tbarTrackRef.current.getBoundingClientRect();
    // In broadcast switchers, top is 0% and bottom is 100% (or vice-versa)
    const relativeY = clientY - rect.top;
    const progress = Math.max(0, Math.min(1, relativeY / rect.height));
    setTBar(progress);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    setIsDraggingTBar(true);
    handleTBarMove(e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTBar) {
        handleTBarMove(e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingTBar) {
        setIsDraggingTBar(false);
      }
    };

    if (isDraggingTBar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTBar]);

  // Touch handling for mobile/tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isReadOnly) return;
    setIsDraggingTBar(true);
    if (e.touches[0]) {
      handleTBarMove(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingTBar && e.touches[0]) {
      handleTBarMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingTBar(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#151821] p-3 rounded-lg border border-[#232838] shadow-inner select-none justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#222736]">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            TRANSITION
          </span>
        </div>
        <div className="flex items-center gap-1">
          {[300, 500, 1000].map((dur) => (
            <button
              key={dur}
              disabled={isReadOnly}
              onClick={() => setSelectedDuration(dur)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                selectedDuration === dur
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {(dur / 1000).toFixed(1)}s
            </button>
          ))}
        </div>
      </div>

      {/* DSK 1 (Downstream Keyer) */}
      <div className="my-2">
        <button
          disabled={isReadOnly}
          onClick={() => toggleDsk()}
          className={`w-full py-2.5 px-3 rounded flex items-center justify-between border transition-all ${
            dskActive
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400 text-white shadow-md shadow-amber-600/30'
              : 'bg-[#1c212e] hover:bg-[#232938] border-[#2f384d] text-slate-300'
          } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
        >
          <div className="flex items-center gap-2">
            <Layers className={`w-4 h-4 ${dskActive ? 'text-amber-100' : 'text-slate-400'}`} />
            <div className="text-left leading-tight">
              <div className="font-mono font-bold text-xs">DSK 1</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{dskSourceName}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dskActive ? 'bg-amber-300 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'
              }`}
            />
            <span className="text-[11px] font-mono font-bold">{dskActive ? 'ON AIR' : 'OFF'}</span>
          </div>
        </button>
      </div>

      {/* AUTO TAKE Button */}
      <div className="my-1.5">
        <button
          disabled={isReadOnly || isTransitioning}
          onClick={() => autoTake(selectedDuration)}
          className={`w-full py-3 px-4 rounded border text-center transition-all flex items-center justify-center gap-2 ${
            isTransitioning
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-300 animate-pulse shadow-lg shadow-amber-500/30'
              : 'bg-gradient-to-b from-[#242b3d] to-[#1a1f2c] hover:from-[#2c354a] hover:to-[#202737] border-[#38435d] text-amber-300 hover:text-amber-200'
          } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
        >
          <Play className={`w-4 h-4 fill-current ${isTransitioning ? 'animate-bounce' : ''}`} />
          <div className="leading-none text-left">
            <span className="font-mono font-bold text-sm tracking-wide block">
              {isTransitioning ? 'TRANSITIONING...' : 'AUTO TAKE'}
            </span>
            <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
              [SPACEBAR] · {(selectedDuration / 1000).toFixed(1)}s
            </span>
          </div>
        </button>
      </div>

      {/* T-BAR MANUAL FADER */}
      <div className="flex-1 flex flex-col items-center justify-center my-2 p-2 bg-[#101217] rounded border border-[#1f2430]">
        <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1 px-1">
          <span>T-BAR MANUAL</span>
          <span className="text-amber-400 font-bold tabular-nums">
            {Math.round(transitionProgress * 100)}%
          </span>
        </div>

        {/* Fader Track */}
        <div
          ref={tbarTrackRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-12 h-32 sm:h-36 bg-[#0a0c0f] rounded border border-[#2b3140] flex justify-center cursor-pointer shadow-inner touch-none"
        >
          {/* Center Groove Guide */}
          <div className="absolute top-2 bottom-2 w-1.5 bg-[#171a22] rounded-full" />

          {/* Progress fill */}
          <div
            className="absolute top-2 w-1.5 bg-amber-500 rounded-full transition-all duration-75"
            style={{ height: `${transitionProgress * 88}%` }}
          />

          {/* Tactical T-Bar Handle */}
          <div
            className={`absolute w-14 h-7 -left-1 rounded bg-gradient-to-b from-slate-200 via-slate-400 to-slate-500 border border-white/60 shadow-md flex items-center justify-center transition-transform duration-75 ${
              isDraggingTBar ? 'scale-105 shadow-amber-500/30' : ''
            }`}
            style={{
              top: `calc(${transitionProgress * 76}% + 4px)`,
            }}
          >
            {/* Textured Grip Ridges */}
            <div className="flex gap-1">
              <div className="w-0.5 h-3.5 bg-slate-600 rounded-full" />
              <div className="w-0.5 h-3.5 bg-slate-600 rounded-full" />
              <div className="w-0.5 h-3.5 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>

        <div className="w-full text-center text-[9px] font-mono text-slate-400 mt-1">
          0% PROGRAM ➔ 100% PREVIEW
        </div>
      </div>

      {/* HARDWARE CUT BUTTON (PROTECTED) */}
      <div className="mt-1">
        <button
          disabled={isReadOnly || isTransitioning}
          onClick={cut}
          className={`w-full py-4 px-4 rounded-lg font-mono font-black text-lg tracking-widest uppercase transition-all duration-75 border-2 shadow-xl ${
            isTransitioning
              ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-b from-red-600 via-red-700 to-red-900 border-red-400 text-white hover:from-red-500 hover:to-red-800 active:translate-y-1 active:border-red-300 shadow-red-700/40 cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-center gap-2 leading-none">
            <Zap className="w-5 h-5 fill-current" />
            <span>CUT</span>
          </div>
          <span className="text-[10px] font-normal tracking-normal text-red-200 block mt-1">
            {isTransitioning ? 'LOCKED (IN PROGRESS)' : 'IMMEDIATE TRANSITION [KEY X]'}
          </span>
        </button>
      </div>
    </div>
  );
};
