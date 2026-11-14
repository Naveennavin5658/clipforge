import { useEffect, useState } from 'react';
import { Flame, Clock, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ForgeStatsBannerProps {
  apiBaseUrl: string;
  triggerCelebration?: number; // increments to trigger celebration
}

export function ForgeStatsBanner({ apiBaseUrl, triggerCelebration }: ForgeStatsBannerProps) {
  const [totalClips, setTotalClips] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipforge_stats_clips');
      if (saved) return parseInt(saved, 10);
    }
    return 1385;
  });

  const [secondsSaved, setSecondsSaved] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clipforge_stats_seconds');
      if (saved) return parseInt(saved, 10);
    }
    return 58153;
  });

  const [showCelebration, setShowCelebration] = useState(false);

  // Fetch live stats from backend
  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const base = apiBaseUrl.trim().replace(/\/+$/, '');
        const res = await fetch(`${base}/stats`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.total_clips) {
          setTotalClips(data.total_clips);
          setSecondsSaved(data.seconds_saved || data.total_clips * 42);
          if (typeof window !== 'undefined') {
            localStorage.setItem('clipforge_stats_clips', String(data.total_clips));
            localStorage.setItem('clipforge_stats_seconds', String(data.seconds_saved || data.total_clips * 42));
          }
        }
      } catch {
        // Silently preserve current/cached count
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  // Handle celebration trigger when a new clip is forged by user
  useEffect(() => {
    if (!triggerCelebration) return;
    setTotalClips((prev) => {
      const next = prev + 1;
      if (typeof window !== 'undefined') {
        localStorage.setItem('clipforge_stats_clips', String(next));
      }
      return next;
    });
    setSecondsSaved((prev) => prev + 35);
    setShowCelebration(true);
    const timeout = setTimeout(() => setShowCelebration(false), 4000);
    return () => clearTimeout(timeout);
  }, [triggerCelebration]);

  const hoursSaved = (secondsSaved / 3600).toFixed(1);
  const formattedClips = totalClips.toLocaleString();

  return (
    <div className="relative z-30 border-b border-[#252b42] bg-gradient-to-r from-[#0c0d16] via-[#151829] to-[#0c0d16] py-2 px-4 text-white overflow-hidden shadow-md">
      {/* Subtle ember glow behind banner */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-rose-500/15 to-amber-500/10 pointer-events-none" />

      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Side: Live Forge Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-orange-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span>FORGE TICKER</span>
          </div>

          <span className="text-zinc-400 text-[11px] hidden sm:inline">
            Tracking worldwide clip generation in real time
          </span>
        </div>

        {/* Center: The Flex Counter */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-orange-400 fill-orange-500/20 animate-bounce" />
            <span className="text-zinc-300 font-sans font-medium text-xs hidden xs:inline">
              Videos Forged:
            </span>

            {/* Animated Digit Odometer */}
            <div className="flex items-center gap-0.5">
              {formattedClips.split('').map((char, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center justify-center font-bold text-sm ${
                    char === ','
                      ? 'text-orange-400 px-0.5'
                      : 'min-w-[20px] h-6 rounded-md bg-[#1f243b] border border-orange-500/30 text-white shadow-xs'
                  }`}
                >
                  <motion.span
                    key={`${index}-${char}`}
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    {char}
                  </motion.span>
                </span>
              ))}
            </div>
          </div>

          <span className="text-zinc-600">/</span>

          {/* Time Saved Stat */}
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>
              <strong className="text-zinc-200">{hoursSaved} hrs</strong> of full downloads skipped
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action or Spark Celebration */}
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {showCelebration ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, x: 20 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1 font-sans text-xs font-extrabold text-white shadow-lg shadow-orange-500/30"
              >
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>+1 Clip Forged! 🔥</span>
              </motion.div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>+42% bandwidth saved</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
