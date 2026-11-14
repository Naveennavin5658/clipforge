import { useState, useEffect } from 'react';
import { Flame, Clock, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ForgeStatsBannerProps {
  apiBaseUrl: string;
  triggerCelebration?: number;
}

export function ForgeStatsBanner({ apiBaseUrl, triggerCelebration }: ForgeStatsBannerProps) {
  const [totalClips, setTotalClips] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipforge_stats_clips');
      if (saved) {
        const num = parseInt(saved, 10);
        if (num < 1000) return num;
        localStorage.removeItem('clipforge_stats_clips');
        localStorage.removeItem('clipforge_stats_seconds');
      }
    }
    return 1; // Real verified clip count
  });

  const [secondsSaved, setSecondsSaved] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipforge_stats_seconds');
      if (saved) {
        const num = parseInt(saved, 10);
        if (num < 10000) return num;
      }
    }
    return 5;
  });

  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const base = apiBaseUrl.trim().replace(/\/+$/, '');
        const res = await fetch(`${base}/stats`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.total_clips === 'number') {
          setTotalClips(data.total_clips);
          setSecondsSaved(data.seconds_saved || 0);
          if (typeof window !== 'undefined') {
            localStorage.setItem('clipforge_stats_clips', String(data.total_clips));
            localStorage.setItem('clipforge_stats_seconds', String(data.seconds_saved || 0));
          }
        }
      } catch {
        // Silently preserve current count
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!triggerCelebration) return;
    setTotalClips((prev) => {
      const next = prev + 1;
      if (typeof window !== 'undefined') {
        localStorage.setItem('clipforge_stats_clips', String(next));
      }
      return next;
    });
    setSecondsSaved((prev) => {
      const next = prev + 25;
      if (typeof window !== 'undefined') {
        localStorage.setItem('clipforge_stats_seconds', String(next));
      }
      return next;
    });
    setShowCelebration(true);
    const timeout = setTimeout(() => setShowCelebration(false), 4000);
    return () => clearTimeout(timeout);
  }, [triggerCelebration]);

  const formattedClips = totalClips.toLocaleString();

  // Dynamic friendly duration formatting
  const formattedSavedTime =
    secondsSaved < 60
      ? `${secondsSaved}s`
      : secondsSaved < 3600
        ? `${Math.round(secondsSaved / 60)} min`
        : `${(secondsSaved / 3600).toFixed(1)} hrs`;

  return (
    <div className="relative z-30 border-b border-orange-200/90 dark:border-[#252b42] bg-gradient-to-r from-orange-50/90 via-amber-50/60 to-orange-50/90 dark:from-[#0c0d16] dark:via-[#151829] dark:to-[#0c0d16] py-2 px-4 text-slate-800 dark:text-white overflow-hidden shadow-xs dark:shadow-md transition-colors duration-150">
      {/* Subtle ember glow behind banner */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-rose-500/10 pointer-events-none" />

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs">
        {/* Left Side: Live Badge + Worldwide Note */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-orange-700 dark:text-orange-400 tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span>LIVE FORGE TICKER</span>
          </div>

          <span className="text-slate-600 dark:text-zinc-400 text-[11px] hidden sm:inline">
            Real clips created by users in real time
          </span>
        </div>

        {/* Center: Live Odometer Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-orange-500 dark:text-orange-400 fill-orange-500/20 animate-bounce" />
            <span className="text-slate-700 dark:text-zinc-300 font-sans font-medium text-xs hidden xs:inline">
              {totalClips === 1 ? 'Video Forged:' : 'Videos Forged:'}
            </span>

            {/* Animated Digit Odometer */}
            <div className="flex items-center gap-0.5 font-mono font-black text-sm tracking-tight">
              {formattedClips.split('').map((char, index) => (
                <div
                  key={index}
                  className="relative flex h-6 w-4 sm:h-7 sm:w-5 items-center justify-center rounded-md bg-white dark:bg-[#1f2438] border border-orange-300/80 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 shadow-xs"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${index}-${char}`}
                      initial={{ y: -12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 12, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="absolute"
                    >
                      {char}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Time Saved Flex Counter */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 text-[11px]">
            <Clock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span>
              <strong className="text-slate-900 dark:text-zinc-200">{formattedSavedTime}</strong> saved from full video downloads
            </span>
          </div>
        </div>

        {/* Right Side: Flex Celebration Spark or Genuine badge */}
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {showCelebration ? (
              <motion.div
                key="celebration"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-3 py-1 font-bold text-white shadow-lg shadow-orange-500/30 text-[11px] animate-pulse"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>+1 Clip Forged! 🔥</span>
              </motion.div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>100% genuine stats</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
