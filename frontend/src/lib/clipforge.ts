export type InputMode = 'empty' | 'local' | 'youtube-single' | 'youtube-playlist' | 'invalid';

export interface DetectedSource {
  mode: InputMode;
  videoId: string | null;
  listId: string | null;
  canonicalUrl: string | null;
  error?: string;
}

export interface RangeValidation {
  valid: boolean;
  startSec: number;
  endSec: number;
  durationSec: number;
  error?: string;
}

export interface PlaylistClipRow {
  id: string;
  title: string;
  url: string;
  durationSec: number | null;
  selected: boolean;
  start: string;
  end: string;
}

export interface ClassifiedApiError {
  code: 'YT_BOT_CHECK' | 'RATE_LIMITED' | 'SLOTS_BUSY' | 'INVALID_INPUT' | 'NETWORK' | 'SERVER_ERROR';
  title: string;
  detail: string;
  suggestion: string;
  needsBotBypass: boolean;
  retryAfterSec?: number;
}

export interface BotBypassCredentials {
  cookiesTxt: string;
  poToken: string;
}

export const MAX_SINGLE_CLIP_SEC = 180;
export const MAX_BATCH_CLIP_SEC = 60;
export const MAX_BATCH_ITEMS = 15;
export const CHAI_PROMPT_THRESHOLD = 5;
export const LOCAL_WASM_WARN_BYTES = 1.8 * 1024 * 1024 * 1024; // 1.8 GB

const YT_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const LIST_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;

/**
 * Auto-detects whether a pasted URL is a single YouTube video, a YouTube playlist, or invalid.
 */
