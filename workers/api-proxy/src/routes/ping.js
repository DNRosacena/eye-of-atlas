/**
 * /api/ping — the dummy brokered endpoint.
 *
 * Stage 0 deliverable: prove the full middleware pipeline end-to-end before
 * any real data source depends on it. It exercises origin checking, per-IP
 * rate limiting, the daily budget cap, and cache-window resolution — but
 * deliberately makes NO upstream request, so the skeleton is deployable and
 * testable with no provider account, no keys, and no network.
 *
 * It reports whether a brokered secret is *present*, never its value. That
 * pattern — the Worker sees the secret, the browser never does — is the whole
 * point of the proxy, and this endpoint is where it is demonstrated.
 *
 * Delete this route once a real brokered endpoint (firms, geocode) ships. It
 * exists to prove a pattern, not to be part of the product.
 */

import { json } from '../lib/json.js';

export const ROUTE_ID = 'ping';
export const FALLBACK_RATE_LIMIT = 10;
export const FALLBACK_BUDGET = 1000;

/**
 * @param {object} ctx assembled by the router
 * @param {object} ctx.env
 * @param {string|null} ctx.origin
 * @param {object} ctx.rateLimit result from checkRateLimit
 * @param {object} ctx.budget result from consumeBudget
 * @param {Record<string,string>} ctx.headers accumulated observability headers
 * @param {ReturnType<import('../lib/store.js').createStore>} ctx.store
 */
export async function handlePing({ env, origin, rateLimit, budget, headers, store }) {
  // Demonstrates secret brokering without leaking anything: we assert the
  // shape of the world, not its contents.
  const brokeredSecrets = {
    FIRMS_MAP_KEY: Boolean(env?.FIRMS_MAP_KEY),
    GOOGLE_GEOCODING_API_KEY: Boolean(env?.GOOGLE_GEOCODING_API_KEY),
    GEMINI_API_KEY: Boolean(env?.GEMINI_API_KEY),
  };

  return json(
    {
      ok: true,
      service: 'eye-of-atlas-api-proxy',
      route: ROUTE_ID,
      environment: env?.ENVIRONMENT ?? 'development',
      timestamp: new Date().toISOString(),

      // Proof the pipeline ran, in a shape that is easy to assert in tests.
      pipeline: {
        originChecked: true,
        origin: origin ?? '(none — same-origin or non-browser)',
        rateLimit: {
          limit: rateLimit.limit,
          used: rateLimit.used,
          remaining: rateLimit.remaining,
          resetSeconds: rateLimit.resetSeconds,
        },
        dailyBudget: {
          limit: budget.budget,
          used: budget.used,
          remaining: budget.remaining,
          resetSeconds: budget.resetSeconds,
        },
        counterBackend: store.backend,
      },

      // Never the values. Only presence.
      brokeredSecrets,

      note:
        'Dummy endpoint. Makes no upstream request. Remove once a real '
        + 'brokered route ships.',
    },
    { origin, headers },
  );
}
