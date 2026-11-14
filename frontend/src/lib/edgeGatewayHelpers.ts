export function buildRateLimitKey(ip: string, routeBucket: 'clip' | 'playlist-meta'): string {
  const safeIp = ip.trim() || 'unknown';
  return `cf:rl:${routeBucket}:${safeIp}`;
}

export function buildPlaylistCacheKey(listId: string): string {
  return `cf:pl:v1:${listId.trim()}`;
}

export function buildClipDedupeKey(videoId: string, startSec: number, endSec: number): string {
  return `cf:clip:v1:${videoId.trim()}:${Math.floor(startSec)}:${Math.floor(endSec)}`;
}

export function computeSlidingWindowRemaining(usedCount: number, limit: number): number {
  return Math.max(0, limit - Math.max(0, usedCount));
}