export function detectInputSource(rawInput: string): DetectedSource {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { mode: 'empty', videoId: null, listId: null, canonicalUrl: null };
  }

  let parsed: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return {
      mode: 'invalid',
      videoId: null,
      listId: null,
      canonicalUrl: null,
      error: 'Enter a valid YouTube URL or drop a local video file.',
    };
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const isYoutubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be';

  if (!isYoutubeHost) {
    return {
      mode: 'invalid',
      videoId: null,
      listId: null,
      canonicalUrl: null,
      error: 'Only YouTube URLs and local video files are supported.',
    };
  }

  const listParam = parsed.searchParams.get('list');
  const vParam = parsed.searchParams.get('v');

  let videoId: string | null = null;
  if (host === 'youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    if (seg && YT_ID_REGEX.test(seg)) videoId = seg;
  } else if (vParam && YT_ID_REGEX.test(vParam)) {
    videoId = vParam;
  } else {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1] && YT_ID_REGEX.test(parts[1])) {
      videoId = parts[1];
    }
  }

  const validListId = listParam && LIST_ID_REGEX.test(listParam) ? listParam : null;

  // Treat explicit playlist pages or watch URLs with list= as playlist mode
  if (validListId && (parsed.pathname === '/playlist' || !videoId || parsed.searchParams.has('list'))) {
    return {
      mode: 'youtube-playlist',
      videoId,
      listId: validListId,
      canonicalUrl: `https://www.youtube.com/playlist?list=${validListId}`,
    };
  }

  if (videoId) {
    return {
      mode: 'youtube-single',
      videoId,
      listId: null,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  return {
    mode: 'invalid',
    videoId: null,
    listId: null,
    canonicalUrl: null,
    error: 'Could not find a YouTube video ID or playlist ID in that URL.',
  };
}

/**
 * Parses MM:SS or HH:MM:SS into integer seconds. Returns null if invalid.
 */
export function parseTimecode(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  if (/^\d+$/.test(cleaned)) {
    const num = Number(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  const parts = cleaned.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d{1,3}$/.test(p))) return null;

  const nums = parts.map(Number);
  if (parts.length === 2) {
    const [mm, ss] = nums;
    if (ss >= 60) return null;
    return mm * 60 + ss;
  }

  const [hh, mm, ss] = nums;
  if (mm >= 60 || ss >= 60) return null;
  return hh * 3600 + mm * 60 + ss;
}

/**
 * Formats seconds as MM:SS (or HH:MM:SS if >= 1 hour).
 */
export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

/**
 * Validates start/end timecodes against max clip cap (null maxDurationSec = unlimited for local files).
 */
export function validateClipRange(
  startRaw: string,
  endRaw: string,
  maxDurationSec: number | null,
): RangeValidation {
  const startSec = parseTimecode(startRaw);
  const endSec = parseTimecode(endRaw);

  if (startSec === null) {
    return { valid: false, startSec: 0, endSec: 0, durationSec: 0, error: 'Invalid start time (use MM:SS).' };
  }
  if (endSec === null) {
    return { valid: false, startSec, endSec: 0, durationSec: 0, error: 'Invalid end time (use MM:SS).' };
  }
  if (endSec <= startSec) {
    return { valid: false, startSec, endSec, durationSec: 0, error: 'End time must be after start time.' };
  }

  const durationSec = endSec - startSec;
  if (maxDurationSec !== null && durationSec > maxDurationSec) {
    return {
      valid: false,
      startSec,
      endSec,
      durationSec,
      error: `Clip length (${durationSec}s) exceeds the ${maxDurationSec}s free-tier cap.`,
    };
  }

  return { valid: true, startSec, endSec, durationSec };
}

/**
 * Enforces the 15-clip selection cap in Playlist Batch Mode.
 */
export function toggleBatchRowSelection(
  rows: PlaylistClipRow[],
  targetId: string,
  maxSelected = MAX_BATCH_ITEMS,
): { rows: PlaylistClipRow[]; capReached: boolean } {
  const target = rows.find((r) => r.id === targetId);
  if (!target) return { rows, capReached: false };

  if (target.selected) {
    return {
      rows: rows.map((r) => (r.id === targetId ? { ...r, selected: false } : r)),
      capReached: false,
    };
  }

  const currentSelected = rows.filter((r) => r.selected).length;
  if (currentSelected >= maxSelected) {
    return { rows, capReached: true };
  }

  return {
    rows: rows.map((r) => (r.id === targetId ? { ...r, selected: true } : r)),
    capReached: false,
  };
}

export function applyBulkRangeToSelected(
  rows: PlaylistClipRow[],
  start: string,
  end: string,
): PlaylistClipRow[] {
  return rows.map((row) => (row.selected ? { ...row, start, end } : row));
}

export function shouldShowChaiPrompt(selectedCount: number, threshold = CHAI_PROMPT_THRESHOLD): boolean {
  return selectedCount > threshold;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx >= 2 ? 2 : 0)} ${units[idx]}`;
}

export function isLocalFileWasmRisk(sizeBytes: number): boolean {
  return sizeBytes >= LOCAL_WASM_WARN_BYTES;
}

/**
 * Validates optional cookies.txt / PO token fields before dispatching to the backend.
 */
export function sanitizeBotBypass(creds: BotBypassCredentials): {
  hasCookies: boolean;
  hasPoToken: boolean;
  cookiesLooksValid: boolean;
  cookiesTxt: string;
  poToken: string;
} {
  const cookiesTxt = creds.cookiesTxt.trim();
  const poToken = creds.poToken.trim();
  const hasCookies = cookiesTxt.length > 0;
  const hasPoToken = poToken.length > 0;

  // Netscape cookie files contain tab-separated lines or "# Netscape HTTP Cookie File"
  const cookiesLooksValid =
    !hasCookies ||
    cookiesTxt.includes('Netscape') ||
    cookiesTxt.split('\n').some((line) => line.trim() && !line.trim().startsWith('#') && line.includes('\t'));

  return { hasCookies, hasPoToken, cookiesLooksValid, cookiesTxt, poToken };
}

/**
 * Classifies backend / Edge Gateway HTTP errors into actionable UI guidance.
 */
export function classifyApiError(
  status: number,
  rawBody: string,
  retryAfterHeader?: string | null,
): ClassifiedApiError {
  let parsed: { code?: string; message?: string; detail?: string; hint?: string; retry_after?: number } | null = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  const msg = parsed?.message || parsed?.detail || rawBody || `Request failed with status ${status}`;
  const lower = msg.toLowerCase();

  const isBotCheck =
    status === 403 ||
    parsed?.code === 'YT_BOT_CHECK' ||
    lower.includes('403') ||
    lower.includes('bot') ||
    lower.includes('sign in to confirm') ||
    lower.includes('po token') ||
    lower.includes('cookies');

  if (isBotCheck) {
    return {
      code: 'YT_BOT_CHECK',
      title: 'YouTube blocked the datacenter IP (403 / Bot Check)',
      detail: msg,
      suggestion:
        parsed?.hint ||
        'Expand "Bot-Check Bypass" below and paste a Netscape cookies.txt or PO Token from your browser session, then retry.',
      needsBotBypass: true,
    };
  }

  if (status === 429 || parsed?.code === 'RATE_LIMITED') {
    const headerSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const retryAfterSec = Number.isFinite(headerSec) ? headerSec : parsed?.retry_after || 60;
    return {
      code: 'RATE_LIMITED',
      title: 'Edge rate limit reached',
      detail: msg,
      suggestion: `Free-tier fair-use limit hit. Wait ${retryAfterSec}s before starting another remote extraction, or use Local File mode with zero limits.`,
      needsBotBypass: false,
      retryAfterSec,
    };
  }

  if (status === 503 || parsed?.code === 'SLOTS_BUSY') {
    return {
      code: 'SLOTS_BUSY',
      title: 'All 3 worker slots are currently busy',
      detail: msg,
      suggestion: 'The free-tier backend caps concurrent jobs at 3 to stay online. Retry in 10–20 seconds.',
      needsBotBypass: false,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      code: 'INVALID_INPUT',
      title: 'Invalid clip request',
      detail: msg,
      suggestion: parsed?.hint || 'Check that the video is public and your start/end timestamps stay within the free-tier cap.',
      needsBotBypass: false,
    };
  }

  if (status === 0) {
    return {
      code: 'NETWORK',
      title: 'Backend gateway unreachable',
      detail: msg,
      suggestion: 'Open Backend Config in the top right to point ClipForge at your running Docker backend or Cloudflare Worker URL.',
      needsBotBypass: false,
    };
  }

  return {
    code: 'SERVER_ERROR',
    title: 'Extraction failed',
    detail: msg,
    suggestion: parsed?.hint || 'Try a shorter timestamp range or retry in a moment.',
    needsBotBypass: false,
  };
}
