import { useState } from 'react';
import { Zap, Shield, Layers, ChevronDown, Terminal, Radio, Mic, Gamepad2, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function StageOneArchitecture() {
  const [showTechDetails, setShowTechDetails] = useState(false);

  return (
    <div className="space-y-12 pt-8 text-white">
      {/* Creative Use Cases Grid */}
      <section aria-label="Creative Use Cases" className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-0.5 text-[11px] font-mono font-bold text-orange-400 uppercase tracking-wider">
            Built for Creators &amp; Daily Users
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Cut the noise. Keep the gold.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            No bloated video editing suites. No rendering queues. Just pure precision cutting.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1 */}
          <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Mic className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-white">
              Podcast Punchlines
            </h3>
            <p className="text-xs leading-relaxed text-zinc-400">
              Heard a hilarious 15-second quote in a 3-hour podcast? Don't download 4 GB. Just snip the punchline in seconds.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-white">
              Gaming Clutches &amp; Moments
            </h3>
            <p className="text-xs leading-relaxed text-zinc-400">
              Share that 1v4 clutch without rendering an entire 40-minute match recording. Instant clip, clean MP4.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Music className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-white">
              Concert Solos &amp; Lessons
            </h3>
            <p className="text-xs leading-relaxed text-zinc-400">
              Snag the killer guitar solo or a key lecture slide to rewatch later without scrubbing through endless video timelines.
            </p>
          </div>
        </div>
      </section>

      {/* Developer / Technical Deep Dive (Optional & Collapsed) */}
      <section className="border-t border-[#1f2438] pt-6">
        <div className="rounded-2xl border border-[#23283c] bg-[#0e101a] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTechDetails((v) => !v)}
            className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-orange-400" />
              UNDER THE HOOD: FASTAPI + WASM + EDGE PROXY ARCHITECTURE
            </span>
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                showTechDetails ? 'rotate-180 text-orange-400' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showTechDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-[#1f2438] bg-[#090a10] p-6 space-y-6 text-xs text-zinc-400 font-mono"
              >
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <p className="font-bold text-white font-sans text-sm">1. Edge Gateway Proxy</p>
                    <p className="leading-relaxed">
                      Cloudflare Worker + Upstash Redis protects workers with sliding-window IP limits (12 clips/10m) and 15m playlist caching.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-white font-sans text-sm">2. In-Browser WASM Engine</p>
                    <p className="leading-relaxed">
                      Trims client files via @ffmpeg/ffmpeg 0.12 stream-copy (-c copy), requiring 0kb server bandwidth and running 100% offline.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-white font-sans text-sm">3. Python FastAPI Core</p>
                    <p className="leading-relaxed">
                      yt-dlp --download-sections + ffmpeg stream-copy audio AAC re-encoding, streaming ZIPs on Hugging Face Spaces or Oracle VM.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
