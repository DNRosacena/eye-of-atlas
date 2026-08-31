/**
 * Eye of Atlas — API proxy Worker.
 *
 * A deliberately small request-scoped Worker. It exists for two reasons, and
 * it is worth being precise about which is which:
 *
 *   1. SECRET BROKERING — keys that must not reach the browser
 *      (FIRMS_MAP_KEY, GOOGLE_GEOCODING_API_KEY, later GEMINI_API_KEY).
 *
 *   2. PROVIDER COMPLIANCE — cache windows and rate ceilings that providers
 *      require and a browser cannot be trusted to honour. CelesTrak is the
 *      clearest case: it IP-blocks on repeated non-200s, so without a shared
 *      6 h cache we would get the Cloudflare edge IP blocked and break a P0
 *      layer for everyone.
 *
 * What this Worker deliberately does NOT do:
 *
 *   - Proxy Google Photorealistic 3D Tiles. Renderer-originating tile requests
 *     are not billable (only root tileset queries are), so proxying would push
 *     the unbillable bulk through our 100k/day free tier for no benefit, and
 *     passing tile bytes through our origin is untested against Google's
 *     no-cache/no-rehost language. Spend is capped at Google's own quota
 *     layer instead. See docs/STAGE0-CHANGE-PLAN.md §3.1.
 *
 *   - Hold persistent connections. Ships/AISStream are out of Stage 1, which
 *     is what keeps this stateless and free of Durable Objects.
 *
 *   - Proxy USGS earthquakes. Public domain, keyless, no rate limit — the
 *     browser calls it directly and should keep doing so.
 */

import { json, error } from './lib/json.js';
import { createStore, assertProductionReady } from './lib/store.js';
import { resolveOrigin } from './middleware/origin.js';
import { checkRateLimit, rateLimitHeaders } from './middleware/ratelimit.js';
import { consumeBudget, budgetHeaders, peekBudget } from './middleware/budget.js';
import {
  handlePing,
  ROUTE_ID as PING_ROUTE,
  FALLBACK_RATE_LIMIT as PING_RATE,
  FALLBACK_BUDGET as PING_BUDGET,
} from './routes/ping.js';

/**
 * Route table.
 *
 * Every entry passes through the same pipeline. Routes cannot opt out of the
 * budget governor — that is enforced here, in the router, rather than left to
 * each handler to remember. A route that could bypass the cap is exactly the
 * bug this design exists to prevent.
 */
const ROUTES = {
  '/api/ping': {
    id: PING_ROUTE,
    rateLimit: PING_RATE,
    budget: PING_BUDGET,
    handler: handlePing,
  },
  // Stage 1 adds: /api/firms, /api/celestrak, /api/flights, /api/geocode
  // Stage 3 adds: /api/gemini
};

export default {
  /**
   * @param {Request} request
   * @param {object} env
   * @param {object} ctx
   */
  async fetch(request, env, ctx) {
    try {
      assertProductionReady(env);

      const url = new URL(request.url);
      const { ok: originOk, origin } = resolveOrigin(request, env);

      // Preflight, answered before any counting so an OPTIONS storm cannot
      // burn a caller's rate-limit allowance.
      if (request.method === 'OPTIONS') {
        if (!originOk) return error('origin_not_allowed', 'Origin not allowed.', { status: 403 });
        return new Response(null, { status: 204, headers: json({}, { origin }).headers });
      }

      if (!originOk) {
        return error('origin_not_allowed', 'Origin not allowed.', { status: 403 });
      }

      if (request.method !== 'GET') {
        return error('method_not_allowed', 'Only GET is supported.', { status: 405, origin });
      }

      const store = createStore(env);

      // Unauthenticated liveness + budget visibility. No upstream, no secrets.
      if (url.pathname === '/api/health') {
        return handleHealth({ env, store, origin });
      }

      const route = ROUTES[url.pathname];
      if (!route) {
        // JSON, never HTML — see lib/json.js for why this matters.
        return error('not_found', `No route for ${url.pathname}.`, { status: 404, origin });
      }

      // ── Pipeline ───────────────────────────────────────────────────────
      // 1. rate limit (per IP, per minute)
      const rateLimit = await checkRateLimit({
        request, env, store, route: route.id, fallbackLimit: route.rateLimit,
      });
      const headers = { ...rateLimitHeaders(rateLimit) };

      if (!rateLimit.allowed) {
        return error('rate_limited', 'Too many requests. Slow down.', {
          status: 429,
          origin,
          headers: { ...headers, 'Retry-After': String(rateLimit.resetSeconds) },
        });
      }

      // 2. daily budget (per source, per UTC day)
      //
      // NOTE for Stage 1: real routes must attempt the CACHE BEFORE spending
      // budget, and must fall back to cached/stale data when the cap is hit
      // rather than returning layer-paused immediately. The ping route has no
      // upstream and no cache, so it spends directly.
      const budget = await consumeBudget({
        env, store, source: route.id, fallbackBudget: route.budget,
      });
      Object.assign(headers, budgetHeaders(budget));

      if (!budget.allowed) {
        const { layerPaused } = await import('./lib/json.js');
        return layerPaused(route.id, { origin, headers });
      }

      // 3. handler
      return await route.handler({ request, env, ctx, origin, rateLimit, budget, headers, store });
    } catch (err) {
      // Sanitised: never echo stack traces, upstream bodies, or key material.
      console.error('[api-proxy]', err?.message ?? err);
      return error('internal_error', 'The proxy failed to handle this request.', { status: 500 });
    }
  },
};

/** Liveness + current budget consumption. Safe to expose: no secrets, no spend. */
async function handleHealth({ env, store, origin }) {
  const sources = await Promise.all(
    Object.values(ROUTES).map(async (route) => [
      route.id,
      await peekBudget({ env, store, source: route.id, fallbackBudget: route.budget }),
    ]),
  );

  return json(
    {
      ok: true,
      service: 'eye-of-atlas-api-proxy',
      environment: env?.ENVIRONMENT ?? 'development',
      counterBackend: store.backend,
      // Surfaced because a memory backend in production means the caps are
      // per-isolate and effectively absent. Loud is better than subtle.
      counterBackendWarning: store.backend === 'memory'
        ? 'In-memory counters: limits are per-isolate and reset on eviction. Bind the COUNTERS KV namespace before production.'
        : null,
      budgets: Object.fromEntries(sources),
      timestamp: new Date().toISOString(),
    },
    { origin },
  );
}
