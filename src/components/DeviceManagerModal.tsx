/**
 * MK VISION - Device Management ("MY DEVICES")
 * Real-time device presence, registration, and owner revocation control
 * By Melton Konchella
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  X,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useSwitcher } from '../context/SwitcherContext.js';
import { Device } from '../types/switcher.js';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    userDevices,
    device: currentDevice,
    revokeDevice,
    registerDevice,
    refreshDevices,
    role,
  } = useSwitcher();

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<Device['type']>('android');
  const [isRegistering, setIsRegistering] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegisterNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    try {
      await registerDevice(newDeviceName.trim(), newDeviceType);
      setStatusMsg(`Registered "${newDeviceName}" successfully!`);
      setNewDeviceName('');
      setIsRegistering(false);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Registration failed');
    }
  };

  const handleRevoke = async (devId: string, name: string) => {
    if (!confirm(`Are you sure you want to REVOKE "${name}"? This device will immediately lose control of all productions.`)) {
      return;
    }
    const success = await revokeDevice(devId);
    if (success) {
      setStatusMsg(`Device "${name}" was revoked.`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'android':
      case 'ios':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-sky-400" />;
      case 'windows':
      case 'mac':
      default:
        return <Laptop className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#141720] border border-[#2c3345] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252b3b] bg-[#10131a]">
          <div>
            <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide">
              MY DEVICES & PERMISSIONS
            </h2>
            <p className="text-xs text-slate-400">
              Manage authorized production control surfaces for this account
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className="mx-5 mt-3 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            {statusMsg}
          </div>
        )}

        {/* Device List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>REGISTERED SURFACES ({userDevices.length})</span>
            <button
              onClick={() => refreshDevices()}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-2">
            {userDevices.map((dev) => {
              const isCurrent = currentDevice?.id === dev.id;

              return (
                <div
                  key={dev.id}
                  className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                    dev.isRevoked
                      ? 'bg-red-950/20 border-red-900/40 opacity-60'
                      : isCurrent
                      ? 'bg-[#1b2230] border-amber-500/50 shadow-sm'
                      : 'bg-[#181c26] border-[#262d3d]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#202636] border border-[#2b3347] flex items-center justify-center">
                      {getDeviceIcon(dev.type)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{dev.name}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            THIS DEVICE
                          </span>
                        )}
                        {dev.isRevoked && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                            REVOKED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="capitalize">{dev.type}</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dev.isOnline && !dev.isRevoked ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          <span>{dev.isOnline && !dev.isRevoked ? 'Online' : 'Offline'}</span>
                        </div>
                        <span>·</span>
                        <span className="font-mono text-[10px]">ID: {dev.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {!dev.isRevoked && !isCurrent && role === 'owner' && (
                      <button
                        onClick={() => handleRevoke(dev.id, dev.name)}
                        className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs font-mono font-medium transition-colors flex items-center gap-1"
                        title="Immediately revoke this device's switcher access"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Register New Device Accordion */}
          <div className="pt-2">
            {!isRegistering ? (
              <button
                onClick={() => setIsRegistering(true)}
                className="w-full py-2.5 rounded-lg border border-dashed border-[#343e54] hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-colors text-xs font-mono font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>REGISTER ANOTHER CONTROL DEVICE</span>
              </button>
            ) : (
              <form
                onSubmit={handleRegisterNew}
                className="p-3 rounded-lg bg-[#191e2b] border border-[#2a3348] space-y-3"
              >
                <div className="text-xs font-mono font-bold text-slate-200 uppercase">
                  REGISTER DEVICE
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Device Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Director iPhone"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Device Type</label>
                    <select
                      value={newDeviceType}
                      onChange={(e) => setNewDeviceType(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded bg-[#10131a] border border-[#2b3345] text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="android">Android Phone</option>
                      <option value="ios">iPhone / iPad</option>
                      <option value="tablet">Android Tablet</option>
                      <option value="windows">Windows PC</option>
                      <option value="mac">Mac</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="px-3 py-1 rounded text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono transition-colors"
                  >
                    REGISTER
                  </button>
                </div>
              </form>
            )}
          </div>
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
