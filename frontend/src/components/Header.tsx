import { useState, useEffect } from 'react';
import { Scissors, Settings, HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  onOpenConfig: () => void;
  onOpenHelp: () => void;
  apiBaseUrl: string;
}

export function Header({ onOpenConfig, onOpenHelp, apiBaseUrl }: HeaderProps) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const base = apiBaseUrl.trim().replace(/\/+$/, '');
        const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
        if (active) setOnline(res.ok);
      } catch {
        if (active) setOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        {/* Brand */}
        <a
          href="#top"
          className="group flex items-center gap-2.5 text-zinc-950 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          <motion.div
            whileHover={{ rotate: [-8, 8, -4, 4, 0], scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 text-white shadow-sm shadow-rose-500/20"
          >
            <Scissors className="h-5 w-5" />
          </motion.div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg font-bold tracking-tight text-zinc-950">
                ClipForge
              </span>
              <span className="rounded-full bg-rose-100/70 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                v2.0
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
              Clip videos in seconds
            </span>
          </div>
        </a>

        {/* Center Tagline / Feature Highlights */}
        <div className="hidden lg:flex items-center gap-6 text-xs font-medium text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
            No full download required
          </span>
          <span className="text-zinc-300">·</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            100% Free &amp; Private
          </span>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2.5">
          {/* Status Pill */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-xs text-zinc-600"
            title={online ? 'Server is online and ready' : 'Connecting to local helper...'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                online === true
                  ? 'bg-emerald-500 animate-pulse'
                  : online === false
                    ? 'bg-amber-500'
                    : 'bg-zinc-400'
              }`}
            />
            <span className="text-[11px] font-medium hidden xs:inline">
              {online === true ? 'Ready' : online === false ? 'Offline' : 'Connecting'}
            </span>
          </div>

          {/* Quick Help */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            title="How it works"
            aria-label="How it works"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenConfig}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            title="Server settings"
            aria-label="Server settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
