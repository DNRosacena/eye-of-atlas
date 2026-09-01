# Eye of Atlas — API proxy Worker

A deliberately small, **request-scoped** Cloudflare Worker. No Durable Objects,
no persistent connections, no database.

## What it is for

Two distinct jobs, and the distinction matters:

**1. Secret brokering** — keys that must never reach the browser:
`FIRMS_MAP_KEY`, `GOOGLE_GEOCODING_API_KEY`, and later `GEMINI_API_KEY`.

**2. Provider compliance** — cache windows and rate ceilings that providers
require and a browser cannot be trusted to honour. CelesTrak is the clearest
case: it IP-blocks clients that repeatedly ignore non-200 responses, and asks
for one fetch per 2-hour update cycle. Our client refreshes satellites every
5 minutes. Without a shared 6-hour cache here we would forward that cadence,
get the **shared Cloudflare edge IP** blocked, and break a P0 layer for
everyone — not just for us.

Worth being honest about the shape this produces: **only two of the five
planned MVP endpoints exist to hide a secret.** The rest are there to be a good
citizen. "Key broker" undersells it; it is a compliance layer that also holds
two keys.

## What it deliberately does *not* do

- **Proxy Google Photorealistic 3D Tiles.** Renderer-originating tile requests
  are not billable — only root tileset queries are — so the billable unit is
  roughly per-session, not per-tile. Proxying would push the unbillable bulk
  through a 100,000 req/day free tier for zero billing benefit, and passing
  tile bytes through our own origin is untested against Google's
  no-cache/no-rehost language. Spend is capped at Google's own quota layer,
  which is a *hard* cap rather than a best-effort counter.
  See [`docs/STAGE0-CHANGE-PLAN.md` §3.1](../../docs/STAGE0-CHANGE-PLAN.md).
- **Proxy USGS earthquakes.** Public domain, keyless, no rate limit. The
  browser calls it directly and should keep doing so.
- **Hold WebSockets.** AISStream would require Durable Objects; ships are out
  of Stage 1.

## Pipeline

Every route passes through the same stages, enforced by the router rather than
by each handler remembering to. A route cannot opt out of the budget governor —
that possibility is precisely the bug this design prevents.

```
request
  → origin allowlist        403 if the Origin header is present and unlisted
  → per-IP rate limit       429 + Retry-After
  → daily budget cap        503 {status:"layer-paused"} + Retry-After
  → cache lookup            HIT skips the upstream (and does not spend budget)
  → upstream fetch          size-capped, timeout-bounded
  → response                always JSON, never HTML
```

### Design notes worth knowing

**Rate limiting keys on `CF-Connecting-IP`.** God's Eye View keys on the socket
peer address and deliberately ignores `X-Forwarded-For` — correct for a
localhost dev server, where a client-controlled header would let an attacker
mint fresh quota. Behind Cloudflare that logic inverts: the socket peer is the
edge, so every user on earth would share one bucket. `CF-Connecting-IP` is set
by Cloudflare and overwrites any inbound value.

**Origin checking is not a security boundary.** The `Origin` header is trivially
forged outside a browser. It stops casual embedding and hotlinking. The rate
limit and the daily cap are what actually bound the damage.

**Counters are eventually consistent.** KV has no atomic increment, so a
distributed burst can briefly exceed a limit. Accepted: rate limiting is an
abuse damper, and for metered Google APIs the provider-side quota cap is the
authoritative backstop. If exact counting ever matters, `lib/store.js` is the
seam where a Durable Object would go.

**Caching a Google tile response throws.** `CACHE_WINDOWS['google-tiles']` is
`null`, meaning *forbidden*, not merely *disabled*. We do not proxy tiles at
all, so this is belt-and-braces for whoever later adds a tile route.

## Layout

```
src/
├── index.js                 router + pipeline
├── lib/
│   ├── json.js              JSON-only responses, CORS, layer-paused contract
│   └── store.js             KV counters, with an in-memory dev fallback
├── middleware/
│   ├── origin.js            allowlist
│   ├── ratelimit.js         per-IP fixed window
│   ├── budget.js            per-source daily cap (UTC day)
│   └── cache.js             provider cache windows
└── routes/
    └── ping.js              dummy brokered endpoint — delete once real routes ship
test/proxy.test.mjs          22 tests (node:test, matching GEV's harness)
```

## Endpoints

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /api/health` | Liveness + current budget consumption. No secrets, no spend. | ✅ |
| `GET /api/ping` | Dummy brokered endpoint proving the pipeline. **Remove in Stage 1.** | ✅ |
| `GET /api/firms` | NASA FIRMS wildfires — brokers `FIRMS_MAP_KEY`, 30 min cache | Stage 1 |
| `GET /api/celestrak/*` | Satellite TLEs — 6 h cache (compliance, not secrecy) | Stage 1 |
| `GET /api/flights` | adsb.lol — 12 s cache, self-governed rate | Stage 1 |
| `GET /api/geocode` | Google Geocoding — brokers the key, 24 h cache | Stage 1 |
| `GET /api/gemini` | Ask Atlas | Stage 3 |

## Local development

```bash
nvm use 24
npm ci
npm test                                        # 22 tests, no network needed
npx wrangler dev --var FIRMS_MAP_KEY:fake-value  # http://localhost:8787
```

Verify the pipeline by hand:

```bash
curl -s http://localhost:8787/api/health
curl -s -H 'Origin: http://localhost:4173' http://localhost:8787/api/ping
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://evil.example' http://localhost:8787/api/ping   # 403
for i in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code} ' -H 'Origin: http://localhost:4173' -H 'CF-Connecting-IP: 198.51.100.1' http://localhost:8787/api/ping; done; echo   # ...429
```

> **`compatibility_date` is pinned to a date the installed wrangler's bundled
> runtime supports.** A date in the future of the local runtime makes
> `wrangler dev` refuse to start. Bump it alongside a wrangler upgrade, not on
> its own.

## Before deploying to production

1. **Provision KV and bind it.** Without it the Worker falls back to in-memory
   counters that are per-isolate and evaporate on eviction — the caps would be
   decorative. `src/lib/store.js` refuses to serve in production without the
   binding, and `/api/health` warns loudly in development.
   ```bash
   npx wrangler kv namespace create COUNTERS   # then paste the id into wrangler.toml
   ```
2. **Set secrets** — never in `wrangler.toml`:
   ```bash
   npx wrangler secret put FIRMS_MAP_KEY
   npx wrangler secret put GOOGLE_GEOCODING_API_KEY
   ```
3. **Set provider-side quota caps.** For every metered Google API, set a hard
   daily quota and a billing budget in the Google Cloud console. This Worker's
   cap is the second line of defence, not the first.
4. **Set `ALLOWED_ORIGINS`** to the production domains.
5. **Confirm `/api/*` reaches the Worker, not the Pages SPA fallback** — assert
   `/api/health` returns `application/json`, never `text/html`.
