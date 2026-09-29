/**
 * MK VISION - Authentication & Production Session Selector
 * Register, Login, Device Registration, and Session Switching
 * By Melton Konchella
 */

import React, { useState } from 'react';
import {
  User as UserIcon,
  X,
  Lock,
  Mail,
  Shield,
  Plus,
  Radio,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'auth' | 'sessions';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'auth',
}) => {
  const {
    user,
    device,
    sessionId,
    login,
    registerUser,
    logout,
    createSession,
    joinSession,
    error,
    clearError,
  } = useSwitcher();

  const [tab, setTab] = useState<'auth' | 'sessions'>(defaultTab);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form states
  const [email, setEmail] = useState('konchellamelton@gmail.com');
  const [password, setPassword] = useState('Switcher2026!');
  const [name, setName] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Session forms
  const [newSessionName, setNewSessionName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setStatusMsg(null);

    if (isRegisterMode) {
      if (!name.trim()) {
        setStatusMsg('Please enter your full name');
        return;
      }
      const ok = await registerUser(name.trim(), email.trim(), password);
      if (ok) {
        setStatusMsg('Account created successfully!');
        setIsRegisterMode(false);
      }
    } else {
      const ok = await login(email.trim(), password);
      if (ok) {
        setStatusMsg('Logged in successfully!');
        setTimeout(() => onClose(), 800);
      }
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      await createSession(newSessionName.trim());
      setStatusMsg(`Created session "${newSessionName}"!`);
      setNewSessionName('');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to create session');
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    const ok = await joinSession(joinCode.trim());
    if (ok) {
      setStatusMsg('Joined production session!');
      setJoinCode('');
      setTimeout(() => onClose(), 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#141720] border border-[#2c3345] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252b3b] bg-[#10131a]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide">
                AUTHENTICATION & SESSIONS
              </h2>
              <p className="text-xs text-slate-400">
                MK VISION Switcher Access & Control Rights
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

        {/* Tab Bar */}
        <div className="flex border-b border-[#222838] bg-[#11141c]">
          <button
            onClick={() => setTab('auth')}
            className={`flex-1 py-2.5 text-xs font-mono font-bold transition-colors border-b-2 ${
              tab === 'auth'
                ? 'border-amber-400 text-amber-300 bg-[#161a24]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            OPERATOR ACCOUNT
          </button>
          <button
            onClick={() => setTab('sessions')}
            className={`flex-1 py-2.5 text-xs font-mono font-bold transition-colors border-b-2 ${
              tab === 'sessions'
                ? 'border-amber-400 text-amber-300 bg-[#161a24]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PRODUCTION SESSIONS
          </button>
        </div>

        {/* Notifications */}
        {(error || statusMsg) && (
          <div
            className={`mx-5 mt-3 px-3 py-2 rounded text-xs font-mono flex items-center gap-2 ${
              error
                ? 'bg-red-950/40 border border-red-500/40 text-red-300'
                : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
            }`}
          >
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{error || statusMsg}</span>
          </div>
        )}

        <div className="p-5 flex-1 overflow-y-auto">
          {tab === 'auth' ? (
            <div className="space-y-4">
              {user ? (
                /* Logged in state */
                <div className="p-4 rounded-lg bg-[#181d28] border border-[#273244] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-sm">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 text-sm">{user.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      className="px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs font-mono font-medium transition-colors flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#232c3d] flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>ACTIVE SURFACE:</span>
                    <span className="text-amber-300">{device?.name || 'Windows'}</span>
                  </div>
                </div>
              ) : (
                /* Login / Register Form */
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {isRegisterMode && (
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        OPERATOR FULL NAME
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Melton Konchella"
                          className="w-full pl-9 pr-3 py-2 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">
                      EMAIL ADDRESS
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operator@studio.com"
                        className="w-full pl-9 pr-3 py-2 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">
                      PASSWORD
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-colors shadow-md mt-2"
                  >
                    {isRegisterMode ? 'CREATE OPERATOR ACCOUNT' : 'LOGIN TO MK VISION'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRegisterMode(!isRegisterMode)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-mono underline"
                    >
                      {isRegisterMode
                        ? 'Already have an account? Sign in'
                        : "Don't have an account? Register new operator"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Sessions Tab */
            <div className="space-y-4">
              {/* Create Session */}
              <form onSubmit={handleCreateSession} className="p-3 rounded-lg bg-[#181d28] border border-[#273244] space-y-2">
                <div className="text-xs font-mono font-bold text-slate-200 uppercase">
                  CREATE NEW PRODUCTION SESSION
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. KU TV Production or Sunday Service"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono transition-colors"
                  >
                    CREATE
                  </button>
                </div>
              </form>

              {/* Join via Code */}
              <form onSubmit={handleJoinSession} className="p-3 rounded-lg bg-[#181d28] border border-[#273244] space-y-2">
                <div className="text-xs font-mono font-bold text-slate-200 uppercase">
                  JOIN VIA SESSION CODE OR TOKEN
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter code or inv-..."
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs font-mono transition-colors"
                  >
                    JOIN
                  </button>
                </div>
              </form>

              <div className="text-[11px] text-slate-500 font-mono text-center">
                CURRENT SESSION: <span className="text-slate-300">{sessionId}</span>
              </div>
            </div>
          )}
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
