import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Scissors,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Film,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  MAX_SINGLE_CLIP_SEC,
  classifyApiError,
  formatBytes,
  formatTimecode,
  parseTimecode,
  validateClipRange,
  type BotBypassCredentials,
  type ClassifiedApiError,
} from '../lib/clipforge';
import { trimLocalVideoWithWasm } from '../utils/localFfmpeg';
import { FilmstripScrubber } from './FilmstripScrubber';

interface SingleClipperProps {
  mode: 'local' | 'youtube-single';
  localFile: File | null;
  videoId: string | null;
  canonicalUrl: string | null;
  apiBaseUrl: string;
  botBypass: BotBypassCredentials;
  onRequestOpenBotBypass: () => void;
}

export function SingleClipper({
  mode,
  localFile,
  videoId,
  canonicalUrl,
  apiBaseUrl,
  botBypass,
  onRequestOpenBotBypass,
}: SingleClipperProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(mode === 'local' ? 5 : 30);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(mode === 'local' ? 60 : 180);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ClassifiedApiError | null>(null);
  const [lastClipUrl, setLastClipUrl] = useState<{ url: string; filename: string } | null>(null);

  const localPreviewUrl = useMemo(() => {
    if (mode !== 'local' || !localFile) return null;
    return URL.createObjectURL(localFile);
  }, [mode, localFile]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    return () => {
      if (lastClipUrl) URL.revokeObjectURL(lastClipUrl.url);
    };
  }, [lastClipUrl]);

  useEffect(() => {
    setApiError(null);
    setStatusMsg(null);
    setLastClipUrl(null);
    setStartSec(0);
    setEndSec(mode === 'local' ? 5 : 30);
  }, [mode, videoId, localFile]);

  const maxCap = mode === 'local' ? null : MAX_SINGLE_CLIP_SEC;
  const startStr = formatTimecode(startSec);
  const endStr = formatTimecode(endSec);
  const rangeCheck = validateClipRange(startStr, endStr, maxCap);

  const handleScrubberChange = (s: number, e: number) => {
    setStartSec(s);
    setEndSec(e);
  };

  const adjustTime = (target: 'start' | 'end', delta: number) => {
    if (target === 'start') {
      const next = Math.max(0, Math.min(startSec + delta, endSec - 1));
      setStartSec(next);
    } else {
      const next = Math.max(startSec + 1, endSec + delta);
      setEndSec(next);
    }
  };

  const setPresetDuration = (duration: number) => {
    setEndSec(startSec + duration);
  };

  const pinCurrentTime = (target: 'start' | 'end') => {
    let current = playheadSec;
    if (videoRef.current) {
      current = Math.floor(videoRef.current.currentTime);
    }
    if (target === 'start') {
      setStartSec(current);
      if (endSec <= current) setEndSec(current + 15);
    } else {
      setEndSec(Math.max(current, startSec + 1));
    }
  };

  const handleExtract = async () => {
    if (!rangeCheck.valid) return;
    setApiError(null);
    setStatusMsg(null);
    setLastClipUrl(null);

    if (mode === 'local' && localFile) {
      setBusy(true);
      try {
        const result = await trimLocalVideoWithWasm({
          file: localFile,
          startSec: rangeCheck.startSec,
          endSec: rangeCheck.endSec,
          onStatus: (msg) => setStatusMsg(msg),
        });
        const downloadUrl = URL.createObjectURL(result.blob);
        setLastClipUrl({ url: downloadUrl, filename: result.filename });
        setStatusMsg(`Done! Saved ${formatBytes(result.blob.size)} directly to your device.`);
        // Trigger download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = result.filename;
        a.click();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Local trimming failed.';
        setApiError({
          code: 'SERVER_ERROR',
          title: 'Could not trim this video',
          detail: message,
          suggestion: 'Please verify the video is a standard MP4, MOV, or WebM file.',
          needsBotBypass: false,
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'youtube-single' && canonicalUrl) {
      const base = apiBaseUrl.trim().replace(/\/+$/, '');
      if (!base) {
        setApiError(classifyApiError(0, 'Helper server is offline.'));
        return;
      }

      setBusy(true);
      setStatusMsg('Slicing the exact video section...');
      try {
        const response = await fetch(`${base}/clip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: canonicalUrl,
            start_sec: rangeCheck.startSec,
            end_sec: rangeCheck.endSec,
            ...(botBypass.cookiesTxt.trim() ? { cookies_txt: botBypass.cookiesTxt.trim() } : {}),
            ...(botBypass.poToken.trim() ? { po_token: botBypass.poToken.trim() } : {}),
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          setApiError(classifyApiError(response.status, text, response.headers.get('Retry-After')));
          return;
        }

        setStatusMsg('Packaging high-definition MP4...');
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/);
        const filename = match ? match[1] : `clip_${Math.floor(rangeCheck.startSec)}-${Math.floor(rangeCheck.endSec)}.mp4`;

        const downloadUrl = URL.createObjectURL(blob);
        setLastClipUrl({ url: downloadUrl, filename });
        setStatusMsg(`Clip Ready (${formatBytes(blob.size)})! Downloading now...`);

        // Trigger immediate browser download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.click();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network connection issue.';
        setApiError(classifyApiError(0, message));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Workstation Card */}
      <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-5 sm:p-7 shadow-2xl space-y-6">
        {/* Top Header inside card */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202538] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_#ff6b00]" />
            <h2 className="font-display text-lg font-bold text-white tracking-wide">
              {mode === 'local' ? 'Local Studio Player' : 'Live YouTube Cutting Deck'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">PRESET LENGTHS:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPresetDuration(15)}
                className="rounded-lg bg-[#1a1e30] hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors"
              >
                ⚡ 15s
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(30)}
                className="rounded-lg bg-[#1a1e30] hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors"
              >
                🔥 30s
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(60)}
                className="rounded-lg bg-[#1a1e30] hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors"
              >
                🎬 60s
              </button>
            </div>
          </div>
        </div>

        {/* Video Preview Frame */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black aspect-video relative group shadow-inner">
          {mode === 'local' && localPreviewUrl ? (
            <video
              ref={videoRef}
              src={localPreviewUrl}
              controls
              className="w-full h-full object-contain"
              onLoadedMetadata={(e) => {
                const dur = Math.floor(e.currentTarget.duration);
                if (dur > 0) {
                  setTotalDuration(dur);
                  if (dur < 30) setEndSec(dur);
                }
              }}
              onTimeUpdate={(e) => setPlayheadSec(Math.floor(e.currentTarget.currentTime))}
            />
          ) : videoId ? (
            <iframe
              title="YouTube video player"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
              <Film className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">Load a video above to preview</p>
            </div>
          )}
        </div>

        {/* The 35mm Filmstrip Timeline Scrubber */}
        <div className="pt-2">
          <FilmstripScrubber
            startSec={startSec}
            endSec={endSec}
            durationSec={totalDuration}
            playheadSec={playheadSec}
            onChange={handleScrubberChange}
            maxCapSec={maxCap}
          />
        </div>

        {/* Fine-Tuning Deck (Nudge Buttons & Current Time Pinning) */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          {/* Start Marker Card */}
          <div className="rounded-2xl border border-[#22283d] bg-[#161a2b] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                START MOMENT
              </span>
              {mode === 'local' && (
                <button
                  type="button"
                  onClick={() => pinCurrentTime('start')}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                >
                  📍 Pin Current Playhead
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-black/50 border border-zinc-800 px-3 py-2 text-center font-mono text-xl font-bold text-white tracking-wider">
                {startStr}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustTime('start', -5)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move start back 5 seconds"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', -1)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move start back 1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', 1)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move start forward 1 second"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', 5)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move start forward 5 seconds"
                >
                  +5s
                </button>
              </div>
            </div>
          </div>

          {/* End Marker Card */}
          <div className="rounded-2xl border border-[#22283d] bg-[#161a2b] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                END MOMENT
              </span>
              {mode === 'local' && (
                <button
                  type="button"
                  onClick={() => pinCurrentTime('end')}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                >
                  📍 Pin Current Playhead
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-black/50 border border-zinc-800 px-3 py-2 text-center font-mono text-xl font-bold text-white tracking-wider">
                {endStr}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustTime('end', -5)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move end back 5 seconds"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', -1)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move end back 1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', 1)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move end forward 1 second"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', 5)}
                  className="rounded-lg bg-[#20253a] hover:bg-[#2a314d] border border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-zinc-300 transition-colors"
                  title="Move end forward 5 seconds"
                >
                  +5s
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status / Feedback Pill */}
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{statusMsg}</span>
          </motion.div>
        )}

        {/* Friendly Error Box */}
        {apiError && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>{apiError.title}</span>
            </div>
            <p className="leading-relaxed opacity-90">{apiError.suggestion}</p>
            {apiError.needsBotBypass && (
              <button
                type="button"
                onClick={onRequestOpenBotBypass}
                className="font-semibold text-rose-400 underline hover:text-rose-300 pt-1"
              >
                Add browser sign-in credentials
              </button>
            )}
          </div>
        )}

        {/* Forge Action Button */}
        <div className="pt-2 space-y-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={!rangeCheck.valid || busy}
            onClick={handleExtract}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-rose-600 to-amber-500 hover:from-orange-500 hover:via-rose-500 hover:to-amber-400 py-4 text-base font-extrabold text-white shadow-[0_0_25px_rgba(255,87,34,0.35)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Scissors
              className={`h-5 w-5 transition-transform ${busy ? 'animate-spin' : 'group-hover:rotate-12'}`}
            />
            <span className="tracking-wide">
              {busy
                ? 'FORGING YOUR CLIP...'
                : mode === 'local'
                  ? 'FORGE TRIMMED VIDEO (.mp4)'
                  : 'FORGE THIS CLIP (.mp4)'}
            </span>
          </motion.button>

          {lastClipUrl && (
            <a
              href={lastClipUrl.url}
              download={lastClipUrl.filename}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/80 bg-[#161a2b] hover:bg-[#1f253d] py-3 text-xs sm:text-sm font-semibold text-white transition-colors"
            >
              <Download className="h-4 w-4 text-zinc-400" />
              Download {lastClipUrl.filename} again
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
