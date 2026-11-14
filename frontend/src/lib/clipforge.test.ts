import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInputSource,
  parseTimecode,
  formatTimecode,
  validateClipRange,
  toggleBatchRowSelection,
  applyBulkRangeToSelected,
  shouldShowChaiPrompt,
  classifyApiError,
  sanitizeBotBypass,
  isLocalFileWasmRisk,
  MAX_SINGLE_CLIP_SEC,
  MAX_BATCH_CLIP_SEC,
  MAX_BATCH_ITEMS,
  type PlaylistClipRow,
} from './clipforge.ts';
import {
  buildRateLimitKey,
  buildPlaylistCacheKey,
  buildClipDedupeKey,
  computeSlidingWindowRemaining,
} from './edgeGatewayHelpers.ts';

test('detectInputSource identifies single YouTube URLs across formats', () => {
  const standard = detectInputSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(standard.mode, 'youtube-single');
  assert.equal(standard.videoId, 'dQw4w9WgXcQ');

  const short = detectInputSource('https://youtu.be/dQw4w9WgXcQ?t=42');
  assert.equal(short.mode, 'youtube-single');
  assert.equal(short.videoId, 'dQw4w9WgXcQ');

  const shorts = detectInputSource('youtube.com/shorts/abcdefghijk');
  assert.equal(shorts.mode, 'youtube-single');
  assert.equal(shorts.videoId, 'abcdefghijk');
});

test('detectInputSource identifies playlist URLs and rejects unsupported domains', () => {
  const pl = detectInputSource('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  assert.equal(pl.mode, 'youtube-playlist');
  assert.equal(pl.listId, 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');

  const watchInPlaylist = detectInputSource(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  );
  assert.equal(watchInPlaylist.mode, 'youtube-playlist');

  const vimeo = detectInputSource('https://vimeo.com/123456');
  assert.equal(vimeo.mode, 'invalid');
});

test('parseTimecode and formatTimecode round-trip cleanly', () => {
  assert.equal(parseTimecode('00:00'), 0);
  assert.equal(parseTimecode('01:30'), 90);
  assert.equal(parseTimecode('1:05:10'), 3910);
  assert.equal(parseTimecode('01:75'), null);
  assert.equal(formatTimecode(90), '01:30');
  assert.equal(formatTimecode(3910), '01:05:10');
});

test('validateClipRange enforces single (180s) and batch (60s) caps', () => {
  const okSingle = validateClipRange('00:10', '03:10', MAX_SINGLE_CLIP_SEC);
  assert.equal(okSingle.valid, true);
  assert.equal(okSingle.durationSec, 180);

  const tooLongSingle = validateClipRange('00:00', '03:01', MAX_SINGLE_CLIP_SEC);
  assert.equal(tooLongSingle.valid, false);

  const tooLongBatch = validateClipRange('00:00', '01:05', MAX_BATCH_CLIP_SEC);
  assert.equal(tooLongBatch.valid, false);

  const reversed = validateClipRange('00:45', '00:20', MAX_SINGLE_CLIP_SEC);
  assert.equal(reversed.valid, false);
});

test('playlist batch enforces 15-clip cap and chai prompt threshold (>5)', () => {
  const makeRows = (count: number, selectedCount: number): PlaylistClipRow[] =>
    Array.from({ length: count }, (_, idx) => ({
      id: `vid_${idx}`,
      title: `Video ${idx}`,
      url: `https://youtube.com/watch?v=vid_${idx}`,
      durationSec: 120,
      selected: idx < selectedCount,
      start: '00:00',
      end: '00:30',
    }));

  const fullRows = makeRows(18, MAX_BATCH_ITEMS);
  const blocked = toggleBatchRowSelection(fullRows, 'vid_16');
  assert.equal(blocked.capReached, true);
  assert.equal(blocked.rows.filter((r) => r.selected).length, 15);

  const deselected = toggleBatchRowSelection(fullRows, 'vid_0');
  assert.equal(deselected.capReached, false);
  assert.equal(deselected.rows.filter((r) => r.selected).length, 14);

  assert.equal(shouldShowChaiPrompt(5), false);
  assert.equal(shouldShowChaiPrompt(6), true);

  const bulkUpdated = applyBulkRangeToSelected(makeRows(3, 2), '00:10', '00:40');
  assert.equal(bulkUpdated[0].start, '00:10');
  assert.equal(bulkUpdated[1].end, '00:40');
  assert.equal(bulkUpdated[2].start, '00:00');
});

test('classifyApiError detects YouTube 403 bot-check and 429 rate-limit cleanly', () => {
  const botErr = classifyApiError(
    403,
    JSON.stringify({ code: 'YT_BOT_CHECK', message: 'Sign in to confirm you are not a bot' }),
  );
  assert.equal(botErr.code, 'YT_BOT_CHECK');
  assert.equal(botErr.needsBotBypass, true);

  const rateErr = classifyApiError(429, JSON.stringify({ code: 'RATE_LIMITED', message: 'Too many requests' }), '45');
  assert.equal(rateErr.code, 'RATE_LIMITED');
  assert.equal(rateErr.retryAfterSec, 45);
});

test('sanitizeBotBypass validates Netscape cookies format and local WASM risk threshold', () => {
  const valid = sanitizeBotBypass({
    cookiesTxt: '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1799999999\tVISITOR_INFO1_LIVE\tabc',
    poToken: 'web_po_123',
  });
  assert.equal(valid.cookiesLooksValid, true);
  assert.equal(valid.hasPoToken, true);

  const malformed = sanitizeBotBypass({ cookiesTxt: 'just some random text', poToken: '' });
  assert.equal(malformed.cookiesLooksValid, false);

  assert.equal(isLocalFileWasmRisk(1.9 * 1024 * 1024 * 1024), true);
  assert.equal(isLocalFileWasmRisk(200 * 1024 * 1024), false);
});

test('edge gateway Redis key builders are deterministic', () => {
  assert.equal(buildRateLimitKey('203.0.113.5', 'clip'), 'cf:rl:clip:203.0.113.5');
  assert.equal(buildPlaylistCacheKey('PL123'), 'cf:pl:v1:PL123');
  assert.equal(buildClipDedupeKey('dQw4w9WgXcQ', 10, 40), 'cf:clip:v1:dQw4w9WgXcQ:10:40');
  assert.equal(computeSlidingWindowRemaining(9, 12), 3);
  assert.equal(computeSlidingWindowRemaining(15, 12), 0);
});
