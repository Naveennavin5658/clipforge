import { useState, useEffect } from 'react';
import { Settings, HelpCircle } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-[#1f2438] bg-white/85 dark:bg-[#0c0e17]/85 backdrop-blur-md text-slate-900 dark:text-white transition-colors duration-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
        {/* Creative Brandmark & Logo */}
        <a
          href="#top"
          className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 rounded-2xl"
        >
          <Logo size="md" withText animated />
        </a>

        {/* Studio Highlights (Desktop) */}
        <div className="hidden lg:flex items-center gap-6 text-xs font-mono tracking-wider text-slate-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            ZERO DOWNLOAD OVERHEAD
          </span>
          <span className="text-slate-300 dark:text-zinc-600">/</span>
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% PRIVATE CLIENT WASM
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Selector (Light / Dark / Auto) */}
          <ThemeToggle />

          {/* Live Forge Status */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-[#262c45] bg-slate-100/90 dark:bg-[#141724] px-3 py-1 text-xs text-slate-700 dark:text-zinc-300 shadow-inner"
            title={online ? 'Forge worker is ready' : 'Connecting to background worker...'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                online === true
                  ? 'bg-emerald-500 shadow-[0_0_8px_#34d399] animate-pulse'
                  : online === false
                    ? 'bg-amber-400'
                    : 'bg-zinc-400'
              }`}
            />
            <span className="font-mono text-[11px] font-semibold">
              {online === true ? 'FORGE READY' : online === false ? 'OFFLINE' : 'CHECKING'}
            </span>
          </div>

          {/* Quick Guide */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/90 hover:bg-slate-200 dark:bg-[#141724] dark:hover:bg-[#1e2338] border border-slate-200/90 dark:border-[#23283c] text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            title="How it works"
            aria-label="How it works"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Server Config */}
          <button
            type="button"
            onClick={onOpenConfig}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/90 hover:bg-slate-200 dark:bg-[#141724] dark:hover:bg-[#1e2338] border border-slate-200/90 dark:border-[#23283c] text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            title="Server Connection Settings"
            aria-label="Server Connection Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
