import { useEffect, useState } from 'react';
import { X, Activity, CheckCircle2, Server, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface BackendConfigModalProps {
  open: boolean;
  apiBaseUrl: string;
  onSave: (nextUrl: string) => void;
  onClose: () => void;
}

interface HealthSnapshot {
  status: string;
  active_slots: number;
  available_slots: number;
  max_slots: number;
}

export function BackendConfigModal({ open, apiBaseUrl, onSave, onClose }: BackendConfigModalProps) {
  const [draftUrl, setDraftUrl] = useState(apiBaseUrl);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    setDraftUrl(apiBaseUrl);
  }, [apiBaseUrl, open]);

  if (!open) return null;

  const checkHealth = async () => {
    const clean = draftUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      setHealthError('Please enter a valid URL.');
      return;
    }
    setChecking(true);
    setHealthError(null);
    setHealth(null);
    try {
      const res = await fetch(`${clean}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HealthSnapshot;
      setHealth(data);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Could not reach server.');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draftUrl.trim().replace(/\/+$/, ''));
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-config-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl border border-[#252b42] bg-[#121422] p-6 sm:p-7 shadow-2xl space-y-6 text-white"
      >
        <div className="flex items-center justify-between border-b border-[#202538] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 id="backend-config-title" className="font-display text-lg font-bold text-white">
                Server Connection
              </h2>
              <p className="text-xs text-zinc-400">
                Helper service used to cut YouTube links
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="gateway-url-input" className="block text-xs font-semibold text-zinc-300">
              Server URL
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                id="gateway-url-input"
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full rounded-xl border border-zinc-700 bg-black/60 py-2.5 pl-10 pr-3 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
              />
            </div>
            <p className="text-xs text-zinc-400">
              Local file trimming works completely offline without needing any server.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#23283c] bg-[#161a2b] p-3.5 text-xs">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-400" />
              {health ? (
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Connected &amp; Ready
                </span>
              ) : healthError ? (
                <span className="font-semibold text-rose-400">Error: {healthError}</span>
              ) : (
                <span className="text-zinc-400">Test server connection</span>
              )}
            </div>
            <button
              type="button"
              disabled={checking}
              onClick={checkHealth}
              className="rounded-xl border border-zinc-700 bg-[#1e2338] hover:bg-[#282f4c] px-3 py-1.5 font-semibold text-zinc-200 transition-colors shadow-xs"
            >
              {checking ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-transparent px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 px-5 py-2 text-xs font-bold text-white shadow-md transition-colors"
            >
              Save Endpoint
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
