/**
 * Provider cache-window enforcement.
 *
 * Caching here is a COMPLIANCE mechanism first and a performance one second.
 * Several providers require it, and at least one forbids it:
 *
 *   CelesTrak  6 h   Policy says download once per update cycle (GP updates
 *                    every 2 h) and stop querying on any non-200 or be
 *                    IP-blocked. Our client refreshes satellites every 5 min.
 *                    Without this cache we would forward that cadence and get
 *                    the shared Cloudflare edge IP blocked — breaking a P0
 *                    layer for every user, not just ours.
 *   FIRMS      30 m  Within the 5,000 tx / 10 min limit. 24 h hard staleness
 *                    ceiling so we never serve day-old fire detections.
 *   adsb.lol   12 s  No published limit; this is courtesy self-governance.
 *   geocode    24 h  Google permits caching geocoding results (unlike tiles).
 *
 *   Google Map Tiles — NEVER. "you must not pre-fetch, index, store, or cache
 *   any Content", and responses carry Cache-Control: private. This is
 *   structurally impossible here because we do not proxy tiles at all
 *   (docs/STAGE0-CHANGE-PLAN.md §3.1) — but the entry below is deliberate, so
 *   that anyone who later adds a tile route trips over it.
 */

/**
 * Cache windows in seconds, keyed by source id.
 * `null` means caching is FORBIDDEN for that source, not merely disabled.
 * @type {Record<string, number|null>}
 */
export const CACHE_WINDOWS = Object.freeze({
  celestrak: 6 * 60 * 60,
  firms: 30 * 60,
  flights: 12,
  geocode: 24 * 60 * 60,
  ping: 10,

  // Forbidden by Google Maps Platform ToS. Do not change this to a number.
  'google-tiles': null,
});

/** Hard staleness ceilings — never serve data older than this, cache or not. */
export const STALENESS_CEILINGS = Object.freeze({
  firms: 24 * 60 * 60,
  celestrak: 48 * 60 * 60,
});

export class CachingForbiddenError extends Error {
  constructor(source) {
    super(`Caching is forbidden by provider terms for source "${source}".`);
    this.name = 'CachingForbiddenError';
  }
}

/**
 * Resolve the cache window for a source.
 * @throws {CachingForbiddenError} when the provider forbids caching
 */
export function cacheWindowFor(source) {
  const window = CACHE_WINDOWS[source];
  if (window === null) throw new CachingForbiddenError(source);
  return window ?? 0;
}

/**
 * Read-through cache around an upstream fetch.
 *
 * `fetchUpstream` is only invoked on a miss, and only after the caller's
 * budget check passes — that ordering matters, because a cache hit must not
 * spend daily budget.
 *
 * @param {object} args
 * @param {string} args.source
 * @param {string} args.cacheKey a stable absolute URL used as the cache key
 * @param {() => Promise<Response>} args.fetchUpstream
 * @param {Cache} [args.cache] injectable for tests
 * @returns {Promise<{response: Response, status: 'HIT'|'MISS'|'BYPASS'}>}
 */
export async function withCache({ source, cacheKey, fetchUpstream, cache }) {
  const ttl = cacheWindowFor(source);
  const store = cache ?? (typeof caches !== 'undefined' ? caches.default : null);

  if (!store || ttl <= 0) {
    return { response: await fetchUpstream(), status: 'BYPASS' };
  }

  const keyRequest = new Request(cacheKey, { method: 'GET' });
  const hit = await store.match(keyRequest);
  if (hit) return { response: hit, status: 'HIT' };

  const fresh = await fetchUpstream();

  // Only cache successes. Caching an error would pin a broken layer for the
  // whole window, and for CelesTrak specifically a non-200 means "back off",
  // not "remember this".
  if (fresh.ok) {
    const cacheable = new Response(fresh.clone().body, fresh);
    cacheable.headers.set('Cache-Control', `public, max-age=${ttl}`);
    await store.put(keyRequest, cacheable);
  }

  return { response: fresh, status: 'MISS' };
}
