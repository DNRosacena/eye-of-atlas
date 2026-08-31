/**
 * Per-IP rate limiting — fixed window, counted in the store.
 *
 * ⚠️ THE IMPORTANT LINE IN THIS FILE is the client-key derivation.
 *
 * God's Eye View derives its rate-limit key from `req.socket.remoteAddress`
 * and DELIBERATELY ignores X-Forwarded-For (vite.config.js:488) — correct for
 * a localhost dev server, where a client-controlled forwarding header would
 * let an attacker mint fresh quota by rotating the value.
 *
 * Behind Cloudflare that logic inverts. The socket peer is the Cloudflare
 * edge, so every request on earth would collapse into a single bucket and the
 * limiter would throttle all users at once while stopping no one. The correct
 * source here is `CF-Connecting-IP`, which Cloudflare sets and which cannot be
 * spoofed by the client because Cloudflare overwrites any inbound value.
 *
 * (See docs/GEV-INSPECTION.md §6.4 for the full portability list.)
 */

const WINDOW_SECONDS = 60;

/**
 * Client identity for rate limiting.
 * Falls back to a shared bucket when the header is absent (local `wrangler
 * dev`), which is fine: local traffic is one developer.
 */
export function clientKey(request) {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('CF-Pseudo-IPv4')
    ?? 'local';
}

/** Read a positive integer limit from env, or fall back. */
export function limitFor(env, route, fallback) {
  const raw = env?.[`RATELIMIT_${route.toUpperCase()}_PER_MIN`];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Check and consume one unit of the caller's per-minute allowance.
 *
 * @param {object} args
 * @param {Request} args.request
 * @param {object} args.env
 * @param {ReturnType<import('../lib/store.js').createStore>} args.store
 * @param {string} args.route route id, e.g. "ping"
 * @param {number} args.fallbackLimit used when env has no override
 * @param {number} [args.now]
 * @returns {Promise<{allowed: boolean, limit: number, used: number, remaining: number, resetSeconds: number}>}
 */
export async function checkRateLimit({ request, env, store, route, fallbackLimit, now = Date.now() }) {
  const limit = limitFor(env, route, fallbackLimit);
  const windowStart = Math.floor(now / (WINDOW_SECONDS * 1000));
  const key = `rl:${route}:${clientKey(request)}:${windowStart}`;

  const used = await store.increment(key, WINDOW_SECONDS);
  const resetSeconds = WINDOW_SECONDS - Math.floor((now % (WINDOW_SECONDS * 1000)) / 1000);

  return {
    allowed: used <= limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetSeconds,
  };
}

/** Standard rate-limit headers, emitted on every response for observability. */
export function rateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetSeconds),
  };
}
