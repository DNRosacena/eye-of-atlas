/**
 * Counter store abstraction.
 *
 * The rate limiter and budget governor both need a small persistent counter.
 * In production that is Cloudflare KV. But KV must be provisioned before it
 * can be bound, which would make the skeleton undeployable and untestable out
 * of the box — so this falls back to an in-memory map when no KV binding is
 * present.
 *
 * IMPORTANT: the in-memory fallback is per-isolate and evaporates on eviction.
 * It is adequate for `wrangler dev`, unit tests, and proving the pattern. It
 * is NOT adequate for production — a real deployment must bind KV, and
 * `assertProductionReady()` below refuses to start without it.
 *
 * On consistency: KV is eventually consistent, so a distributed burst can
 * briefly exceed a limit. That is accepted. Rate limiting here is an abuse
 * damper, not a security boundary, and the daily budget cap is backstopped by
 * provider-side quotas (see docs/STAGE0-CHANGE-PLAN.md §3.1).
 */

/** @type {Map<string, {value: number, expiresAt: number}>} */
const memory = new Map();

/** Bound the in-memory map so a key-space attack cannot grow it without limit. */
const MEMORY_MAX_KEYS = 10_000;

function memoryGet(key, now) {
  const entry = memory.get(key);
  if (!entry) return 0;
  if (entry.expiresAt <= now) {
    memory.delete(key);
    return 0;
  }
  return entry.value;
}

function memoryIncrement(key, ttlSeconds, now) {
  const current = memoryGet(key, now);
  const next = current + 1;
  if (memory.size >= MEMORY_MAX_KEYS && !memory.has(key)) {
    // Evict the oldest insertion rather than growing without bound.
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value: next, expiresAt: now + ttlSeconds * 1000 });
  return next;
}

/**
 * Create a counter store over the KV namespace if one is bound, else memory.
 * @param {{COUNTERS?: KVNamespace}} env
 * @param {() => number} [clock] injectable for tests
 */
export function createStore(env, clock = Date.now) {
  const kv = env?.COUNTERS ?? null;

  return {
    backend: kv ? 'kv' : 'memory',

    /** Current value of a counter (0 when absent or expired). */
    async get(key) {
      if (!kv) return memoryGet(key, clock());
      const raw = await kv.get(key);
      const parsed = Number.parseInt(raw ?? '0', 10);
      return Number.isFinite(parsed) ? parsed : 0;
    },

    /**
     * Increment a counter and return its new value.
     *
     * Note this is read-then-write, which is racy under concurrency: two
     * simultaneous requests can both read N and both write N+1, undercounting
     * by one. KV offers no atomic increment. Accepted for the reasons in the
     * module header; if exact counting ever matters, this is the seam where a
     * Durable Object would go.
     */
    async increment(key, ttlSeconds) {
      if (!kv) return memoryIncrement(key, ttlSeconds, clock());
      const next = (await this.get(key)) + 1;
      await kv.put(key, String(next), { expirationTtl: Math.max(60, ttlSeconds) });
      return next;
    },
  };
}

/** Test-only: clear the in-memory backend between cases. */
export function __resetMemoryStore() {
  memory.clear();
}

/**
 * Refuse to run in production without a real KV binding.
 * Called once at request entry; cheap.
 * @param {object} env
 * @throws {Error} when ENVIRONMENT is "production" and COUNTERS is unbound
 */
export function assertProductionReady(env) {
  if (env?.ENVIRONMENT === 'production' && !env?.COUNTERS) {
    throw new Error(
      'COUNTERS KV namespace is not bound. Rate limits and daily budget caps '
      + 'would be per-isolate and ineffective. Refusing to serve in production.',
    );
  }
}
