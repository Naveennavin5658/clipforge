import { useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  CheckSquare,
  Square,
  Layers,
  AlertCircle,
  Coffee,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  MAX_BATCH_CLIP_SEC,
  MAX_BATCH_ITEMS,
  applyBulkRangeToSelected,
  classifyApiError,
  formatBytes,
  shouldShowChaiPrompt,
  toggleBatchRowSelection,
  validateClipRange,
  type BotBypassCredentials,
  type ClassifiedApiError,
  type PlaylistClipRow,
} from '../lib/clipforge';

interface PlaylistBatcherProps {
  canonicalUrl: string;
  listId: string | null;
  apiBaseUrl: string;
  botBypass: BotBypassCredentials;
  onRequestOpenBotBypass: () => void;
  onClipForged?: (count: number) => void;
}

const CHAI_TIP_URL = import.meta.env.VITE_CHAI_TIP_URL || 'https://buymeacoffee.com/clipforge';

export function PlaylistBatcher({
  canonicalUrl,
  listId,
  apiBaseUrl,
  botBypass,
  onRequestOpenBotBypass,
  onClipForged,
}: PlaylistBatcherProps) {
  const [playlistTitle, setPlaylistTitle] = useState<string>('YouTube Playlist');
  const [rows, setRows] = useState<PlaylistClipRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [bulkStart, setBulkStart] = useState('00:00');
  const [bulkEnd, setBulkEnd] = useState('00:30');
  const [capWarning, setCapWarning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ClassifiedApiError | null>(null);
  const [zipDownload, setZipDownload] = useState<{ url: string; size: number } | null>(null);

  useEffect(() => {
    return () => {
      if (zipDownload) URL.revokeObjectURL(zipDownload.url);
    };
  }, [zipDownload]);

  const fetchPlaylistMeta = async () => {
    const base = apiBaseUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setApiError(classifyApiError(0, 'Helper server is offline.'));
      return;
    }

    setLoadingMeta(true);
    setApiError(null);
    setCapWarning(false);
    setStatusMsg(null);
    setZipDownload(null);

    try {
      const headers: Record<string, string> = {};
      if (botBypass.cookiesTxt.trim()) headers['X-YT-Cookies'] = botBypass.cookiesTxt.trim();
      if (botBypass.poToken.trim()) headers['X-YT-PO-Token'] = botBypass.poToken.trim();

      const res = await fetch(`${base}/playlist-meta?url=${encodeURIComponent(canonicalUrl)}`, { headers });
      if (!res.ok) {
        const text = await res.text();
        setApiError(classifyApiError(res.status, text, res.headers.get('Retry-After')));
        return;
      }

      const data = await res.json();
      setPlaylistTitle(data.title || 'YouTube Playlist');

      const items = (data.items || []).map((it: { id: string; title: string; duration?: number; url: string }, idx: number) => ({
        id: it.id || `item_${idx}`,
        title: it.title || `Video ${idx + 1}`,
        durationSec: it.duration ?? null,
        url: it.url,
        selected: idx < 5,
        start: '00:00',
        end: '00:30',
      }));

      setRows(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load playlist info';
      setApiError(classifyApiError(0, message));
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    fetchPlaylistMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalUrl, listId]);

  const handleToggleRow = (id: string) => {
    const { nextRows, capExceeded } = toggleBatchRowSelection(rows, id, MAX_BATCH_ITEMS);
    setRows(nextRows);
    setCapWarning(capExceeded);
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      let count = 0;
      setRows(
        rows.map((r) => {
          if (count < MAX_BATCH_ITEMS) {
            count++;
            return { ...r, selected: true };
          }
          return { ...r, selected: false };
        }),
      );
    } else {
      setRows(rows.map((r) => ({ ...r, selected: false })));
    }
  };

  const handleApplyBulk = () => {
    const updated = applyBulkRangeToSelected(rows, bulkStart, bulkEnd);
    setRows(updated);
  };

  const handleDownloadBatch = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    const validatedItems = [];
    for (const item of selected) {
      const check = validateClipRange(item.start, item.end, MAX_BATCH_CLIP_SEC);
      if (!check.valid) {
        setApiError({
          code: 'INVALID_RANGE',
          title: `Time issue in "${item.title}"`,
          detail: check.error || `Clips must be between 1s and ${MAX_BATCH_CLIP_SEC}s`,
          suggestion: `Please adjust timestamps for "${item.title}" before downloading.`,
          needsBotBypass: false,
        });
        return;
      }
      validatedItems.push({
        id: item.id,
        title: item.title,
        url: item.url,
        start_sec: check.startSec,
        end_sec: check.endSec,
      });
    }

    const base = apiBaseUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setApiError(classifyApiError(0, 'Helper server is offline.'));
      return;
    }

    setBatchBusy(true);
    setApiError(null);
    setStatusMsg(`Packaging ${validatedItems.length} clips into your ZIP archive...`);

    try {
      const res = await fetch(`${base}/batch-clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validatedItems,
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
      const downloadUrl = URL.createObjectURL(blob);
      setZipDownload({ url: downloadUrl, size: blob.size });
      setStatusMsg(`Success! ${validatedItems.length} clips forged into ZIP (${formatBytes(blob.size)}).`);
      onClipForged?.(validatedItems.length);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `clipforge_${playlistTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.zip`;
      a.click();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Batch download failed';
      setApiError(classifyApiError(0, message));
    } finally {
      setBatchBusy(false);
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const showChaiTip = shouldShowChaiPrompt(selectedCount);

  return (
    <div className="space-y-6">
      {/* Studio Playlist Box */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-[#22283d] bg-white dark:bg-[#121420] p-6 shadow-lg shadow-slate-100 dark:shadow-2xl space-y-5 transition-colors duration-150">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#202538] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-md">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-wide">
                {playlistTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                {rows.length > 0 ? `${rows.length} TRACKS LOADED • SELECT UP TO ${MAX_BATCH_ITEMS} TO FORGE` : 'LOADING PLAYLIST DECK...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchPlaylistMeta}
            disabled={loadingMeta}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-[#191d2f] dark:hover:bg-[#232942] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMeta ? 'animate-spin' : ''}`} />
            Refresh Tracks
          </button>
        </div>

        {/* Bulk Duration Controller */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-[#161a2b] border border-slate-200 dark:border-[#242b45] p-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">Set Length for All Selected:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <input
                  type="text"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                  className="w-14 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-black/60 text-slate-900 dark:text-white px-2 py-1 text-center text-xs font-bold"
                />
                <span className="text-slate-400 dark:text-zinc-500">to</span>
                <input
                  type="text"
                  value={bulkEnd}
                  onChange={(e) => setBulkEnd(e.target.value)}
                  className="w-14 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-black/60 text-slate-900 dark:text-white px-2 py-1 text-center text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyBulk}
                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500 underline cursor-pointer"
              >
                Select 15
              </button>
              <span className="text-slate-300 dark:text-zinc-600">·</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Cap Warning */}
        {capWarning && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <span>Maximum 15 clips per batch to keep ZIP processing fast and smooth.</span>
          </div>
        )}

        {/* Video List */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              onClick={() => handleToggleRow(row.id)}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                row.selected
                  ? 'border-purple-400/50 bg-purple-50/70 dark:bg-purple-500/10 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 dark:border-[#202538] dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-[#0e101a]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  aria-label={row.selected ? 'Deselect clip' : 'Select clip'}
                  className="text-purple-600 dark:text-purple-400 shrink-0 cursor-pointer"
                >
                  {row.selected ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-400 dark:text-zinc-600" />
                  )}
                </button>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs text-slate-400 dark:text-zinc-500 w-6">{idx + 1}.</span>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-zinc-200 truncate">
                    {row.title}
                  </p>
                </div>
              </div>

              {/* Time inputs per row */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={row.start}
                  onChange={(e) => {
                    const next = rows.map((r) => (r.id === row.id ? { ...r, start: e.target.value } : r));
                    setRows(next);
                  }}
                  className="w-14 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-black/60 text-slate-900 dark:text-white px-1.5 py-1 text-center font-mono text-xs font-bold"
                />
                <span className="text-slate-400 dark:text-zinc-600 text-xs">-</span>
                <input
                  type="text"
                  value={row.end}
                  onChange={(e) => {
                    const next = rows.map((r) => (r.id === row.id ? { ...r, end: e.target.value } : r));
                    setRows(next);
                  }}
                  className="w-14 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-black/60 text-slate-900 dark:text-white px-1.5 py-1 text-center font-mono text-xs font-bold"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Chai Tip Prompt for large batches */}
        {showChaiTip && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <Coffee className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>Cutting {selectedCount} videos at once! ClipForge is 100% free with no watermark.</p>
            </div>
            <a
              href={CHAI_TIP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-amber-600 dark:bg-amber-500 hover:bg-amber-500 dark:hover:bg-amber-400 px-3 py-1.5 font-bold text-white shadow-xs shrink-0 transition-colors"
            >
              Tip a Chai ☕
            </a>
          </div>
        )}

        {/* Status Message */}
        {statusMsg && (
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-3 text-xs text-purple-700 dark:text-purple-300">
            {statusMsg}
          </div>
        )}

        {/* Error Box */}
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

        {/* Download Batch Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={selectedCount === 0 || batchBusy}
          onClick={handleDownloadBatch}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-rose-600 to-amber-500 hover:from-orange-500 hover:via-rose-500 hover:to-amber-400 py-4 text-base font-extrabold text-white shadow-[0_0_25px_rgba(255,87,34,0.3)] transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <Download className={`h-5 w-5 ${batchBusy ? 'animate-bounce' : ''}`} />
          <span>
            {batchBusy
              ? `FORGING ${selectedCount} CLIPS...`
              : `FORGE & DOWNLOAD ALL ${selectedCount} CLIPS (.zip)`}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
