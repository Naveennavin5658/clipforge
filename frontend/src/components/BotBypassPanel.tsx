import { ChevronDown, ShieldCheck, KeyRound } from 'lucide-react';
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
    <div className="rounded-2xl border border-[#22283d] bg-[#121420] overflow-hidden shadow-md">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[#181c2e]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <KeyRound className="h-4 w-4 shrink-0 text-orange-400" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-white">
              Age-Restricted or Protected Video?
            </span>
            <span className="text-xs text-zinc-400 truncate">
              {status.hasCookies || status.hasPoToken
                ? '✓ Browser credentials attached'
                : 'Optional — only needed if YouTube asks you to sign in to watch'}
            </span>
          </div>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-orange-400' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-[#1e2338] bg-[#0c0d16] px-5 py-4 space-y-4 text-xs text-zinc-300">
          <p className="leading-relaxed text-zinc-400">
            Most public videos clip immediately. If YouTube blocks a video with a sign-in challenge,
            you can attach your browser cookies or login token here. They are used only for your clip and never saved on any server.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="yt-cookies-input" className="font-semibold text-white">
                  Browser Cookies (cookies.txt)
                </label>
                <label
                  htmlFor="yt-cookies-file"
                  className="cursor-pointer text-xs font-semibold text-orange-400 hover:text-orange-300 underline"
                >
                  Upload .txt file
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
                rows={3}
                value={credentials.cookiesTxt}
                onChange={(e) => onChange({ ...credentials, cookiesTxt: e.target.value })}
                placeholder="Paste Netscape format cookies here..."
                className="w-full rounded-xl border border-zinc-700/80 bg-[#141724] p-2.5 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="yt-po-token-input" className="font-semibold text-white">
                YouTube Player Token (Optional)
              </label>
              <input
                id="yt-po-token-input"
                type="password"
                value={credentials.poToken}
                onChange={(e) => onChange({ ...credentials, poToken: e.target.value })}
                placeholder="Paste PO token if you have one..."
                className="w-full rounded-xl border border-zinc-700/80 bg-[#141724] px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
              {(status.hasCookies || status.hasPoToken) && (
                <button
                  type="button"
                  onClick={() => onChange({ cookiesTxt: '', poToken: '' })}
                  className="text-xs font-semibold text-rose-400 underline hover:text-rose-300 pt-1"
                >
                  Clear credentials
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
