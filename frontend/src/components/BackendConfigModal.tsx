import { useEffect, useState } from 'react';
import { X, Activity } from 'lucide-react';

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
      setHealthError('Enter a backend or Cloudflare Worker URL.');
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
      setHealthError(err instanceof Error ? err.message : 'Unable to reach /health endpoint.');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="backend-config-title" className="font-display text-lg font-semibold text-zinc-950">
            Backend &amp; Edge Gateway URL
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backend configuration"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="gateway-url-input" className="block text-xs font-medium text-zinc-700 mb-1.5">
              Cloudflare Worker or FastAPI Origin
            </label>
            <input
              id="gateway-url-input"
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://clipforge-edge-gateway.your-subdomain.workers.dev"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Defaults to <span className="font-mono">VITE_API_BASE_URL</span>. Local file trimming works offline even
              without a remote backend.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-700 font-mono tabular-nums">
              <Activity className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              {health ? (
                <span>
                  Online · {health.available_slots}/{health.max_slots} slots free
                </span>
              ) : healthError ? (
                <span className="text-rose-600">{healthError}</span>
              ) : (
                <span className="text-zinc-500">Test /health before clipping</span>
              )}
            </div>
            <button
              type="button"
              disabled={checking}
              onClick={checkHealth}
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-800 hover:bg-zinc-100 whitespace-nowrap"
            >
              {checking ? 'Checking...' : 'Check /health'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Save Endpoint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
