import { motion } from 'motion/react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
  animated?: boolean;
}

export function Logo({ size = 'md', withText = true, animated = true }: LogoProps) {
  const pixelSizes = {
    sm: 28,
    md: 38,
    lg: 52,
    xl: 72,
  };
  const px = pixelSizes[size];

  return (
    <div className="flex items-center gap-3 select-none">
      <motion.div
        whileHover={animated ? { scale: 1.08, rotate: [0, -5, 5, 0] } : undefined}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative shrink-0 flex items-center justify-center cursor-pointer"
        style={{ width: px, height: px }}
      >
        {/* Ambient Glow */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-400 opacity-60 blur-md transition-opacity group-hover:opacity-100"
          style={{ transform: 'scale(0.85)' }}
        />

        {/* Crisp Vector Graphic */}
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 w-full h-full drop-shadow-md"
        >
          <defs>
            <linearGradient id="logoGlow" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF385C" />
              <stop offset="50%" stopColor="#FF6B00" />
              <stop offset="100%" stopColor="#FFA800" />
            </linearGradient>
            <linearGradient id="bladeLight" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <linearGradient id="baseShield" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1B1E2B" />
              <stop offset="100%" stopColor="#0B0D14" />
            </linearGradient>
          </defs>

          {/* Diamond Base Plate */}
          <rect
            x="12"
            y="12"
            width="96"
            height="96"
            rx="26"
            fill="url(#baseShield)"
            stroke="url(#logoGlow)"
            strokeWidth="2"
            strokeOpacity="0.4"
          />

          {/* Sprocket Holes */}
          <rect x="25" y="19" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="41" y="19" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="57" y="19" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="73" y="19" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="89" y="19" width="7" height="4" rx="1.5" fill="#2E3447" />

          <rect x="25" y="97" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="41" y="97" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="57" y="97" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="73" y="97" width="7" height="4" rx="1.5" fill="#2E3447" />
          <rect x="89" y="97" width="7" height="4" rx="1.5" fill="#2E3447" />

          {/* Anvil Base */}
          <path d="M34 82H86L78 72H42L34 82Z" fill="#252A3B" />

          {/* Intersecting Scissor Blades */}
          <path
            d="M36 36L66 66M66 66L84 84M36 36C33 39 33 44 37 48C41 52 46 52 49 49L63 63"
            stroke="url(#logoGlow)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M84 36L54 66M54 66L36 84M84 36C87 39 87 44 83 48C79 52 74 52 71 49L57 63"
            stroke="url(#bladeLight)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hot Spark Pivot */}
          <circle cx="60" cy="60" r="5" fill="#FFA800" />
          <circle cx="60" cy="60" r="2.5" fill="#FFFFFF" />

          {/* Ember Particles */}
          <circle cx="58" cy="46" r="1.5" fill="#FF8400" />
          <circle cx="68" cy="52" r="1.2" fill="#FFA800" />
          <circle cx="50" cy="56" r="1" fill="#FF385C" />
        </svg>
      </motion.div>

      {withText && (
        <div className="flex flex-col">
          <span className="font-display font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
            <span className="text-xl sm:text-2xl bg-gradient-to-r from-slate-950 via-slate-800 to-slate-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              Clip
            </span>
            <span className="text-xl sm:text-2xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 dark:from-rose-500 dark:via-orange-400 dark:to-amber-300 bg-clip-text text-transparent ml-0.5">
              Forge
            </span>
          </span>
          <span className="text-[10px] font-mono tracking-widest text-slate-500 dark:text-zinc-400 uppercase font-semibold mt-0.5">
            Cinematic Clipper
          </span>
        </div>
      )}
    </div>
  );
}
