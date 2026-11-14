import { useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  CheckSquare,
  Square,
  Layers,
  Clock,
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
  formatTimecode,
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
      const message = err instanceof Error ? err.message : 'Could not fetch playlist';
      setApiError(classifyApiError(0, message));
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (canonicalUrl) {
      fetchPlaylistMeta();
    }
  }, [canonicalUrl, listId]);

  const selectedCount = rows.filter((r) => r.selected).length;
  const showChai = shouldShowChaiPrompt(selectedCount);

  const handleToggleRow = (id: string) => {
    const result = toggleBatchRowSelection(rows, id);
    setRows(result.rows);
    setCapWarning(result.capReached);
  };

  const handleSelectAll = (select: boolean) => {
    const updated = rows.map((r, i) => ({
      ...r,
      selected: select ? i < MAX_BATCH_ITEMS : false,
    }));
    setRows(updated);
    if (select && rows.length > MAX_BATCH_ITEMS) {
      setCapWarning(true);
    } else {
      setCapWarning(false);
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

  return (
    <div className="space-y-6">
      {/* Studio Playlist Box */}
      <div className="rounded-3xl border border-[#22283d] bg-[#121420] p-6 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#202538] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-md">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white tracking-wide">
                {playlistTitle}
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {rows.length > 0 ? `${rows.length} TRACKS LOADED • SELECT UP TO ${MAX_BATCH_ITEMS} TO FORGE` : 'LOADING PLAYLIST DECK...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchPlaylistMeta}
            disabled={loadingMeta}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#191d2f] hover:bg-[#232942] px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMeta ? 'animate-spin' : ''}`} />
            Refresh Tracks
          </button>
        </div>

        {/* Bulk Duration Controller */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#161a2b] border border-[#242b45] p-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-zinc-300">Set Length for All Selected:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <input
                  type="text"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                  className="w-14 rounded-lg border border-zinc-700 bg-black/60 text-white px-2 py-1 text-center text-xs font-bold"
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="text"
                  value={bulkEnd}
                  onChange={(e) => setBulkEnd(e.target.value)}
                  className="w-14 rounded-lg border border-zinc-700 bg-black/60 text-white px-2 py-1 text-center text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyBulk}
                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                Apply
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="font-semibold text-purple-400 hover:text-purple-300 underline"
              >
                Select 15
              </button>
              <span className="text-zinc-600">·</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="font-semibold text-zinc-400 hover:text-white underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Cap Warning */}
        {capWarning && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
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
                  ? 'border-purple-500/50 bg-purple-500/10 shadow-sm'
                  : 'border-[#202538] hover:border-zinc-700 bg-[#0e101a]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  aria-label={row.selected ? 'Deselect clip' : 'Select clip'}
                  className="text-purple-400 shrink-0"
                >
                  {row.selected ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5 text-zinc-600" />
                  )}
                </button>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs text-zinc-500 w-6">{idx + 1}.</span>
                  <p className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
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
                  className="w-14 rounded-lg border border-zinc-700 bg-black/60 text-white px-1.5 py-1 text-center font-mono text-xs"
                />
                <span className="text-zinc-600 text-xs">-</span>
                <input
                  type="text"
                  value={row.end}
                  onChange={(e) => {
                    const next = rows.map((r) => (r.id === row.id ? { ...r, end: e.target.value } : r));
                    setRows(next);
                  }}
                  className="w-14 rounded-lg border border-zinc-700 bg-black/60 text-white px-1.5 py-1 text-center font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Chai tip */}
        {showChai && (
          <div className="flex items-center justify-between rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-400" />
              <span>Enjoying multi-clip batch downloads? Consider buying the developer a chai!</span>
            </div>
            <a
              href={CHAI_TIP_URL}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline text-amber-400 hover:text-amber-300"
            >
              Tip a Chai ☕
            </a>
          </div>
        )}

        {/* Status or Error */}
        {statusMsg && (
          <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 font-medium">
            {statusMsg}
          </p>
        )}

        {apiError && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300 space-y-1">
            <p className="font-bold">{apiError.title}</p>
            <p>{apiError.suggestion}</p>
          </div>
        )}

        {/* Download Batch Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={selectedCount === 0 || batchBusy}
          onClick={handleDownloadBatch}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 py-4 text-base font-extrabold text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className={`h-5 w-5 ${batchBusy ? 'animate-bounce' : ''}`} />
          <span className="tracking-wide">
            {batchBusy
              ? 'PACKAGING CLIPS INTO ZIP...'
              : `FORGE ${selectedCount} SELECTED CLIPS (ZIP)`}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
