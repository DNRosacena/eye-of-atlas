/**
 * Worker pipeline tests.
 *
 * Uses node:test to match the harness God's Eye View already uses, so there is
 * one test story across the repo rather than two.
 *
 * These exercise the middleware directly plus the Worker's default export via
 * a synthetic Request, so they need no network, no Cloudflare account, and no
 * provisioned KV. Live behaviour under `wrangler dev` is verified separately
 * (see workers/api-proxy/README.md).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { createStore, __resetMemoryStore, assertProductionReady } from '../src/lib/store.js';
import { isOriginAllowed, parseAllowedOrigins, resolveOrigin } from '../src/middleware/origin.js';
import { checkRateLimit, clientKey } from '../src/middleware/ratelimit.js';
import { consumeBudget, peekBudget } from '../src/middleware/budget.js';
import { cacheWindowFor, CachingForbiddenError, CACHE_WINDOWS } from '../src/middleware/cache.js';
import { utcDay, secondsUntilUtcMidnight } from '../src/lib/json.js';

const ENV = {
  ENVIRONMENT: 'test',
  ALLOWED_ORIGINS: 'http://localhost:4173,https://eyeofatlas.com,*.eyeofatlas.pages.dev',
  RATELIMIT_PING_PER_MIN: '3',
  BUDGET_PING_PER_DAY: '5',
};

function request(path, { origin, ip = '203.0.113.1', method = 'GET' } = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  headers.set('CF-Connecting-IP', ip);
  return new Request(`https://proxy.test${path}`, { method, headers });
}

test.beforeEach(() => __resetMemoryStore());

// ── Origin allowlist ────────────────────────────────────────────────────────

test('origin allowlist accepts exact matches and rejects others', () => {
  const allowed = parseAllowedOrigins(ENV.ALLOWED_ORIGINS);
  assert.equal(isOriginAllowed('http://localhost:4173', allowed), true);
  assert.equal(isOriginAllowed('https://eyeofatlas.com', allowed), true);
  assert.equal(isOriginAllowed('https://evil.example', allowed), false);
  // Near-miss: a suffix match must not be enough.
  assert.equal(isOriginAllowed('https://eyeofatlas.com.evil.example', allowed), false);
});

test('wildcard subdomain matches one label only', () => {
  const allowed = parseAllowedOrigins(ENV.ALLOWED_ORIGINS);
  assert.equal(isOriginAllowed('https://preview.eyeofatlas.pages.dev', allowed), true);
  assert.equal(isOriginAllowed('https://a.b.eyeofatlas.pages.dev', allowed), false);
});

test('missing Origin is allowed through but echoes no CORS origin', () => {
  const resolved = resolveOrigin(request('/api/ping'), ENV);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.origin, null);
});

test('disallowed origin gets 403 and no data', async () => {
  const res = await worker.fetch(request('/api/ping', { origin: 'https://evil.example' }), ENV, {});
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'origin_not_allowed');
});

// ── Rate limiting ───────────────────────────────────────────────────────────

test('rate limiter keys on CF-Connecting-IP, not the socket peer', () => {
  // The GEV proxy keys on the socket address and ignores forwarded headers,
  // which behind Cloudflare would collapse every user into one bucket.
  const req = new Request('https://proxy.test/api/ping', {
    headers: { 'CF-Connecting-IP': '198.51.100.7' },
  });
  assert.equal(clientKey(req), '198.51.100.7');
});

test('rate limiter allows up to the limit then blocks', async () => {
  const store = createStore({});
  const args = { request: request('/api/ping'), env: ENV, store, route: 'ping', fallbackLimit: 10 };

  const first = await checkRateLimit(args);
  assert.equal(first.limit, 3, 'env override should win over the fallback');
  assert.equal(first.allowed, true);

  await checkRateLimit(args);
  const third = await checkRateLimit(args);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const fourth = await checkRateLimit(args);
  assert.equal(fourth.allowed, false);
});

test('separate IPs get separate buckets', async () => {
  const store = createStore({});
  const base = { env: ENV, store, route: 'ping', fallbackLimit: 10 };
  for (let i = 0; i < 3; i += 1) {
    await checkRateLimit({ ...base, request: request('/api/ping', { ip: '1.1.1.1' }) });
  }
  const blocked = await checkRateLimit({ ...base, request: request('/api/ping', { ip: '1.1.1.1' }) });
  const other = await checkRateLimit({ ...base, request: request('/api/ping', { ip: '2.2.2.2' }) });

  assert.equal(blocked.allowed, false);
  assert.equal(other.allowed, true, 'one abusive IP must not throttle everyone else');
});

test('over-limit requests return 429 with Retry-After', async () => {
  const req = () => request('/api/ping', { origin: 'https://eyeofatlas.com' });
  for (let i = 0; i < 3; i += 1) await worker.fetch(req(), ENV, {});

  const res = await worker.fetch(req(), ENV, {});
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'rate_limited');
  assert.ok(Number(res.headers.get('Retry-After')) > 0);
});

// ── Daily budget cap ────────────────────────────────────────────────────────

test('budget cap allows up to the limit then denies', async () => {
  const store = createStore({});
  const args = { env: ENV, store, source: 'ping', fallbackBudget: 1000 };

  for (let i = 0; i < 5; i += 1) {
    const result = await consumeBudget(args);
    assert.equal(result.allowed, true, `call ${i + 1} should be within budget`);
  }
  const over = await consumeBudget(args);
  assert.equal(over.allowed, false);
  assert.equal(over.remaining, 0);
});

test('peekBudget reports spend without consuming any', async () => {
  const store = createStore({});
  const args = { env: ENV, store, source: 'ping', fallbackBudget: 1000 };
  await consumeBudget(args);

  const before = await peekBudget(args);
  const after = await peekBudget(args);
  assert.equal(before.used, 1);
  assert.equal(after.used, 1, 'peek must not spend budget');
});

test('exhausted budget returns 503 layer-paused, never a silent failure', async () => {
  // Budget 5, rate limit high enough not to interfere.
  const env = { ...ENV, RATELIMIT_PING_PER_MIN: '100', BUDGET_PING_PER_DAY: '2' };
  const req = () => request('/api/ping', { origin: 'https://eyeofatlas.com' });

  await worker.fetch(req(), env, {});
  await worker.fetch(req(), env, {});
  const res = await worker.fetch(req(), env, {});

  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.status, 'layer-paused');
  assert.equal(body.source, 'ping');
  assert.ok(Number(res.headers.get('Retry-After')) > 0);
});

test('daily budget bucket is keyed to the UTC day', () => {
  const day = utcDay(Date.UTC(2026, 8, 1, 23, 59, 59));
  const nextDay = utcDay(Date.UTC(2026, 8, 2, 0, 0, 1));
  assert.equal(day, '2026-09-01');
  assert.equal(nextDay, '2026-09-02');
  assert.ok(secondsUntilUtcMidnight(Date.UTC(2026, 8, 1, 23, 59, 0)) <= 60);
});

// ── Provider cache windows ──────────────────────────────────────────────────

test('cache windows match the windows the providers require', () => {
  assert.equal(cacheWindowFor('celestrak'), 6 * 60 * 60, 'CelesTrak: once per update cycle');
  assert.equal(cacheWindowFor('firms'), 30 * 60);
  assert.equal(cacheWindowFor('flights'), 12);
  assert.equal(cacheWindowFor('geocode'), 24 * 60 * 60);
});

test('caching Google tile content is refused, not merely disabled', () => {
  // Google Maps ToS: "you must not pre-fetch, index, store, or cache any
  // Content". We do not proxy tiles at all, so this is belt-and-braces for
  // anyone who later adds a tile route.
  assert.equal(CACHE_WINDOWS['google-tiles'], null);
  assert.throws(() => cacheWindowFor('google-tiles'), CachingForbiddenError);
});

// ── Secret brokering ────────────────────────────────────────────────────────

test('ping reports secret presence but never secret values', async () => {
  const env = { ...ENV, FIRMS_MAP_KEY: 'super-secret-value-do-not-leak' };
  const res = await worker.fetch(request('/api/ping', { origin: 'https://eyeofatlas.com' }), env, {});
  const raw = await res.text();

  assert.equal(res.status, 200);
  assert.ok(!raw.includes('super-secret-value-do-not-leak'), 'secret value must never appear in a response');
  assert.equal(JSON.parse(raw).brokeredSecrets.FIRMS_MAP_KEY, true);
  assert.equal(JSON.parse(raw).brokeredSecrets.GEMINI_API_KEY, false);
});

test('ping response documents the whole pipeline', async () => {
  const res = await worker.fetch(request('/api/ping', { origin: 'https://eyeofatlas.com' }), ENV, {});
  const body = await res.json();

  assert.equal(body.ok, true);
  assert.equal(body.pipeline.originChecked, true);
  assert.equal(body.pipeline.rateLimit.limit, 3);
  assert.equal(body.pipeline.dailyBudget.limit, 5);
  assert.equal(body.pipeline.counterBackend, 'memory');
});

// ── Response discipline ─────────────────────────────────────────────────────

test('unknown /api routes return JSON 404, never HTML', async () => {
  // GEV's dev/preview server serves index.html for unmatched /api routes with
  // a 200, so clients get HTML where they expect JSON and fail silently.
  const res = await worker.fetch(request('/api/nope', { origin: 'https://eyeofatlas.com' }), ENV, {});
  assert.equal(res.status, 404);
  assert.match(res.headers.get('Content-Type'), /application\/json/);
  assert.equal((await res.json()).error, 'not_found');
});

test('non-GET methods are rejected', async () => {
  const res = await worker.fetch(
    request('/api/ping', { origin: 'https://eyeofatlas.com', method: 'POST' }), ENV, {},
  );
  assert.equal(res.status, 405);
});

test('preflight succeeds without spending rate-limit allowance', async () => {
  const env = { ...ENV, RATELIMIT_PING_PER_MIN: '2' };
  const opts = { origin: 'https://eyeofatlas.com', method: 'OPTIONS' };

  await worker.fetch(request('/api/ping', opts), env, {});
  await worker.fetch(request('/api/ping', opts), env, {});
  const res = await worker.fetch(request('/api/ping', { origin: 'https://eyeofatlas.com' }), env, {});

  assert.equal(res.status, 200, 'OPTIONS storms must not burn a caller‘s quota');
});

test('CORS origin is echoed exactly, never as a wildcard', async () => {
  const res = await worker.fetch(request('/api/ping', { origin: 'https://eyeofatlas.com' }), ENV, {});
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://eyeofatlas.com');
});

// ── Health + production guard ───────────────────────────────────────────────

test('health reports budgets and warns about the memory backend', async () => {
  const res = await worker.fetch(request('/api/health', { origin: 'https://eyeofatlas.com' }), ENV, {});
  const body = await res.json();

  assert.equal(body.ok, true);
  assert.equal(body.counterBackend, 'memory');
  assert.match(body.counterBackendWarning, /KV/);
  assert.equal(body.budgets.ping.budget, 5);
});

test('production without a KV binding refuses to serve', async () => {
  assert.throws(() => assertProductionReady({ ENVIRONMENT: 'production' }), /COUNTERS KV/);
  assert.doesNotThrow(() => assertProductionReady({ ENVIRONMENT: 'production', COUNTERS: {} }));

  const res = await worker.fetch(
    request('/api/ping', { origin: 'https://eyeofatlas.com' }),
    { ...ENV, ENVIRONMENT: 'production' },
    {},
  );
  assert.equal(res.status, 500, 'ineffective caps in production must fail loudly, not silently');
});
