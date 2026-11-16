import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Film,
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
  onClipForged?: () => void;
}

export function SingleClipper({
  mode,
  localFile,
  videoId,
  canonicalUrl,
  apiBaseUrl,
  botBypass,
  onRequestOpenBotBypass,
  onClipForged,
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

  const [startInput, setStartInput] = useState<string>('00:00');
  const [endInput, setEndInput] = useState<string>(mode === 'local' ? '00:05' : '00:30');
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [isEditingEnd, setIsEditingEnd] = useState(false);

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
    const initialEnd = mode === 'local' ? 5 : 30;
    setEndSec(initialEnd);
    setStartInput('00:00');
    setEndInput(formatTimecode(initialEnd));
    setIsEditingStart(false);
    setIsEditingEnd(false);
  }, [mode, videoId, localFile]);

  useEffect(() => {
    if (!isEditingStart) {
      setStartInput(formatTimecode(startSec));
    }
  }, [startSec, isEditingStart]);

  useEffect(() => {
    if (!isEditingEnd) {
      setEndInput(formatTimecode(endSec));
    }
  }, [endSec, isEditingEnd]);

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
      const next = Math.max(0, startSec + delta);
      setStartSec(next);
      if (next >= endSec) {
        const nextEnd = next + (mode === 'local' ? 5 : 30);
        setEndSec(nextEnd);
        setEndInput(formatTimecode(nextEnd));
        setTotalDuration((prev) => Math.max(prev, nextEnd + 60));
      }
    } else {
      const next = Math.max(0, endSec + delta);
      setEndSec(next);
      setEndInput(formatTimecode(next));
      setTotalDuration((prev) => Math.max(prev, next + 60));
    }
  };

  const pinCurrentTime = (target: 'start' | 'end') => {
    if (!videoRef.current) return;
    const current = Math.floor(videoRef.current.currentTime);
    if (target === 'start') {
      setStartSec(current);
      if (current >= endSec) {
        const nextEnd = current + (mode === 'local' ? 5 : 30);
        setEndSec(nextEnd);
        setEndInput(formatTimecode(nextEnd));
        setTotalDuration((prev) => Math.max(prev, nextEnd + 60));
      }
    } else {
      setEndSec(current);
      setEndInput(formatTimecode(current));
      setTotalDuration((prev) => Math.max(prev, current + 60));
    }
  };

  const setPresetDuration = (seconds: number) => {
    const capped = maxCap ? Math.min(seconds, maxCap) : seconds;
    const nextEnd = startSec + capped;
    setEndSec(nextEnd);
    setEndInput(formatTimecode(nextEnd));
    setTotalDuration((prev) => Math.max(prev, nextEnd + 60));
  };

  const handleStartInputChange = (val: string) => {
    setStartInput(val);
    const parsed = parseTimecode(val);
    if (parsed !== null && parsed >= 0) {
      setStartSec(parsed);
      if (parsed >= endSec) {
        const nextEnd = parsed + (mode === 'local' ? 5 : 30);
        setEndSec(nextEnd);
        setEndInput(formatTimecode(nextEnd));
        setTotalDuration((prev) => Math.max(prev, nextEnd + 60));
      } else {
        setTotalDuration((prev) => Math.max(prev, endSec + 60));
      }
    }
  };

  const handleStartInputBlur = () => {
    setIsEditingStart(false);
    const parsed = parseTimecode(startInput);
    if (parsed !== null && parsed >= 0) {
      setStartSec(parsed);
      setStartInput(formatTimecode(parsed));
      if (parsed >= endSec) {
        const nextEnd = parsed + (mode === 'local' ? 5 : 30);
        setEndSec(nextEnd);
        setEndInput(formatTimecode(nextEnd));
        setTotalDuration((prev) => Math.max(prev, nextEnd + 60));
      } else {
        setTotalDuration((prev) => Math.max(prev, endSec + 60));
      }
    } else {
      setStartInput(formatTimecode(startSec));
    }
  };

  const handleEndInputChange = (val: string) => {
    setEndInput(val);
    const parsed = parseTimecode(val);
    if (parsed !== null && parsed >= 0) {
      setEndSec(parsed);
      setTotalDuration((prev) => Math.max(prev, parsed + 60));
    }
  };

  const handleEndInputBlur = () => {
    setIsEditingEnd(false);
    const parsed = parseTimecode(endInput);
    if (parsed !== null && parsed >= 0) {
      setEndSec(parsed);
      setEndInput(formatTimecode(parsed));
      setTotalDuration((prev) => Math.max(prev, parsed + 60));
    } else {
      setEndInput(formatTimecode(endSec));
    }
  };

  const handleExtract = async () => {
    if (!rangeCheck.valid) return;
    setBusy(true);
    setStatusMsg(null);
    setApiError(null);

    if (mode === 'local') {
      if (!localFile) {
        setBusy(false);
        return;
      }
      try {
        setStatusMsg('Trimming video locally in browser via WebAssembly...');
        const resultBlob = await trimLocalVideoWithWasm(
          localFile,
          rangeCheck.startSec,
          rangeCheck.endSec,
          (ratio) => {
            setStatusMsg(`Trimming locally in browser... ${Math.round(ratio * 100)}%`);
          },
        );

        const outName = `${localFile.name.replace(/\.[^/.]+$/, '')}_clip_${Math.floor(rangeCheck.startSec)}-${Math.floor(rangeCheck.endSec)}.mp4`;
        const downloadUrl = URL.createObjectURL(resultBlob);
        setLastClipUrl({ url: downloadUrl, filename: outName });
        setStatusMsg(`Clip Ready (${formatBytes(resultBlob.size)})! Downloading now...`);
        onClipForged?.();

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = outName;
        a.click();
      } catch (err) {
        setStatusMsg(null);
        setApiError({
          title: 'Local Trimming Failed',
          suggestion:
            err instanceof Error
              ? err.message
              : 'WebAssembly memory or format issue. Try a shorter range.',
          status: 500,
        });
      } finally {
        setBusy(false);
      }
    } else {
      const base = apiBaseUrl.trim().replace(/\/+$/, '');
      if (!base) {
        setApiError(classifyApiError(0, 'Helper server is offline. Please configure server URL.'));
        setBusy(false);
        return;
      }

      try {
        setStatusMsg('Sending clip job to forge worker...');
        const targetUrl = canonicalUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (botBypass.cookiesTxt.trim()) headers['X-YT-Cookies'] = botBypass.cookiesTxt.trim();
        if (botBypass.poToken.trim()) headers['X-YT-PO-Token'] = botBypass.poToken.trim();

        const res = await fetch(`${base}/clip`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: targetUrl,
            start_sec: rangeCheck.startSec,
            end_sec: rangeCheck.endSec,
            start_time: rangeCheck.startFormatted,
            end_time: rangeCheck.endFormatted,
            ...(botBypass.cookiesTxt.trim() ? { cookies_txt: botBypass.cookiesTxt.trim() } : {}),
            ...(botBypass.poToken.trim() ? { po_token: botBypass.poToken.trim() } : {}),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          setApiError(classifyApiError(res.status, text, res.headers.get('Retry-After')));
          return;
        }

        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/);
        const filename = match ? match[1] : `clip_${Math.floor(rangeCheck.startSec)}-${Math.floor(rangeCheck.endSec)}.mp4`;

        const downloadUrl = URL.createObjectURL(blob);
        setLastClipUrl({ url: downloadUrl, filename });
        setStatusMsg(`Clip Ready (${formatBytes(blob.size)})! Downloading now...`);
        onClipForged?.();

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
      <div className="rounded-3xl border border-slate-200/90 dark:border-[#23283c] bg-white dark:bg-[#121422] p-5 sm:p-7 shadow-lg shadow-slate-100 dark:shadow-2xl space-y-6 transition-colors duration-150">
        {/* Top Header inside card */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#202538] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_#ff6b00]" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-wide">
              {mode === 'local' ? 'Local Studio Player' : 'Live YouTube Cutting Deck'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono hidden sm:inline">PRESET LENGTHS:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPresetDuration(15)}
                className="rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-700 dark:bg-[#1a1e30] dark:hover:bg-orange-500/20 dark:hover:text-orange-400 border border-slate-200 dark:border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                ⚡ 15s
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(30)}
                className="rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-700 dark:bg-[#1a1e30] dark:hover:bg-orange-500/20 dark:hover:text-orange-400 border border-slate-200 dark:border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                🔥 30s
              </button>
              <button
                type="button"
                onClick={() => setPresetDuration(60)}
                className="rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-700 dark:bg-[#1a1e30] dark:hover:bg-orange-500/20 dark:hover:text-orange-400 border border-slate-200 dark:border-zinc-700/60 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                🎬 60s
              </button>
            </div>
          </div>
        </div>

        {/* Video Preview Frame */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-black aspect-video relative group shadow-inner">
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
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500">
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
            durationSec={Math.max(totalDuration, endSec + 60, startSec + 120)}
            playheadSec={playheadSec}
            onChange={handleScrubberChange}
            maxCapSec={maxCap}
          />
        </div>

        {/* Fine-Tuning Deck (Nudge Buttons & Current Time Pinning) */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          {/* Start Marker Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#22283d] bg-slate-50 dark:bg-[#161a2b] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                START MOMENT
              </span>
              {mode === 'local' && (
                <button
                  type="button"
                  onClick={() => pinCurrentTime('start')}
                  className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors cursor-pointer"
                >
                  📍 Pin Current Playhead
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={startInput}
                onFocus={() => setIsEditingStart(true)}
                onChange={(e) => handleStartInputChange(e.target.value)}
                onBlur={handleStartInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                aria-label="Start time (e.g. 00:00 or seconds)"
                title="Click to type exact time (e.g. 00:15 or 15)"
                className="flex-1 min-w-0 rounded-xl bg-white dark:bg-black/50 border border-slate-300 dark:border-zinc-800 px-3 py-2 text-center font-mono text-xl font-bold text-slate-900 dark:text-white tracking-wider shadow-inner focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-text"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustTime('start', -5)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move start back 5 seconds"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', -1)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move start back 1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', 1)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move start forward 1 second"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('start', 5)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move start forward 5 seconds"
                >
                  +5s
                </button>
              </div>
            </div>
          </div>

          {/* End Marker Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#22283d] bg-slate-50 dark:bg-[#161a2b] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                END MOMENT
              </span>
              {mode === 'local' && (
                <button
                  type="button"
                  onClick={() => pinCurrentTime('end')}
                  className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors cursor-pointer"
                >
                  📍 Pin Current Playhead
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={endInput}
                onFocus={() => setIsEditingEnd(true)}
                onChange={(e) => handleEndInputChange(e.target.value)}
                onBlur={handleEndInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                aria-label="End time (e.g. 00:30 or seconds)"
                title="Click to type exact time (e.g. 01:20 or 80)"
                className="flex-1 min-w-0 rounded-xl bg-white dark:bg-black/50 border border-slate-300 dark:border-zinc-800 px-3 py-2 text-center font-mono text-xl font-bold text-slate-900 dark:text-white tracking-wider shadow-inner focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all cursor-text"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustTime('end', -5)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move end back 5 seconds"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', -1)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move end back 1 second"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', 1)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
                  title="Move end forward 1 second"
                >
                  +1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustTime('end', 5)}
                  className="rounded-lg bg-white hover:bg-slate-100 dark:bg-[#20253a] dark:hover:bg-[#2a314d] border border-slate-200 dark:border-zinc-700/60 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
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
            className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{statusMsg}</span>
          </motion.div>
        )}

        {/* Friendly Error Box */}
        {apiError && (
          <div className="rounded-2xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 space-y-2 text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>{apiError.title}</span>
            </div>
            <p className="leading-relaxed opacity-90">{apiError.suggestion}</p>
            {apiError.needsBotBypass && (
              <button
                type="button"
                onClick={onRequestOpenBotBypass}
                className="font-semibold text-rose-600 dark:text-rose-400 underline hover:text-rose-500 pt-1 cursor-pointer"
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
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-rose-600 to-amber-500 hover:from-orange-500 hover:via-rose-500 hover:to-amber-400 py-4 text-base font-extrabold text-white shadow-[0_0_25px_rgba(255,87,34,0.35)] transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-700/80 bg-slate-100 hover:bg-slate-200 dark:bg-[#161a2b] dark:hover:bg-[#1f253d] py-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-white transition-colors shadow-xs"
            >
              <Download className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
              Download {lastClipUrl.filename} again
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
