import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Scissors } from 'lucide-react';
import {
  MAX_SINGLE_CLIP_SEC,
  classifyApiError,
  formatBytes,
  formatTimecode,
  isLocalFileWasmRisk,
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
  const wasmMemoryWarning = mode === 'local' && localFile ? isLocalFileWasmRisk(localFile.size) : false;

  const markIn = () => {
    const current = videoRef.current ? Math.floor(videoRef.current.currentTime) : playheadSec;
    setStartStr(formatTimecode(current));
  };

  const markOut = () => {
    const current = videoRef.current ? Math.floor(videoRef.current.currentTime) : playheadSec;
    setEndStr(formatTimecode(Math.max(1, current)));
  };

  const handleExtract = async () => {
    if (!rangeCheck.valid) return;
    setApiError(null);
    setStatusMsg(null);

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
        setStatusMsg(`Ready (${formatBytes(result.blob.size)}) — trimmed 100% locally.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Local ffmpeg.wasm trim failed.';
        setApiError({
          code: 'SERVER_ERROR',
          title: 'Browser trim failed',
          detail: message,
          suggestion: 'Confirm the file uses a standard MP4/WebM codec and fits within browser WASM memory.',
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
        setApiError(classifyApiError(0, 'No Backend Gateway URL configured.'));
        return;
      }

      setBusy(true);
      setStatusMsg('Requesting partial section extraction from backend...');
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
          setStatusMsg(null);
          return;
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] || `clipforge_${videoId || 'clip'}_${rangeCheck.startSec}-${rangeCheck.endSec}.mp4`;
        const downloadUrl = URL.createObjectURL(blob);
        setLastClipUrl({ url: downloadUrl, filename });
        setStatusMsg(`Extracted ${formatBytes(blob.size)} via partial download (-c copy).`);
      } catch (err) {
        setApiError(classifyApiError(0, err instanceof Error ? err.message : 'Network error'));
        setStatusMsg(null);
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="grid lg:grid-cols-12">
        {/* Left: Video Preview */}
        <div className="lg:col-span-7 bg-zinc-950 flex flex-col justify-between">
          <div className="aspect-video w-full bg-zinc-950 flex items-center justify-center">
            {mode === 'local' && localPreviewUrl ? (
              <video
                ref={videoRef}
                src={localPreviewUrl}
                controls
                onTimeUpdate={(e) => setPlayheadSec(Math.floor(e.currentTarget.currentTime))}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (Number.isFinite(dur)) {
                    setLocalDuration(dur);
                    setEndStr(formatTimecode(Math.min(Math.max(1, Math.floor(dur)), 30)));
                  }
                }}
                className="h-full w-full object-contain"
              />
            ) : mode === 'youtube-single' && videoId ? (
              <iframe
                title="YouTube video preview"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-xs text-zinc-300">
            <div className="flex items-center gap-2 font-mono tabular-nums">
              {mode === 'local' && localFile ? (
                <>
                  <span className="truncate max-w-[220px] text-zinc-100">{localFile.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatBytes(localFile.size)}</span>
                  {localDuration !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatTimecode(localDuration)}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="text-zinc-100">{videoId}</span>
                  <span aria-hidden="true">·</span>
                  <span>1080p max · 180s cap</span>
                </>
              )}
            </div>

            {mode === 'local' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markIn}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-100 hover:border-zinc-500 whitespace-nowrap shrink-0"
                >
                  [I] Set Start ({formatTimecode(playheadSec)})
                </button>
                <button
                  type="button"
                  onClick={markOut}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-100 hover:border-zinc-500 whitespace-nowrap shrink-0"
                >
                  [O] Set End
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Precision Controls */}
        <div className="lg:col-span-5 p-6 flex flex-col justify-between gap-6 border-t lg:border-t-0 lg:border-l border-zinc-200">
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-zinc-950">
                {mode === 'local' ? 'Local Stream-Copy Trim' : 'Remote Section Extraction'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                {mode === 'local'
                  ? 'Runs 100% in your browser via single-threaded ffmpeg.wasm (-c copy). Zero server upload.'
                  : 'Downloads only the requested byte range via yt-dlp --download-sections + ffmpeg -c copy.'}
              </p>
            </div>

            {wasmMemoryWarning && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Large file (&gt;1.8 GB):</span> Browser WASM memory is capped at ~2 GB
                  per tab. Trimming may fail on very large containers.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="single-start-time" className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Start (MM:SS)
                </label>
                <input
                  id="single-start-time"
                  type="text"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm tabular-nums text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="single-end-time" className="block text-xs font-medium text-zinc-700 mb-1.5">
                  End (MM:SS)
                </label>
                <input
                  id="single-end-time"
                  type="text"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm tabular-nums text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 border-y border-zinc-100 py-2.5 font-mono tabular-nums">
              <span>Clip duration</span>
              <span className={rangeCheck.valid ? 'font-medium text-zinc-900' : 'font-medium text-rose-600'}>
                {rangeCheck.valid ? `${rangeCheck.durationSec}s` : 'Invalid range'}
                {mode === 'youtube-single' ? ` / ${MAX_SINGLE_CLIP_SEC}s max` : ''}
              </span>
            </div>

            {!rangeCheck.valid && rangeCheck.error && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {rangeCheck.error}
              </p>
            )}

            {statusMsg && (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-700">
                {statusMsg}
              </p>
            )}

            {apiError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs space-y-2">
                <p className="font-semibold text-rose-900">{apiError.title}</p>
                <p className="text-rose-800">{apiError.suggestion}</p>
                {apiError.needsBotBypass && (
                  <button
                    type="button"
                    onClick={onRequestOpenBotBypass}
                    className="font-medium text-rose-900 underline underline-offset-4 hover:text-rose-700"
                  >
                    Open Bot-Check Bypass panel
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={!rangeCheck.valid || busy}
              onClick={handleExtract}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Scissors className="h-4 w-4" aria-hidden="true" />
              {busy
                ? 'Processing...'
                : mode === 'local'
                  ? 'Trim Locally (Zero Upload)'
                  : 'Extract Clip'}
            </button>

            {lastClipUrl && (
              <a
                href={lastClipUrl.url}
                download={lastClipUrl.filename}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-900 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Save {lastClipUrl.filename}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
