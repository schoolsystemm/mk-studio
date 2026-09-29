/**
 * MK VISION - Connection & Revocation Safety Shield
 * Prevents phantom commands when network is interrupted
 * By Melton Konchella
 */

import React from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

export const ReconnectingOverlay: React.FC = () => {
  const { connectionStatus, revocationReason } = useSwitcher();

  if (connectionStatus === 'connected') return null;

  if (connectionStatus === 'revoked') {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
        <div className="max-w-md w-full bg-[#181216] border-2 border-red-600/80 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>

          <div>
            <h2 className="text-lg font-black font-mono text-red-400 tracking-wider uppercase">
              DEVICE REVOKED
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {revocationReason || 'This control surface was revoked by the production owner and can no longer command the switcher.'}
            </p>
          </div>

          <div className="p-3 bg-red-950/40 rounded border border-red-800/40 text-[11px] font-mono text-red-300">
            Contact your production supervisor to re-authorize this device.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 text-center select-none animate-in fade-in duration-150">
      <div className="max-w-md w-full bg-[#13161f] border border-[#2d364a] rounded-xl p-6 shadow-2xl space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        </div>

        <div>
          <h2 className="text-base font-bold font-mono text-amber-400 tracking-wider uppercase">
            RECONNECTING TO SWITCHER ENGINE
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Network link temporarily interrupted. Controls are locked for safety while synchronizing authoritative state.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Restoring state version...</span>
        </div>
      </div>
    </div>
  );
};
