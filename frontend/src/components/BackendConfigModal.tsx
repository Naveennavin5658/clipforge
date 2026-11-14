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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-[#252b42] bg-white dark:bg-[#121422] p-6 sm:p-7 shadow-2xl space-y-6 text-slate-900 dark:text-white transition-colors duration-150"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#202538] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 id="backend-config-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Server Connection
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Helper service used to cut YouTube links
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="gateway-url-input" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Server URL
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
                <Globe className="h-4 w-4" />
              </div>
              <input
                id="gateway-url-input"
                type="text"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full rounded-2xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-[#0d0f1a] py-3 pl-10 pr-24 font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-orange-500 focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 shadow-inner"
              />
              <button
                type="button"
                onClick={checkHealth}
                disabled={checking}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Activity className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                Test
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">
              Default is local helper (<code className="text-orange-600 dark:text-orange-400 font-mono">http://localhost:8000</code>).
            </p>
          </div>

          {health && (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">Worker Connected &amp; Ready</span>
              </div>
              <span className="font-mono text-[11px] opacity-80">
                {health.available_slots}/{health.max_slots} slots open
              </span>
            </div>
          )}

          {healthError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300">
              Connection failed: {healthError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1e30] dark:hover:bg-[#222840] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition-all cursor-pointer"
            >
              Save Server URL
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
