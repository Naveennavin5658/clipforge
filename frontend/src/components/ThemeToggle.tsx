import { useState, useEffect } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { motion } from 'motion/react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipforge_theme') as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    }
    return 'dark';
  });

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    if (typeof window === 'undefined') return;

    localStorage.setItem('clipforge_theme', mode);

    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', mode === 'system' ? 'light dark' : mode);
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const current = localStorage.getItem('clipforge_theme');
      if (current === 'system') {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="flex items-center rounded-xl p-0.5 border border-slate-200/90 dark:border-[#23283c] bg-slate-100/90 dark:bg-[#141724] shadow-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        aria-label="Light theme"
        title="Light theme"
        onClick={() => applyTheme('light')}
        className={`relative flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
          theme === 'light'
            ? 'text-orange-600 font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
      >
        {theme === 'light' && (
          <motion.div
            layoutId="themePill"
            className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-zinc-800"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
          />
        )}
        <Sun className="relative z-10 h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        aria-label="Dark theme"
        title="Dark theme"
        onClick={() => applyTheme('dark')}
        className={`relative flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
          theme === 'dark'
            ? 'text-orange-400 font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
      >
        {theme === 'dark' && (
          <motion.div
            layoutId="themePill"
            className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#22283d]"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
          />
        )}
        <Moon className="relative z-10 h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        aria-label="System theme"
        title="Match system (Auto)"
        onClick={() => applyTheme('system')}
        className={`relative flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
          theme === 'system'
            ? 'text-orange-600 dark:text-orange-400 font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
      >
        {theme === 'system' && (
          <motion.div
            layoutId="themePill"
            className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#22283d]"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
          />
        )}
        <Laptop className="relative z-10 h-3.5 w-3.5" />
      </button>
    </div>
  );
}
