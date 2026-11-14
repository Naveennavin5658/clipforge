export interface Env {
  BACKEND_ORIGIN: string;
  ALLOWED_ORIGIN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  CLIP_RATE_LIMIT?: string;
  META_RATE_LIMIT?: string;
  RATE_WINDOW_SEC?: string;
  PLAYLIST_CACHE_TTL_SEC?: string;
  CLIP_DEDUPE_TTL_SEC?: string;
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== '*' ? env.ALLOWED_ORIGIN : origin || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-YT-Cookies, X-YT-PO-Token',
    'Access-Control-Expose-Headers': 'Content-Disposition, X-Clip-Cache-Key, X-Edge-Cache, X-RateLimit-Remaining, Retry-After',
    'Vary': 'Origin',
  };
}

async function redisPipeline(env: Env, commands: Array<Array<string | number>>): Promise<Array<{ result: unknown }>> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return [];
  }
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`Upstash pipeline error: ${res.status}`);
  }
  return (await res.json()) as Array<{ result: unknown }>;
}

async function checkRateLimit(
  env: Env,
  ip: string,
  bucket: 'clip' | 'playlist-meta',
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const key = `cf:rl:${bucket}:${ip}`;
  const results = await redisPipeline(env, [
    ['INCR', key],
    ['TTL', key],
  ]);

  const count = Number(results[0]?.result ?? 1);
  let ttl = Number(results[1]?.result ?? -1);

  if (count === 1 || ttl < 0) {
    await redisPipeline(env, [['EXPIRE', key, windowSec]]);
    ttl = windowSec;
  }

  const remaining = Math.max(0, limit - count);
  return {
    allowed: count <= limit,
    remaining,
    retryAfter: Math.max(1, ttl),
  };
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractListId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('list');
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const baseCors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseCors });
    }

    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') || 'anonymous';
    const windowSec = Number(env.RATE_WINDOW_SEC || '600');
    const clipLimit = Number(env.CLIP_RATE_LIMIT || '12');
    const metaLimit = Number(env.META_RATE_LIMIT || '30');
    const playlistTtl = Number(env.PLAYLIST_CACHE_TTL_SEC || '900');
    const dedupeTtl = Number(env.CLIP_DEDUPE_TTL_SEC || '120');
    const backendOrigin = env.BACKEND_ORIGIN.replace(/\/+$/, '');

    // 1. Health pass-through
    if (url.pathname === '/health' && request.method === 'GET') {
      const upstream = await fetch(`${backendOrigin}/health`);
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...baseCors, 'Content-Type': 'application/json', 'X-Edge-Gateway': 'clipforge-cf' },
      });
    }

    // 2. Playlist metadata: rate limit + Upstash Redis 15-min cache
    if (url.pathname === '/playlist-meta' && request.method === 'GET') {
      const rl = await checkRateLimit(env, clientIp, 'playlist-meta', metaLimit, windowSec);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({
            code: 'RATE_LIMITED',
            message: 'Too many playlist metadata lookups from this IP.',
            retry_after: rl.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...baseCors,
              'Content-Type': 'application/json',
              'Retry-After': String(rl.retryAfter),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }

      const targetUrl = url.searchParams.get('url') || '';
      const listId = extractListId(targetUrl);
      const hasPrivateAuth = Boolean(request.headers.get('X-YT-Cookies') || request.headers.get('X-YT-PO-Token'));
      const cacheKey = listId ? `cf:pl:v1:${listId}` : null;

      if (cacheKey && !hasPrivateAuth && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        const cachedRes = await redisPipeline(env, [['GET', cacheKey]]);
        const cachedJson = cachedRes[0]?.result;
        if (typeof cachedJson === 'string' && cachedJson.length > 2) {
          return new Response(cachedJson, {
            status: 200,
            headers: {
              ...baseCors,
              'Content-Type': 'application/json',
              'X-Edge-Cache': 'HIT',
              'X-RateLimit-Remaining': String(rl.remaining),
            },
          });
        }
      }

      const upstream = await fetch(`${backendOrigin}/playlist-meta${url.search}`, {
        method: 'GET',
        headers: {
          ...(request.headers.get('X-YT-Cookies') ? { 'X-YT-Cookies': request.headers.get('X-YT-Cookies')! } : {}),
          ...(request.headers.get('X-YT-PO-Token') ? { 'X-YT-PO-Token': request.headers.get('X-YT-PO-Token')! } : {}),
        },
      });
      const bodyText = await upstream.text();

      if (upstream.ok && cacheKey && !hasPrivateAuth && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        await redisPipeline(env, [['SET', cacheKey, bodyText, 'EX', playlistTtl]]);
      }

      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          ...baseCors,
          'Content-Type': 'application/json',
          'X-Edge-Cache': 'MISS',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      });
    }

    // 3. Single clip & batch clip: rate limit + (video_id, start, end) in-flight deduplication guard
    if ((url.pathname === '/clip' || url.pathname === '/batch-clip') && request.method === 'POST') {
      const rl = await checkRateLimit(env, clientIp, 'clip', clipLimit, windowSec);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({
            code: 'RATE_LIMITED',
            message: `Rate limit reached (${clipLimit} remote extractions per ${Math.round(windowSec / 60)} min).`,
            retry_after: rl.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...baseCors,
              'Content-Type': 'application/json',
              'Retry-After': String(rl.retryAfter),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }

      const rawBody = await request.text();
      let dedupeKey: string | null = null;

      if (url.pathname === '/clip' && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const parsed = JSON.parse(rawBody) as { url?: string; start_sec?: number; end_sec?: number };
          const videoId = parsed.url ? extractYoutubeId(parsed.url) : null;
          if (videoId && typeof parsed.start_sec === 'number' && typeof parsed.end_sec === 'number') {
            dedupeKey = `cf:clip:inflight:v1:${videoId}:${Math.floor(parsed.start_sec)}:${Math.floor(parsed.end_sec)}`;
            const lockRes = await redisPipeline(env, [['SET', dedupeKey, '1', 'NX', 'EX', dedupeTtl]]);
            if (lockRes[0]?.result !== 'OK') {
              return new Response(
                JSON.stringify({
                  code: 'SLOTS_BUSY',
                  message: 'This exact timestamp clip is already being extracted. Wait a moment before retrying.',
                }),
                {
                  status: 429,
                  headers: {
                    ...baseCors,
                    'Content-Type': 'application/json',
                    'Retry-After': '10',
                    'X-RateLimit-Remaining': String(rl.remaining),
                  },
                },
              );
            }
          }
        } catch {
          // Ignore malformed JSON; upstream FastAPI handles validation
        }
      }

      try {
        const upstream = await fetch(`${backendOrigin}${url.pathname}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawBody,
        });

        const headers = new Headers(baseCors);
        const passthrough = ['Content-Type', 'Content-Disposition', 'X-Clip-Cache-Key'];
        for (const h of passthrough) {
          const val = upstream.headers.get(h);
          if (val) headers.set(h, val);
        }
        headers.set('X-RateLimit-Remaining', String(rl.remaining));

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      } finally {
        if (dedupeKey && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
          await redisPipeline(env, [['DEL', dedupeKey]]).catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'Unknown gateway route.' }), {
      status: 404,
      headers: { ...baseCors, 'Content-Type': 'application/json' },
    });
  },
};
