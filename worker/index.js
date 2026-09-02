/**
 * Eye of Atlas — production Worker.
 *
 * Serves the static site AND owns /api/*. One deployment, not two.
 *
 * ── Why this file has to exist ───────────────────────────────────────────────
 * Every /api/* endpoint upstream ships is Vite dev-server middleware. It has no
 * production equivalent at all (docs/GEV-INSPECTION.md §1, §5.4). With static
 * hosting alone the routes do not 404 — `not_found_handling` returns index.html
 * with a 200, so a client asking for JSON receives an HTML document and fails
 * with "Unexpected token '<'". That is strictly worse than a 404, because it
 * looks like a success. This Worker matches /api/* BEFORE asset serving, so the
 * SPA fallback can never reach those routes.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * Only /api/geocode is implemented, because only it is load-bearing right now:
 * place search is a P0 MVP feature and it depends on it. Everything else under
 * /api/* returns an honest, machine-readable 501 rather than pretending.
 *
 * ── Nominatim obligations (COMMERCIAL_COMPLIANCE.md §6.4) ────────────────────
 *  - identifying User-Agent      -> GEOCODE_USER_AGENT, shared with dev
 *  - "results must be cached"    -> Cache API, 24 h
 *  - max 1 request/second        -> see the honest caveat on RATE LIMITING below
 */

import {
  GEOCODE_USER_AGENT,
  buildNominatimUrl,
  nominatimToGoogleGeocode,
} from '../src/server/geocode.js';

/** Nominatim asks that results be cached; this is that cache. */
const GEOCODE_CACHE_SECONDS = 24 * 60 * 60;

/** Upstream timeout. A hung geocode must not hold a Worker invocation open. */
const UPSTREAM_TIMEOUT_MS = 8000;

function json(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * GET /api/geocode?q=<place>&bias=<swLat,swLng|neLat,neLng>
 * Returns the Google Geocoding SHAPE, so src/locations.js is unchanged.
 */
async function handleGeocode(request, ctx) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 200);
  if (!query) {
    return json({ status: 'INVALID_REQUEST', results: [] }, { status: 400 });
  }
  const bias = url.searchParams.get('bias');

  // Cache key is OURS, not the upstream URL: normalising the query here means
  // "Manila" and "manila" share one cached answer and one upstream request.
  const cacheKey = new Request(
    `https://geocode.internal/?q=${encodeURIComponent(query.toLowerCase())}&bias=${encodeURIComponent(bias || '')}`,
    { method: 'GET' },
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set('X-Geocode-Cache', 'HIT');
    return hit;
  }

  let upstream;
  try {
    upstream = await fetch(buildNominatimUrl(query, bias), {
      headers: { 'User-Agent': GEOCODE_USER_AGENT, Referer: GEOCODE_USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Sanitised: never surface upstream internals to the client.
    return json({ status: 'UNKNOWN_ERROR', results: [] }, { status: 502 });
  }
  if (!upstream.ok) {
    return json({ status: 'UNKNOWN_ERROR', results: [] }, { status: 502 });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return json({ status: 'UNKNOWN_ERROR', results: [] }, { status: 502 });
  }

  const body = JSON.stringify(nominatimToGoogleGeocode(payload));
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${GEOCODE_CACHE_SECONDS}`,
      'X-Geocode-Cache': 'MISS',
    },
  });
  // waitUntil so storing the cache entry never delays the response.
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  /**
   * @param {Request} request
   * @param {{ASSETS: {fetch: (req: Request) => Promise<Response>}}} env
   * @param {{waitUntil: (p: Promise<unknown>) => void}} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET') {
        return json({ error: 'method_not_allowed' }, { status: 405 });
      }
      if (url.pathname === '/api/geocode') {
        try {
          return await handleGeocode(request, ctx);
        } catch {
          return json({ status: 'UNKNOWN_ERROR', results: [] }, { status: 500 });
        }
      }
      // Honest 501 for the endpoints that still exist only as dev middleware
      // (firms, celestrak, flights, cctv, radio, ...). A JSON body with the
      // right content type is what lets a client tell "not built yet" from
      // "broken" — and it is never the HTML the SPA fallback would serve.
      return json({
        error: 'not_implemented',
        message: `${url.pathname} is not available in this deployment yet.`,
      }, { status: 501 });
    }

    // Everything else is the static site.
    return env.ASSETS.fetch(request);
  },
};

/*
 * ── RATE LIMITING: a known gap, stated plainly ───────────────────────────────
 *
 * Nominatim's policy caps use at 1 request per second. The dev server honours
 * that with a single in-process queue. A Worker cannot: each isolate is
 * independent, so a per-isolate counter would let N isolates make N requests
 * per second simultaneously.
 *
 * What protects us today is the 24 h cache above — repeat searches never reach
 * Nominatim — plus the fact that this deployment is pre-launch and carries
 * robots.txt Disallow: /. That is adequate for now and NOT adequate for real
 * traffic.
 *
 * Before launch this needs a shared counter: bind the COUNTERS KV namespace and
 * reuse workers/api-proxy/src/middleware/ratelimit.js, or move to a Durable
 * Object for exactness. The alternative the OSMF policy itself points at is
 * self-hosting Nominatim, which the compliance audit flags as the real answer
 * at scale (COMMERCIAL_COMPLIANCE.md §6.4).
 */
