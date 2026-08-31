/**
 * JSON response helpers.
 *
 * Every response the Worker emits goes through here so that CORS headers and
 * the "never HTML" guarantee are applied in exactly one place.
 *
 * The "never HTML" part is deliberate. God's Eye View's dev/preview server
 * falls back to serving index.html for unmatched /api/* routes, so a client
 * asking for JSON silently receives an HTML document with a 200 status
 * (see docs/GEV-INSPECTION.md §5.4). That failure mode is invisible until a
 * layer mysteriously renders nothing. This Worker returns JSON for everything,
 * including 404s and unhandled errors.
 */

/**
 * @param {unknown} body
 * @param {{status?: number, headers?: Record<string,string>, origin?: string|null}} [options]
 */
export function json(body, options = {}) {
  const { status = 200, headers = {}, origin = null } = options;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
      ...headers,
    },
  });
}

/**
 * CORS headers for an already-validated origin.
 * Never emits `*` — the allowlist is checked upstream in middleware/origin.js.
 * @param {string|null} origin
 */
export function corsHeaders(origin) {
  if (!origin) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Error response with a stable shape the client can branch on.
 * Messages are sanitised: never echo upstream bodies, keys, or stack traces.
 *
 * @param {string} code machine-readable, e.g. "rate_limited"
 * @param {string} message human-readable, safe to display
 */
export function error(code, message, options = {}) {
  return json({ error: code, message }, { status: options.status ?? 400, ...options });
}

/**
 * The "layer paused" response, returned when a daily budget cap is exhausted
 * and no cached data is available.
 *
 * Master plan §7.6 requires graceful degradation: the globe must stay usable
 * with any single layer unavailable. This is the contract that makes that
 * possible — a distinct, expected state rather than an error the UI has to
 * guess at.
 */
export function layerPaused(source, options = {}) {
  const { headers: callerHeaders = {}, ...rest } = options;
  return json(
    {
      status: 'layer-paused',
      source,
      message: `The ${source} layer is paused until the next UTC day (daily budget reached).`,
    },
    {
      status: 503,
      ...rest,
      // Merged, not spread-over: a caller passing observability headers must
      // not silently drop Retry-After, which is the client's cue for when to
      // try the layer again.
      headers: { ...callerHeaders, 'Retry-After': String(secondsUntilUtcMidnight()) },
    },
  );
}

/** Seconds remaining until the next UTC midnight, when daily budgets reset. */
export function secondsUntilUtcMidnight(now = Date.now()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}

/** Current UTC day as YYYY-MM-DD — the daily budget bucket key. */
export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
