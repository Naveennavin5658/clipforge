import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Scissors,
  Sparkles,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Film,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [startStr, setStartStr] = useState('00:00');
  const [endStr, setEndStr] = useState(mode === 'local' ? '00:04' : '00:30');
  const [playheadSec, setPlayheadSec] = useState(0);
  const [localDuration, setLocalDuration] = useState<number | null>(null);
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
    setStartStr('00:00');
    setEndStr(mode === 'local' ? '00:04' : '00:30');
  }, [mode, videoId, localFile]);

  const maxCap = mode === 'local' ? null : MAX_SINGLE_CLIP_SEC;
  const rangeCheck = validateClipRange(startStr, endStr, maxCap);

  // Time manipulation helpers
  const adjustTime = (target: 'start' | 'end', deltaSeconds: number) => {
    const current = target === 'start' ? parseTimecode(startStr) ?? 0 : parseTimecode(endStr) ?? 30;
    const updated = Math.max(0, current + deltaSeconds);
    if (target === 'start') {
      setStartStr(formatTimecode(updated));
    } else {
      setEndStr(formatTimecode(updated));
    }
  };

  const setPresetDuration = (seconds: number) => {
    const start = parseTimecode(startStr) ?? 0;
    setEndStr(formatTimecode(start + seconds));
  };

  const pinCurrentTime = (target: 'start' | 'end') => {
    let current = playheadSec;
    if (videoRef.current) {
      current = Math.floor(videoRef.current.currentTime);
    }
    if (target === 'start') {
      setStartStr(formatTimecode(current));
    } else {
      setEndStr(formatTimecode(Math.max(current, 1)));
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
        setStatusMsg(`Your clip is ready (${formatBytes(result.blob.size)})!`);
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
        setApiError(classifyApiError(0, 'Backend is not configured.'));
        return;
      }

      setBusy(true);
      setStatusMsg('Connecting to video source...');
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

        setStatusMsg('Downloading your clip...');
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/);
        const filename = match ? match[1] : `clip_${Math.floor(rangeCheck.startSec)}-${Math.floor(rangeCheck.endSec)}.mp4`;

        const downloadUrl = URL.createObjectURL(blob);
        setLastClipUrl({ url: downloadUrl, filename });
        setStatusMsg(`Your clip is ready (${formatBytes(blob.size)})!`);

        // Trigger immediate browser download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.click();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        setApiError(classifyApiError(0, message));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Video Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-zinc-950 shadow-md">
            {mode === 'local' && localPreviewUrl ? (
              <video
                ref={videoRef}
                src={localPreviewUrl}
                controls
                className="w-full aspect-video bg-black object-contain"
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  setLocalDuration(dur);
                  if (dur && dur < 30) {
                    setEndStr(formatTimecode(Math.floor(dur)));
                  }
                }}
                onTimeUpdate={(e) => setPlayheadSec(Math.floor(e.currentTarget.currentTime))}
              />
            ) : videoId ? (
              <div className="relative aspect-video w-full bg-zinc-900">
                <iframe
                  title="YouTube video preview"
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-zinc-400">
                <Film className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No video loaded</p>
              </div>
            )}
          </div>

          {/* Quick instructions / tips */}
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Adjust start &amp; end times below to trim your clip.
            </span>
            {localDuration && (
              <span className="font-mono">Total length: {formatTimecode(localDuration)}</span>
            )}
          </div>
        </div>

        {/* Right Column: Time Picker & Actions */}
        <div className="lg:col-span-5 space-y-5 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-zinc-950">
              Select Your Clip
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Choose the exact start and end moments for your video.
            </p>
          </div>

          {/* Quick Duration Preset Pills */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Quick Length Presets
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPresetDuration(15)}
                className="flex items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 py-2 text-xs font-semibold text-zinc-700 transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-rose-500" />
                15s Story
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(30)}
                className="flex items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 py-2 text-xs font-semibold text-zinc-700 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                30s Short
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(60)}
                className="flex items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 py-2 text-xs font-semibold text-zinc-700 transition-colors"
              >
                <Film className="h-3.5 w-3.5 text-blue-500" />
                60s Clip
              </button>
            </div>
          </div>

          {/* Interactive Start / End Controls */}
          <div className="space-y-4">
            {/* Start Time Box */}
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="single-start-time" className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  Start Moment
                </label>
                {mode === 'local' && (
                  <button
                    type="button"
                    onClick={() => pinCurrentTime('start')}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    📍 Use current video time
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="single-start-time"
                  type="text"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  placeholder="00:00"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-base font-semibold text-zinc-950 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustTime('start', -5)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move back 5 seconds"
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('start', -1)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move back 1 second"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('start', 1)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move forward 1 second"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('start', 5)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move forward 5 seconds"
                  >
                    +5s
                  </button>
                </div>
              </div>
            </div>

            {/* End Time Box */}
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="single-end-time" className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                  End Moment
                </label>
                {mode === 'local' && (
                  <button
                    type="button"
                    onClick={() => pinCurrentTime('end')}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    📍 Use current video time
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="single-end-time"
                  type="text"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  placeholder="00:30"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-base font-semibold text-zinc-950 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustTime('end', -5)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move back 5 seconds"
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('end', -1)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move back 1 second"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('end', 1)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move forward 1 second"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTime('end', 5)}
                    className="rounded-lg bg-zinc-200/70 hover:bg-zinc-200 px-2 py-2 text-xs font-mono font-medium text-zinc-700"
                    title="Move forward 5 seconds"
                  >
                    +5s
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Clip Duration Summary Pill */}
          <div className="flex items-center justify-between rounded-xl bg-zinc-100/80 px-4 py-2.5 text-xs">
            <span className="text-zinc-600 font-medium">Selected Duration:</span>
            <span
              className={`font-mono text-sm font-bold ${
                rangeCheck.valid ? 'text-zinc-950' : 'text-rose-600'
              }`}
            >
              {rangeCheck.valid ? `${rangeCheck.durationSec} seconds` : 'Invalid time range'}
            </span>
          </div>

          {/* Error / Validation Warning */}
          {!rangeCheck.valid && rangeCheck.error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{rangeCheck.error}</span>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusMsg}</span>
            </motion.div>
          )}

          {/* Friendly Error Box */}
          {apiError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2 text-xs text-rose-900"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>{apiError.title}</span>
              </div>
              <p className="text-rose-800 leading-relaxed">{apiError.suggestion}</p>
              {apiError.needsBotBypass && (
                <button
                  type="button"
                  onClick={onRequestOpenBotBypass}
                  className="inline-flex items-center gap-1 font-semibold text-rose-700 underline underline-offset-4 hover:text-rose-900 pt-1"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Click here to add browser cookies for protected videos
                </button>
              )}
            </motion.div>
          )}

          {/* Big Action Button */}
          <div className="space-y-3 pt-1">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={!rangeCheck.valid || busy}
              onClick={handleExtract}
              className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 px-6 py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-rose-600/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors className={`h-5 w-5 transition-transform ${busy ? 'animate-spin' : 'group-hover:rotate-12'}`} />
              <span>
                {busy
                  ? 'Cutting your clip...'
                  : mode === 'local'
                    ? 'Download Trimmed Video'
                    : 'Download Clip (.mp4)'}
              </span>
            </motion.button>

            {lastClipUrl && (
              <a
                href={lastClipUrl.url}
                download={lastClipUrl.filename}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white hover:bg-zinc-50 py-3 text-xs sm:text-sm font-semibold text-zinc-900 shadow-sm transition-colors"
              >
                <Download className="h-4 w-4 text-zinc-500" />
                Download {lastClipUrl.filename} again
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
