import { useEffect, useState } from 'react';
import { Coffee, Download, RefreshCw } from 'lucide-react';
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
}

const CHAI_TIP_URL = import.meta.env.VITE_CHAI_TIP_URL || 'https://buymeacoffee.com/clipforge';

export function PlaylistBatcher({
  canonicalUrl,
  listId,
  apiBaseUrl,
  botBypass,
  onRequestOpenBotBypass,
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
      setApiError(classifyApiError(0, 'No Backend Gateway URL configured.'));
      return;
    }

    setLoadingMeta(true);
    setApiError(null);
    setStatusMsg(null);
    setCapWarning(false);

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

      const data = (await res.json()) as {
        title?: string;
        items?: Array<{ id: string; title: string; duration: number | null; url: string }>;
      };

      const mapped: PlaylistClipRow[] = (data.items || []).map((item, idx) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        durationSec: item.duration,
        selected: idx < 3,
        start: '00:00',
        end: '00:30',
      }));

      setPlaylistTitle(data.title || 'YouTube Playlist');
      setRows(mapped);
    } catch (err) {
      setApiError(classifyApiError(0, err instanceof Error ? err.message : 'Network error'));
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setZipDownload(null);
    void fetchPlaylistMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalUrl]);

  const selectedRows = rows.filter((r) => r.selected);
  const showChai = shouldShowChaiPrompt(selectedRows.length);

  const handleToggleRow = (id: string) => {
    const result = toggleBatchRowSelection(rows, id, MAX_BATCH_ITEMS);
    setRows(result.rows);
    setCapWarning(result.capReached);
  };

  const handleRowTime = (id: string, field: 'start' | 'end', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleApplyBulk = () => {
    const check = validateClipRange(bulkStart, bulkEnd, MAX_BATCH_CLIP_SEC);
    if (!check.valid) {
      setStatusMsg(check.error || 'Invalid bulk range.');
      return;
    }
    setStatusMsg(null);
    setRows((prev) => applyBulkRangeToSelected(prev, bulkStart, bulkEnd));
  };

  const handleDownloadBatch = async () => {
    if (selectedRows.length === 0) return;

    const validatedItems = [];
    for (const row of selectedRows) {
      const check = validateClipRange(row.start, row.end, MAX_BATCH_CLIP_SEC);
      if (!check.valid) {
        setStatusMsg(`"${row.title}": ${check.error}`);
        return;
      }
      validatedItems.push({
        id: row.id,
        title: row.title,
        url: row.url,
        start_sec: check.startSec,
        end_sec: check.endSec,
      });
    }

    const base = apiBaseUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setApiError(classifyApiError(0, 'No Backend Gateway URL configured.'));
      return;
    }

    setBatchBusy(true);
    setApiError(null);
    setStatusMsg(`Streaming ZIP for ${validatedItems.length} clips (max 3 concurrent slots)...`);
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
        setStatusMsg(null);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setZipDownload({ url, size: blob.size });
      setStatusMsg(`Batch ZIP ready (${formatBytes(blob.size)}).`);
    } catch (err) {
      setApiError(classifyApiError(0, err instanceof Error ? err.message : 'Network error'));
      setStatusMsg(null);
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-950">{playlistTitle}</h2>
          <p className="text-xs text-zinc-500 font-mono tabular-nums mt-0.5">
            {listId || 'Playlist'} · {selectedRows.length} / {MAX_BATCH_ITEMS} clips selected · {MAX_BATCH_CLIP_SEC}s per clip max
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loadingMeta}
            onClick={fetchPlaylistMeta}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMeta ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh Metadata
          </button>

          <button
            type="button"
            disabled={selectedRows.length === 0 || batchBusy}
            onClick={handleDownloadBatch}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {batchBusy ? 'Streaming ZIP...' : `Download Batch ZIP (${selectedRows.length})`}
          </button>
        </div>
      </div>

      {/* Bulk Range Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-zinc-700">Bulk range:</span>
          <label htmlFor="bulk-start" className="sr-only">
            Bulk start time
          </label>
          <input
            id="bulk-start"
            type="text"
            value={bulkStart}
            onChange={(e) => setBulkStart(e.target.value)}
            className="w-20 rounded border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-zinc-900"
          />
          <span className="text-zinc-400">to</span>
          <label htmlFor="bulk-end" className="sr-only">
            Bulk end time
          </label>
          <input
            id="bulk-end"
            type="text"
            value={bulkEnd}
            onChange={(e) => setBulkEnd(e.target.value)}
            className="w-20 rounded border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums text-zinc-900"
          />
          <button
            type="button"
            onClick={handleApplyBulk}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0"
          >
            Apply {bulkStart}–{bulkEnd} to selected
          </button>
        </div>

        {capWarning && (
          <p role="alert" className="text-xs font-medium text-amber-700">
            Free-tier cap: maximum {MAX_BATCH_ITEMS} clips per ZIP batch.
          </p>
        )}
      </div>

      {/* Non-blocking $0.10 Chai Prompt (>5 clips) */}
      {showChai && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50/70 px-6 py-3 text-xs">
          <div className="flex items-center gap-2.5 text-zinc-800">
            <Coffee className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              Clipping {selectedRows.length} videos in one go — if ClipForge saves you a multi-GB download, chip in{' '}
              <span className="font-semibold">$0.10 for a chai</span>. Never blocks your ZIP.
            </span>
          </div>
          <a
            href={CHAI_TIP_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
          >
            Chip in $0.10
          </a>
        </div>
      )}

      {/* Alerts / ZIP download */}
      {apiError && (
        <div role="alert" className="border-b border-rose-200 bg-rose-50 px-6 py-3.5 text-xs space-y-1.5">
          <p className="font-semibold text-rose-900">{apiError.title}</p>
          <p className="text-rose-800">{apiError.suggestion}</p>
          {apiError.needsBotBypass && (
            <button
              type="button"
              onClick={onRequestOpenBotBypass}
              className="font-medium text-rose-900 underline underline-offset-4"
            >
              Open Bot-Check Bypass panel
            </button>
          )}
        </div>
      )}

      {statusMsg && (
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-xs text-zinc-700">
          <span>{statusMsg}</span>
          {zipDownload && (
            <a
              href={zipDownload.url}
              download="clipforge_batch.zip"
              className="font-medium text-rose-600 underline underline-offset-4 whitespace-nowrap"
            >
              Save clipforge_batch.zip ({formatBytes(zipDownload.size)})
            </a>
          )}
        </div>
      )}

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        {loadingMeta ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-10 w-full animate-pulse rounded bg-zinc-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No playlist items loaded yet. Ensure your backend URL is reachable in Backend Config and click Refresh
            Metadata.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
              <tr>
                <th className="w-12 px-6 py-3">Pick</th>
                <th className="px-4 py-3">Video Title</th>
                <th className="w-24 px-4 py-3 text-right">Length</th>
                <th className="w-28 px-4 py-3">Start</th>
                <th className="w-28 px-6 py-3">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.id} className={row.selected ? 'bg-white' : 'bg-zinc-50/50 text-zinc-500'}>
                  <td className="px-6 py-2.5">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => handleToggleRow(row.id)}
                      aria-label={`Select ${row.title}`}
                      className="h-4 w-4 rounded border-zinc-300 accent-rose-600"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-zinc-900 line-clamp-1">{row.title}</div>
                    <div className="font-mono text-xs text-zinc-400">{row.id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-600">
                    {row.durationSec ? formatTimecode(row.durationSec) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={row.start}
                      aria-label={`Start time for ${row.title}`}
                      onChange={(e) => handleRowTime(row.id, 'start', e.target.value)}
                      className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs tabular-nums text-zinc-900"
                    />
                  </td>
                  <td className="px-6 py-2.5">
                    <input
                      type="text"
                      value={row.end}
                      aria-label={`End time for ${row.title}`}
                      onChange={(e) => handleRowTime(row.id, 'end', e.target.value)}
                      className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-xs tabular-nums text-zinc-900"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
