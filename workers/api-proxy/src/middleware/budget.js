/**
 * Per-source daily budget cap — the spend circuit-breaker.
 *
 * This is the control God's Eye View has no equivalent for. Its
 * GEV_RATELIMIT_* knobs are opt-in, unlimited by default, per-minute, and
 * in-memory; its own docs say plainly "it is NOT a billing cap"
 * (docs/GEV-INSPECTION.md §7.2). Master plan §6.6 requires a real one.
 *
 * The contract, in order of preference when the cap is reached:
 *   1. serve cached data (stale is better than absent)
 *   2. return 503 {status:"layer-paused"} so the UI can degrade gracefully
 *   3. never, under any circumstance, pass the request upstream
 *
 * Buckets reset at UTC midnight, matching how providers bill and how our
 * Google Cloud quota caps reset.
 *
 * A note on layering: for metered Google APIs this Worker-side cap is the
 * SECOND line of defence, not the first. The provider-side daily quota cap in
 * the Google Cloud console is authoritative because Google enforces it; a KV
 * counter is best-effort and can undercount under concurrency. Set both.
 */

import { utcDay, secondsUntilUtcMidnight } from '../lib/json.js';

/** Read a positive integer budget from env, or fall back. */
export function budgetFor(env, source, fallback) {
  const raw = env?.[`BUDGET_${source.toUpperCase()}_PER_DAY`];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Consume one unit of the source's daily budget.
 *
 * Call this ONLY when about to hit the upstream — a cache hit must not spend
 * budget, otherwise caching would be pointless.
 *
 * @param {object} args
 * @param {object} args.env
 * @param {ReturnType<import('../lib/store.js').createStore>} args.store
 * @param {string} args.source e.g. "geocode"
 * @param {number} args.fallbackBudget
 * @param {number} [args.now]
 * @returns {Promise<{allowed: boolean, budget: number, used: number, remaining: number, resetSeconds: number}>}
 */
export async function consumeBudget({ env, store, source, fallbackBudget, now = Date.now() }) {
  const budget = budgetFor(env, source, fallbackBudget);
  const key = `budget:${source}:${utcDay(now)}`;
  const resetSeconds = secondsUntilUtcMidnight(now);

  const used = await store.increment(key, resetSeconds);

  return {
    allowed: used <= budget,
    budget,
    used,
    remaining: Math.max(0, budget - used),
    resetSeconds,
  };
}

/**
 * Read the current spend without consuming any — for the /api/health endpoint
 * and for deciding whether to bother with an upstream attempt.
 */
export async function peekBudget({ env, store, source, fallbackBudget, now = Date.now() }) {
  const budget = budgetFor(env, source, fallbackBudget);
  const used = await store.get(`budget:${source}:${utcDay(now)}`);
  return { budget, used, remaining: Math.max(0, budget - used), exhausted: used >= budget };
}

/** Budget headers, emitted for observability and for the health endpoint. */
export function budgetHeaders(result) {
  return {
    'X-Budget-Limit': String(result.budget),
    'X-Budget-Remaining': String(result.remaining),
    'X-Budget-Reset': String(result.resetSeconds),
  };
}
