/**
 * MK VISION - Secure Session Share & QR Code Pairing
 * Short-lived invitation tokens with role-based QR code pairing
 * By Melton Konchella
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Shield, Users, QrCode } from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

interface SessionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionShareModal: React.FC<SessionShareModalProps> = ({ isOpen, onClose }) => {
  const { sessionId, sessionName, createInviteToken, role } = useSwitcher();
  const [inviteToken, setInviteToken] = useState<string>('');
  const [targetRole, setTargetRole] = useState<'operator' | 'observer'>('operator');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchToken = async () => {
      setLoading(true);
      try {
        const token = await createInviteToken(targetRole);
        if (isMounted) {
          setInviteToken(token);
        }
      } catch (e) {
        console.warn('Could not generate invite token:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId, targetRole, createInviteToken]);

  if (!isOpen) return null;

  // Build join URL with token
  const joinUrl = `${window.location.origin}?invite=${encodeURIComponent(inviteToken)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteToken || sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#141720] border border-[#2c3345] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252b3b] bg-[#10131a]">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide">
                PAIR REMOTE CONTROL SURFACE
              </h2>
              <p className="text-xs text-slate-400">
                Scan QR code from phone/tablet to join production
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

        {/* Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          {/* Target Role Selector */}
          <div className="w-full flex items-center justify-center gap-2 bg-[#1b202c] p-1 rounded-lg border border-[#273042]">
            <button
              onClick={() => setTargetRole('operator')}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all ${
                targetRole === 'operator'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OPERATOR (FULL CONTROL)
            </button>
            <button
              onClick={() => setTargetRole('observer')}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all ${
                targetRole === 'observer'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OBSERVER (READ ONLY)
            </button>
          </div>

          {/* QR Code Canvas */}
          <div className="p-4 bg-white rounded-xl shadow-lg border-2 border-slate-300">
            {inviteToken ? (
              <QRCodeSVG
                value={joinUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#090d16"
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-400 text-xs">
                Generating Secure Token...
              </div>
            )}
          </div>

          <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
            Open camera on Android or iPhone to instantly open MK VISION in operator mode.
          </p>

          {/* Direct Session Code & Link */}
          <div className="w-full space-y-2 pt-2 border-t border-[#232a3a]">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>INVITE TOKEN (EXPIRES IN 1 HOUR)</span>
              <span className="text-emerald-400">ENCRYPTED</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteToken || sessionId}
                className="flex-1 px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs font-mono text-slate-200 focus:outline-none"
              />
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-2 rounded bg-[#1b2230] hover:bg-[#232c3f] border border-[#2d374d] text-amber-300 hover:text-amber-200 text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>COPY FULL PAIRING URL</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#252b3b] bg-[#10131a] flex justify-between items-center text-[11px] text-slate-500 font-mono">
          <span>NO PASSWORDS STORED IN QR</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
