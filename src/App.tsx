/**
 * MK VISION - Professional Digital Production Switcher
 * OBS-Controlled Software Switcher + Multi-Device Production System
 * Master Control Surface Component
 * By Melton Konchella
 */

import React, { useState, useEffect } from 'react';
import { SwitcherProvider, useSwitcher } from './context/SwitcherContext.js';
import { TopBar } from './components/TopBar.js';
import { MultiviewDisplay } from './components/MultiviewDisplay.js';
import { ProgramPreviewBus } from './components/ProgramPreviewBus.js';
import { TransitionControl } from './components/TransitionControl.js';
import { AudioMixer } from './components/AudioMixer.js';
import { DeviceManagerModal } from './components/DeviceManagerModal.js';
import { SessionShareModal } from './components/SessionShareModal.js';
import { ObsSettingsModal } from './components/ObsSettingsModal.js';
import { AuthModal } from './components/AuthModal.js';
import { MobileLandscapeLayout } from './components/MobileLandscapeLayout.js';
import { ReconnectingOverlay } from './components/ReconnectingOverlay.js';
import { Smartphone, Monitor } from 'lucide-react';

const SwitcherSurface: React.FC = () => {
  const {
    switcherState,
    setPreview,
    cut,
    autoTake,
    toggleDsk,
    toggleMasterMute,
    joinSession,
    role,
  } = useSwitcher();

  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'auth' | 'sessions'>('auth');
  const [isMobileMode, setIsMobileMode] = useState(false);

  // Auto-detect mobile orientation or screen size
  useEffect(() => {
    const checkOrientation = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNarrowLandscape = window.innerHeight < 520 && window.innerWidth > 500;
      if (isTouch && isNarrowLandscape) {
        setIsMobileMode(true);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Check URL query parameters for invite tokens (QR code scanner entry)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invite = urlParams.get('invite');
    if (invite) {
      console.log('[MK VISION] Detected invite token in URL, joining session...');
      joinSession(invite);
      // Clean query string from browser bar without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [joinSession]);

  // Section 47: Hardware Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts while user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (role === 'observer') return;

      const key = e.key.toUpperCase();

      // Number keys 1-8: Preview CAM 1-8
      if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
        e.preventDefault();
        const camId = `cam${key}`;
        setPreview(camId);
        return;
      }

      // Spacebar: AUTO TAKE
      if (e.code === 'Space') {
        e.preventDefault();
        autoTake();
        return;
      }

      // 'X': CUT
      if (key === 'X') {
        e.preventDefault();
        cut();
        return;
      }

      // 'D': DSK Toggle
      if (key === 'D') {
        e.preventDefault();
        toggleDsk();
        return;
      }

      // 'M': Master Mute Toggle
      if (key === 'M') {
        e.preventDefault();
        toggleMasterMute();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPreview, cut, autoTake, toggleDsk, toggleMasterMute, role]);

  if (isMobileMode) {
    return (
      <div className="relative">
        <MobileLandscapeLayout />
        {/* Toggle back to Desktop view button */}
        <button
          onClick={() => setIsMobileMode(false)}
          className="fixed bottom-2 right-2 z-40 p-1.5 rounded bg-black/80 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-mono flex items-center gap-1 shadow"
        >
          <Monitor className="w-3 h-3" />
          <span>DESKTOP VIEW</span>
        </button>
        <ReconnectingOverlay />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f14] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Tactical Top Bar */}
      <TopBar
        onOpenDevices={() => setDevicesModalOpen(true)}
        onOpenShare={() => setShareModalOpen(true)}
        onOpenObsSettings={() => setObsModalOpen(true)}
        onOpenAuth={() => {
          setAuthDefaultTab('auth');
          setAuthModalOpen(true);
        }}
        onOpenSessions={() => {
          setAuthDefaultTab('sessions');
          setAuthModalOpen(true);
        }}
      />

      {/* Main Switcher Control Room */}
      <main className="flex-1 p-3 max-w-[1720px] w-full mx-auto space-y-3">
        {/* Top Half: Live Multiview Screens (Program Out + Staged Preview) */}
        <MultiviewDisplay />

        {/* Middle Half: Program/Preview Cross-Point Bus (Left 9 cols) + Transition Panel (Right 3 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          <div className="lg:col-span-9 flex flex-col">
            <ProgramPreviewBus />
          </div>

          <div className="lg:col-span-3 flex flex-col">
            <TransitionControl />
          </div>
        </div>

        {/* Bottom Half: Broadcast PPM Audio Mixer with Master Output Strip */}
        <AudioMixer />

        {/* Surface Controls Footer & Mobile Mode Switch */}
        <footer className="pt-2 pb-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-2 border-t border-[#1a1f2b]">
          <div className="flex items-center gap-3">
            <span>MK VISION PRO SWITCHER · VERSION {switcherState?.version || 1}</span>
            <span>·</span>
            <span className="text-slate-400">ENGINE: OBS STUDIO v5</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMode(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161a24] hover:bg-[#202534] border border-[#2b3345] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>MOBILE LANDSCAPE MODE</span>
            </button>
            <span className="hidden md:inline text-slate-600">
              SHORTCUTS: [1-8] PVW · [SPACE] AUTO · [X] CUT · [D] DSK · [M] MUTE
            </span>
          </div>
        </footer>
      </main>

      {/* Reconnection & Revocation Safety Shield */}
      <ReconnectingOverlay />

      {/* Modals */}
      <DeviceManagerModal
        isOpen={devicesModalOpen}
        onClose={() => setDevicesModalOpen(false)}
      />
      <SessionShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
      <ObsSettingsModal
        isOpen={obsModalOpen}
        onClose={() => setObsModalOpen(false)}
      />
      <AuthModal
        isOpen={authModalOpen}
        defaultTab={authDefaultTab}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <SwitcherProvider>
      <SwitcherSurface />
    </SwitcherProvider>
  );
}
