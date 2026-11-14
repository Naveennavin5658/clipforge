import { ChevronDown, ShieldCheck } from 'lucide-react';
import { sanitizeBotBypass, type BotBypassCredentials } from '../lib/clipforge';

interface BotBypassPanelProps {
  open: boolean;
  onToggle: () => void;
  credentials: BotBypassCredentials;
  onChange: (next: BotBypassCredentials) => void;
}

export function BotBypassPanel({ open, onToggle, credentials, onChange }: BotBypassPanelProps) {
  const status = sanitizeBotBypass(credentials);

  const handleCookieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onChange({ ...credentials, cookiesTxt: text });
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50"
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5 sm:mt-0" aria-hidden="true" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5 min-w-0">
            <span className="text-sm font-medium text-zinc-900 whitespace-nowrap">
              YouTube 403 / Bot-Check Bypass
            </span>
            <span className="text-xs text-zinc-500 truncate">
              {status.hasCookies || status.hasPoToken
                ? `${status.hasCookies ? 'Cookies attached' : ''}${status.hasCookies && status.hasPoToken ? ' · ' : ''}${status.hasPoToken ? 'PO Token set' : ''}`
                : 'Optional — for datacenter IP blocks or large batches'}
            </span>
          </div>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-4">
          <p className="text-xs leading-relaxed text-zinc-600">
            Free-tier cloud backends share datacenter IPs that YouTube occasionally challenges with{' '}
            <span className="font-mono text-zinc-900">HTTP 403</span>. Credentials pasted here are sent in-memory per
            request, written to an ephemeral <span className="font-mono text-zinc-900">0600</span> temp file during{' '}
            <span className="font-mono text-zinc-900">yt-dlp</span> execution, and deleted immediately. Never persisted.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="yt-cookies-input" className="text-xs font-medium text-zinc-800">
                  Netscape cookies.txt
                </label>
                <label
                  htmlFor="yt-cookies-file"
                  className="cursor-pointer text-xs text-rose-600 hover:text-rose-700"
                >
                  Load .txt file
                  <input
                    id="yt-cookies-file"
                    type="file"
                    accept=".txt"
                    tabIndex={-1}
                    className="hidden"
                    onChange={handleCookieFile}
                  />
                </label>
              </div>
              <textarea
                id="yt-cookies-input"
                rows={4}
                value={credentials.cookiesTxt}
                onChange={(e) => onChange({ ...credentials, cookiesTxt: e.target.value })}
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
              {status.hasCookies && !status.cookiesLooksValid && (
                <p className="text-xs text-amber-700">
                  Expected tab-separated Netscape format (exported via Get cookies.txt LOCALLY).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="yt-po-token-input" className="text-xs font-medium text-zinc-800">
                YouTube PO Token (optional)
              </label>
              <input
                id="yt-po-token-input"
                type="password"
                value={credentials.poToken}
                onChange={(e) => onChange({ ...credentials, poToken: e.target.value })}
                placeholder="Paste web PO token..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
              <p className="text-xs leading-relaxed text-zinc-500">
                Forwarded to <span className="font-mono text-zinc-700">yt-dlp --extractor-args youtube:po_token=web+&lt;token&gt;</span>.
                Requests with custom auth bypass the Edge Redis cache automatically.
              </p>
              {(status.hasCookies || status.hasPoToken) && (
                <button
                  type="button"
                  onClick={() => onChange({ cookiesTxt: '', poToken: '' })}
                  className="text-xs text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
                >
                  Clear credentials from memory
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
