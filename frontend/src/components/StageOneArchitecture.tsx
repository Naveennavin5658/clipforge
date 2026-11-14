import { useState } from 'react';
import { Zap, Shield, Sparkles, Layers, ChevronDown, Terminal, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function StageOneArchitecture() {
  const [showTechDetails, setShowTechDetails] = useState(false);

  return (
    <div className="space-y-12 pt-8">
      {/* Friendly "Why People Love ClipForge" Grid */}
      <section aria-label="Why ClipForge" className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
            Why ClipForge is different
          </h2>
          <p className="text-sm text-zinc-500">
            Built from scratch to be the fastest, easiest way to grab video highlights.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-zinc-950">
              Instant Cut, Zero Waste
            </h3>
            <p className="text-xs leading-relaxed text-zinc-600">
              Never download a 2-hour video just to grab a 10-second highlight. We extract only the exact seconds you need.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-zinc-950">
              100% Private on Your Device
            </h3>
            <p className="text-xs leading-relaxed text-zinc-600">
              When trimming your own files, the video never leaves your browser. It runs locally with high-speed video copying.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-zinc-950">
              Batch Playlists into a ZIP
            </h3>
            <p className="text-xs leading-relaxed text-zinc-600">
              Grab clips from multiple videos in a playlist and download them all together in one clean, organized package.
            </p>
          </div>
        </div>
      </section>

      {/* Developer / Technical Deep Dive (Optional & Collapsed by Default) */}
      <section className="border-t border-zinc-200/80 pt-6">
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTechDetails((v) => !v)}
            className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-400" />
              For Developers: Under the Hood &amp; Free-Tier Architecture
            </span>
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                showTechDetails ? 'rotate-180 text-zinc-700' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showTechDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-zinc-200 bg-white p-6 space-y-6 text-xs text-zinc-600"
              >
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-zinc-900">1. Edge Gateway Proxy</p>
                    <p className="leading-relaxed">
                      Cloudflare Worker + Upstash Redis protects the worker with atomic sliding-window rate limiting (12 clips / 10m) and 15-minute playlist caching.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-zinc-900">2. Local WebAssembly Engine</p>
                    <p className="leading-relaxed">
                      Trims client-side videos using <code className="bg-zinc-100 px-1 py-0.5 rounded">@ffmpeg/ffmpeg</code> 0.12 stream-copy (<code className="bg-zinc-100 px-1 py-0.5 rounded">-c copy</code>), requiring 0kb of backend bandwidth.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-zinc-900">3. Dockerized Python Backend</p>
                    <p className="leading-relaxed">
                      FastAPI + <code className="bg-zinc-100 px-1 py-0.5 rounded">yt-dlp --download-sections</code> + ffmpeg stream-copy audio AAC re-encoding, deployed on Hugging Face Spaces or Oracle Free-Tier.
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
