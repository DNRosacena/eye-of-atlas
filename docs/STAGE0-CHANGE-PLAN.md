# Eye of Atlas — Stage 0 Change Plan

**Task:** Stage 0.3 — *Propose the cleanup diff*
**Date:** 2026-09-01
**Status:** 🟡 **PROPOSAL — NOTHING APPLIED.** No application logic has been modified. This document is for your review; I will not write any of the code in Parts A/B/C until you approve.
**Inputs:** [docs/GEV-INSPECTION.md](GEV-INSPECTION.md) (0.1) · [COMMERCIAL_COMPLIANCE.md](../COMMERCIAL_COMPLIANCE.md) (0.2) · Master Plan §4.3, §6, §13, §28

**Decisions received from you (2026-09-01):**
- ✅ **Weather cut from MVP** — resolves compliance §6.1. Open-Meteo is removed here, not licensed.
- ✅ **Ships out of Stage 1** — resolves compliance §6.3. The Worker is designed **purely request-scoped**; no Durable Objects, no persistent sockets.

**Still open, and how I've handled it:**
- ⏳ **Imagery fallback** (compliance §6.2) — unresolved. Does **not** block this plan; Part C notes the seam. See §5.2 — and note the new cost finding in §3.1 makes it materially less urgent than the master plan assumed.
- ⏳ **Nominatim vs Google Geocoding** (compliance §6.4) — this *does* shape Part B. I have proceeded on your stated lean and mine (**accept for MVP, cache hard, keep the seam clean**), but it is flagged as an assumption in §3.4 because it is the one place where I'm building on an un-confirmed answer.

---

## 0. Summary of what I'm proposing

| Part | Change | Risk | Effort |
|---|---|---|---|
| **A** | Remove 4 Class-D sources + fix 1 attribution bug — one PR, `chore: commercial data cleanup` | Low | ~1 day |
| **B** | Cloudflare Worker key-broker — **narrower than the task specified; see §3.1** | Medium | ~2 days |
| **C** | Cloudflare Pages deploy + Worker binding; Netlify documented as fallback; Vercel excluded | Low | ~0.5 day |

**One deviation you need to rule on.** Task 0.3(b) says to route *"Google 3D Tiles, Gemini (later), FIRMS/AIS"* through the Worker. **I recommend against proxying Google 3D Tiles**, on both cost and licence grounds, and instead capping that spend at Google's own billing layer. The reasoning is in **§3.1** and it rests on a pricing finding that also corrects master plan §6.6. This is the one place where I think the plan's instruction, applied literally, would make the product worse — so I'm flagging rather than quietly doing either thing.

---

# PART A — Remove Class-D sources

**Delivered as one PR: `chore: commercial data cleanup`** (title mandated by master plan §28.3, which also makes these the *only* pre-approved deletions).

**Verification for the whole of Part A:** `npm test` must stay green (2,602 tests, current baseline 0 failures) · `npm run build` succeeds · dev server boots · every remaining layer toggles on/off · `dist/` contains no TeleGeography asset · no `/api/opensky*` or `news.google.com` reference survives outside CHANGELOG.

---

## A1. TeleGeography submarine cables — **delete**

CC BY-NC-SA 3.0, NonCommercial. Currently ships **1,087 KB into the production bundle**.

### Delete outright
| Path | Note |
|---|---|
| `src/data/local_data/telegeography_submarine_cables/` | 4 files, 1.1 MB — `cable-geo.json`, `landing-point-geo.json`, `README.md`, `source.json` |
| `src/data/telegeographySubmarineCables.js` | 1,043 lines |
| `src/data/telegeographySubmarineCables.test.mjs` | 51 KB |

### Edit
| File | Line(s) | Change |
|---|---|---|
| `src/data/localLayers.js` | `:3`, `:50` | Drop the import and the `submarineCablesLayer` array entry |
| `src/data/layerState.js` | `:292` | Remove the `telegeography-submarine-cables` registry entry. ⚠️ **See migration note below** |
| `src/data/dataCredits.js` | `:170-177` | Remove the `telegeography` credit |
| `src/voice/gevActions.js` | `:173-175`, `:3270` | Remove alias map entries + display-name case |
| `vite.config.js` | `:5157`, `:5643`, `:5657`, `:5688`, `:5790` | Remove from voice-tool enums and the "infrastructure mode" named-view prompt (`:5157` currently names three layers — becomes two) |
| `src/overlays/worldOverlayAllocation.worker.mjs` | `:68-73`, `:833`, `:836`, `:910-922`, `:1029` | Remove the cable import, `appendSubmarineCableWorkload`, and the `submarine-cables` benchmark profile |
| `src/overlays/worldOverlay.test.mjs` | — | Remove the *"bounded submarine-cable reference cohort"* perf case (confirmed present in the 0.1 test run) |
| `DATA_SOURCES.md` | `:65`, `:69-76` | Remove the row and the "TeleGeography is bundled but NonCommercial" section |

> ⚠️ **Share-link migration.** `layerState.js:292` assigns the cables layer the URL token `'u'`. Removing the entry means any existing GEV share link containing `u` now references an unknown layer. GEV's restore path should ignore unknown tokens, **but I will verify this explicitly and add a test** — silently mis-restoring a shared view would violate master plan §8.2's round-trip determinism guarantee. **Do not reuse the token `'u'`** for a future layer.

**Rollback:** revert the PR. The data is re-downloadable from the URLs recorded in `source.json`, with sha256 hashes to verify — but per §4.3 it must not return to a monetised build.

---

## A2. OpenSky → adsb.lol as the flight source

Non-commercial; the terms explicitly prohibit *"advertisements on web pages/applications using the API."* ⚠️ **It works fully anonymously** (verified live in 0.1), so it will keep silently working unless deliberately removed.

**This is far cheaper than the master plan assumed.** `src/data/adsbLolFallback.js` already normalises adsb.lol into OpenSky's exact state-vector shape, and `/api/opensky` already serves it via `serveAdsbLolPointFallback()`. **The renderer does not change at all.**

### Delete
| Path | Note |
|---|---|
| `scripts/opensky-import-client.sh` + `package.json` `opensky:import` script | OpenSky-only tooling |

### Edit
| File | Line(s) | Change |
|---|---|---|
| `vite.config.js` | `:2894-3246` | Replace `openSkyProxy()` with `flightsProxy()` — same route contract, adsb.lol as the *only* upstream. Reuses the existing point-fetch (`:2799-2884`), cache and coalescing. Drop all OAuth/Basic token machinery (`:88-140`) |
| `vite.config.js` | `:7343` | Plugin registration rename |
| `src/data/flights.js` | `:273` | `API_URL = '/api/opensky'` → `'/api/flights'` |
| `src/data/flights.js` | `:3049` | `/api/opensky-track` → `/api/flights/track` |
| `src/data/flights.js` | `:321`, `:323`, `:3937-3938`, `:4167-4168` | **Defaults become the caveat** — see below |
| `src/data/flights.js` | `:4093-4110` | Reword `'OpenSky rate limited'` / `'OpenSky unavailable'` error strings |
| `src/data/dataCredits.js` | `:29-36` | Delete the `opensky` credit |
| `src/data/dataCredits.js` | `:38-45` | Rewrite `adsblol` as the primary flight credit: `Flights: adsb.lol contributors (ODbL 1.0) — regional coverage` |
| `.env.example` | `:60-70` | Remove all four `OPENSKY_*` vars |
| `DATA_SOURCES.md` | `:20-22` | Remove the OpenSky row; promote adsb.lol |
| `SECURITY.md` | secrets table | Remove the OpenSky OAuth row |

### The "regional, not global-complete" UI caveat — **already plumbed**

Master plan §4.3.2 requires this surfaced in the UI. **The wiring exists end-to-end:**

- Proxy already emits `X-Flight-Source: adsb.lol` and `X-Flight-Coverage: 250nm regional fallback` (`vite.config.js:2871-2874`)
- Client already reads both (`src/data/flights.js:4087-4088`) into `_lastSource` / `_lastCoverage` (`:4167-4168`)
- Both already flow into the layer status object (`:4070-4071`, `:4619`, `:4715`, `:5236`)
- **The toggle panel already renders it** — `src/data/manager.js:2239` (`stats.coverage || ago`) and `:75`

So the change is **wording, not plumbing**: defaults at `:321`/`:323`/`:3937-3938` become `'adsb.lol'` / `'regional coverage — not all aircraft'`, and the proxy header changes from `250nm regional fallback` to a user-facing phrase. I will confirm the string renders legibly in the panel and is not truncated.

**Risk:** coverage genuinely drops — adsb.lol is community ADS-B, strong over Europe/North America, sparse elsewhere (including the Philippines). Flights are P1, not P0, precisely because of this. **Mitigation is honesty in the UI, not a technical fix.**

**Rollback:** revert. But note reverting reintroduces a licence breach — this is a one-way door for any monetised build.

---

## A3. Google News RSS → GDELT

*"You may only display the content of the Service for your own personal use"*; explicitly forbids using it *"to increase traffic to your Web site for commercial reasons, such as advertising sales."*

**The smallest change in Part A.** GDELT is already implemented as the fallback in the same function.

| File | Line(s) | Change |
|---|---|---|
| `vite.config.js` | `:7047-7060` | Delete the RSS branch from `fetchRegionalNews()`; GDELT (`:7069-7076`) becomes the sole path |
| `vite.config.js` | `:6980`, `:6988`, `:6992` | Delete `decodeRssText`, `rssTag`, `normalizeRssArticles` (unused after the above) |
| `vite.config.js` | `:7075` | Source label `'GDELT fallback'` → `'GDELT Project'` |
| `src/data/dataCredits.js` | `:100-107` | Delete the `google-news-rss` credit |
| `src/data/dataCredits.js` | `:108-115` | Keep `gdelt` — **the link to gdeltproject.org is a licence condition, not decoration** |
| `DATA_SOURCES.md` | `:32-33` | Remove the Google News row; GDELT is no longer a "fail-soft fallback" |

**Behaviour change:** GDELT's `artlist` mode over a 48 h window returns fewer and less locally-specific headlines than Google News for small places. Acceptable — the regional-news panel is not an MVP feature, and GDELT is the only commercially clean option we have.

---

## A4. Open-Meteo / weather — remove (**your decision, 2026-09-01**)

Free API is non-commercial; *"apps that … display advertisements … are considered commercial use."* Cutting from MVP rather than paying.

| File | Line(s) | Change |
|---|---|---|
| `vite.config.js` | `weatherEffectsProxy()` + registration `:7353` | Remove the plugin and `/api/weather-effects` |
| `vite.config.js` | `fetchRegionalWeather` in the regional-brief proxy | Remove the Open-Meteo call; the brief keeps place + headlines |
| `src/cockpitCloudEffects.js` | `:375` | Remove the weather fetch. ⚠️ **Scope check below** |
| `src/data/regionalBrief.js` | weather fields | Remove weather from the brief shape |
| `src/weatherEffectsMath.js` | whole file | Delete if nothing else references it — **verify first** |
| `src/data/dataCredits.js` | `:91-98` | Delete the `open-meteo` credit |
| `.env.example`, `DATA_SOURCES.md` | `:31` | Remove |

> ⚠️ **Scope caution — the one part of Part A I want to touch carefully.** `initCockpitCloudEffects` (`src/main.js:198`) is a *rendering* feature (GPU cloud pass), not merely a data feature. Removing its data input must not break the render path or the cockpit view. **I propose removing only the Open-Meteo data dependency and letting the cloud effect fall back to its static/default behaviour**, rather than ripping out the visual system. If that turns out to be entangled, I will stop and report rather than widen the change unasked.

**Alternative if you change your mind:** the cheapest re-entry is a paid Open-Meteo tier; the code paths above would be restored rather than rebuilt.

---

## A5. Fix the dams source label (attribution bug)

Not Class-D — a correctness fix found in 0.2 (§2.12). The layer panel displays `USACE` for data that is an OpenInfraMap/OSM extract under ODbL, misattributing ODbL data to a US federal agency.

| File | Line | Change |
|---|---|---|
| `src/data/localLayers.js` | `:31` | `source: 'USACE'` → `source: 'OSM / OpenInfraMap'` |

`dataCredits.js:178-185` is already correct and needs no change. One line; included in Part A because it is a licence-correctness fix.

---

## A6. What Part A does *not* touch

Master plan §4.3.4 says to "cut from MVP" CCTV, radio, GBFS and TomTom. **I am deliberately not deleting them in Stage 0.** They are Class C, not D — legal to ship with correct attribution — so removing them is an *MVP scoping* decision, not a compliance one, and it belongs in Stage 1 where we decide the layer set. Deleting them now would mean a large, risky diff (`src/data/cctv.js` alone is 198 KB) with no compliance benefit.

**They will be disabled-by-default rather than deleted**, and I'll propose the actual removal as part of Stage 1's layer-set work. Flagging explicitly so it doesn't look like an oversight against §4.3.

---

# PART B — Cloudflare Worker key broker

## 3.1 ⚠️ Recommendation: do **not** proxy Google 3D Tiles

Task 0.3(b) lists Google 3D Tiles as something to route through the Worker. **I recommend against it.** Three reasons, in order of weight:

**(1) The billing model makes it pointless.** Google's Map Tiles usage documentation (checked 2026-09-01) states that for Photorealistic 3D Tiles:

> **Billable:** root tileset queries (max 10,000 daily)
> **Not billable:** session token requests, viewport information requests, and **renderer-originating tile requests**

**The billable unit is roughly one root request per session — not per tile.** At $6.00/1,000 with 1,000 free per month, that is **~$0.006 per session** beyond the first 1,000 sessions/month. Proxying would put the *unbillable* tile stream — the overwhelming majority of requests — through our Worker for zero billing benefit.

**(2) It would destroy the Workers free tier.** Cloudflare Workers free is **100,000 requests/day**. A single photorealistic 3D session pulls hundreds of tiles. Proxying them would exhaust the daily allowance in the low hundreds of sessions — the Worker would fail long before the Google bill did. It would convert a $6/1,000-sessions cost into a hard availability ceiling.

**(3) It is licence-risky.** Google's policy says *"you must not pre-fetch, index, store, or cache any Content"* and its responses carry `Cache-Control: private`. Passing tile bytes through our own origin is at best untested against that language, and at worst rehosting. Not explicitly prohibited — but I'm not willing to guess on it, and neither approach is required.

### What I propose instead

**Cap the spend where the money actually is — at Google's billing layer, which is strictly stronger than anything a Worker can enforce:**

| Control | Where | Why it's better |
|---|---|---|
| **Per-API daily quota cap** on Map Tiles + Geocoding | Google Cloud Console → APIs & Services → Quotas | A **hard** cap enforced by Google. A Worker counter is best-effort and resets/diverges across isolates |
| **Billing budget + alerts** | Cloud Billing → Budgets | Independent backstop |
| **HTTP referrer restriction + API restriction** on the browser key | Cloud Console credentials | Google's *designed* model for this key — same posture as a Mapbox public token |
| **Client-side idle throttling** of tile requests | `src/main.js` / Cesium `targetFrameRate`, already partly present at `:131` | Reduces quota consumption at source |

The key stays client-side — as GEV, `SECURITY.md`, and Google's own model all intend. **This is not "giving up" on key security**; a Maps browser key is a public token by design, and the real control is quota + referrer, not concealment.

> **This also corrects master plan §6.6**, which frames Google 3D Tiles as *"the main cost risk"* with a target of *"stay within Google's free 1,000 tile-loads/month."* If the billable unit is root/session rather than tile-load, the risk is ~2–3 orders of magnitude smaller than modelled, and the 2D fallback (compliance §6.2) is better justified as a **mobile-performance and quota measure than as a cost lever**.
>
> ⚠️ **Confidence:** this rests on Google's published usage-and-billing documentation, not on observed billing. **It needs empirical confirmation with a real key and one billing cycle** — which loops back to 0.1 open question 3. Until confirmed I would still set a conservative quota cap. If it turns out tiles *are* billed per request, §6.6's original architecture is right and we revisit — but proxying still wouldn't be the answer, because of reason (2).

## 3.2 What the Worker *does* broker

Given the above, plus ships being out of Stage 1, the MVP Worker is small:

| Endpoint | Secret | Why it needs the Worker | Stage |
|---|---|---|---|
| `/api/firms` | `FIRMS_MAP_KEY` | Real secret; must not reach the browser. Also needs the 30 min cache window | 1 (P1) |
| `/api/celestrak/*` | none | **Not for secrecy — for compliance.** CelesTrak IP-blocks on repeated non-200s and requires ≥2 h between fetches; the client refreshes every 5 min. Without a shared cache we'd get the Cloudflare edge IP blocked and break satellites (P0) for everyone | 1 (**P0**) |
| `/api/flights` | none | adsb.lol has no documented rate limit; we self-govern, and the cache keeps us courteous | 1 (P1) |
| `/api/geocode` | Google key | Currently called **direct from the browser with the exposed key** (`src/locations.js:359`). Metered ($5/1,000, 10,000 free/month). Moving it server-side removes a second key-exposure path and lets us cache | 1 (**P0**) |
| `/api/gemini` | `GEMINI_API_KEY` | Real secret; abuse → cost | 3 |
| ~~`/api/ais-live`~~ | — | **Out of scope** per your decision. Would need Durable Objects | — |

**Not proxied, by design:** USGS earthquakes (public domain, keyless, no rate limit — the browser calls it directly today at `src/data/earthquakes.js:28` and should keep doing so) and Google 3D Tiles (§3.1).

> Note the shape this produces: **only two of the five MVP endpoints are there to hide a secret.** The other three exist to enforce provider rate/cache rules. That is a more honest description of what this Worker is than "key broker" — it is a *compliance and courtesy* layer that also happens to hold two keys.

## 3.3 Worker architecture

```
workers/api-proxy/
├── src/
│   ├── index.js              # router + shared middleware pipeline
│   ├── middleware/
│   │   ├── origin.js         # Origin/Referer allowlist -> 403
│   │   ├── ratelimit.js      # per-IP token bucket via CF-Connecting-IP
│   │   ├── budget.js         # per-source daily cap (UTC day)
│   │   └── cache.js          # provider cache-window enforcement
│   ├── routes/
│   │   ├── firms.js · celestrak.js · flights.js · geocode.js
│   └── lib/{cap.js, json.js}
├── wrangler.toml
├── test/                     # node:test, mirroring GEV's harness
└── README.md
```

**Every route passes through the same pipeline** — origin check → rate limit → budget check → cache lookup → upstream fetch (size-capped) → cache store → response. No route may bypass the budget governor; that's enforced by the router, not by convention.

### Origin checks
Allowlist `eyeofatlas.com`, `*.eyeofatlas.pages.dev`, `localhost:4173`/`:5173` from `env.ALLOWED_ORIGINS`. Non-matching → `403`. CORS locked to the same list (master plan §13). *Honest caveat: `Origin` is trivially spoofable outside a browser. This stops casual embedding, not a determined scraper — the budget cap is the real backstop.*

### Per-IP rate limiting
```js
// Fixed-window token bucket in KV. Key: rl:{route}:{ip}:{windowStart}
// ⚠️ MUST use CF-Connecting-IP — GEV's clientKey() (vite.config.js:488)
// deliberately ignores X-Forwarded-For, which is correct for localhost but
// would collapse ALL traffic into one bucket behind Cloudflare.
const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
```
Proposed limits: geocode 20/min · firms 10/min · flights 30/min · celestrak 10/min · gemini 5/min (Stage 3). Over-limit → `429` + `Retry-After`.

*KV is eventually consistent, so this is approximate under a distributed burst. Accepted: it's an abuse damper, not a security boundary. The daily cap is the hard stop.*

### Daily budget caps (master plan §6.6 — the piece GEV has **no** equivalent for)
```js
// KV counter per source per UTC day: budget:{source}:{YYYY-MM-DD}
// Over cap -> serve last-known-good from cache, else 503 + {status:'layer-paused'}
```
| Source | Proposed cap/day | Basis |
|---|---|---|
| Google Geocoding | **300** | 10,000/mo free ÷ 31, with headroom |
| NASA FIRMS | **500** | Well under 5,000/10 min |
| CelesTrak | **12** | Policy: once per 2 h update cycle |
| adsb.lol | **5,000** | Self-imposed courtesy (no published limit) |
| Gemini (Stage 3) | **1,000** | Free-tier headroom |

**Fail-soft, never fail-open.** Over cap → cached data or an explicit "layer paused" state the UI can render (master plan §7.6 graceful degradation). Never unbounded spend.

### Provider cache windows
| Source | TTL | Store | Authority |
|---|---|---|---|
| CelesTrak | **6 h** | KV | Policy: GP updates every 2 h. Matches GEV's `TLE_TTL_MS` |
| FIRMS | **30 min** (24 h hard staleness) | KV | Matches GEV; within FIRMS limits |
| adsb.lol | **12 s** | Cache API | Matches GEV's point cache |
| Geocoding | **24 h** | KV, keyed on normalised query | Cuts repeat cost; Google permits geocode caching (unlike tiles) |
| **Google tiles** | **NEVER** | — | ToS. Not proxied at all, so structurally impossible |

Ported from GEV, plus response size caps and request coalescing (`readResponseJsonCapped`, `coalesceProxyRequest`).

### Not portable — replacements
| GEV construct | Worker replacement |
|---|---|
| `.gev-cache/` disk caches | KV / Cache API |
| In-memory `Map` limiters | KV counters |
| `_nominatimQueue` serial chain | N/A — Nominatim not proxied in MVP (§3.4) |
| `node:https` + DNS pinning SSRF guard | N/A — all upstreams are fixed hosts, no client-supplied URLs |
| AISStream WebSocket | Out of scope |

## 3.4 ⏳ Assumption flagged — geocoding provider

Compliance §6.4 is unanswered. I have designed `/api/geocode` around **Google Geocoding** because that is what GEV uses today (`src/locations.js:359`), it is already keyed, and 10,000/month free comfortably covers MVP search volume.

**If you prefer Nominatim**, the route stays but the upstream and cache change (1 req/s ceiling → needs a queue the Worker can't easily provide across isolates, so it would need a much longer cache TTL and possibly a request queue in KV). **The route interface is identical either way**, so this is a contained change — but I'd rather you confirm than have me guess twice.

---

# PART C — Deployment

## 4.1 Cloudflare Pages (primary)

**Why:** free tier permits commercial use, unlimited bandwidth, and Workers integrate natively. **Vercel is excluded** — its Hobby free tier is non-commercial and the moment we run ads we'd be in breach (master plan §24 and compliance §7 both confirm this; it is a licence exclusion, not a preference).

```toml
# wrangler.toml (Pages)
name = "eye-of-atlas"
pages_build_output_dir = "dist"
compatibility_date = "2026-09-01"
```

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output dir | `dist` |
| Node version | **24** — via `.nvmrc` + `NODE_VERSION` (GEV requires `>=24.14`; this machine defaults to v18) |
| Env vars | `GOOGLE_MAPS_API_KEY` (build-time, → bundle by design, §3.1), `CESIUM_ION_TOKEN` (optional) |

**Worker deployed separately** and bound at `/api/*` so the SPA keeps calling same-origin paths and **no client code changes between local dev and production**.

⚠️ **`dist/` is 28 MB** with a 2.7 MB single asset. Within Pages limits (25 MiB/file, 20,000 files), but tight enough to check on the first deploy rather than assume.

⚠️ **The SPA fallback must not swallow `/api/*`.** This is the exact silent failure demonstrated in 0.1 §5.4 — unmatched `/api` routes returning `index.html` with a `200`. The Worker route binding must take precedence, and I'll add a smoke test asserting `/api/*` returns JSON, never `text/html`.

## 4.2 Netlify (documented fallback, not configured)

Netlify's free tier permits commercial use but caps bandwidth at 100 GB/month — a real constraint for a 28 MB payload (~3,500 cold loads/month). Fallback only; I'll document the migration path in the Worker README without building it.

## 4.3 CI (task 0.4, listed here for completeness)

`.github/workflows/ci.yml` — install → `npm audit --audit-level=high` → lint → `npm test` → `npm run build`. **No deploy step in Stage 0.** Dependabot weekly, grouped, **majors ignored** (master plan §28.3).

---

## 5. Risks, rollback, and what I'd watch

| Risk | Likelihood | Mitigation |
|---|---|---|
| Removing the cables layer breaks share-link restore | Low | Explicit test for unknown-token handling (A1) |
| Weather removal entangles the cockpit cloud render | **Medium** | Remove only the data dependency; **stop and report** if it spreads (A4) |
| adsb.lol coverage disappoints users outside EU/NA | **High** | Not fixable — surfaced honestly in the UI (A2). Flights are P1 for this reason |
| §3.1 tile-billing reading is wrong | Medium | Conservative Google quota cap regardless; confirm with a real key + one billing cycle |
| KV eventual consistency lets a burst exceed a cap | Medium | Caps set with headroom; Google-side quota is the hard backstop |
| Workers free tier (100k/day) exhausted | Low | Only 5 low-volume endpoints; tiles deliberately excluded (§3.1) |
| `dist/` size hits a Pages limit | Low | Verify on first deploy |

**Rollback for all three parts:** each is a separate reviewed PR on `stage-0/audit-and-prep`; `git revert` restores prior state. **Caveat:** reverting Part A reintroduces licence breaches — it is a one-way door for any monetised build. Parts B and C are freely reversible.

---

## 6. What I need from you

1. **🔴 Approve or reject §3.1** — the Google 3D Tiles recommendation. This is the one substantive deviation from the task as written, and it changes Part B's shape. If you want tiles proxied anyway, say so and I'll build it — but I'd want the free-tier ceiling in §3.1(2) understood first.
2. **🟠 Confirm the geocoding provider** (§3.4) — Google (assumed) or Nominatim.
3. **🟢 Approve Part A's scope** — in particular A6 (leaving CCTV/radio/GBFS/TomTom in place for Stage 1) and A4's cautious approach to the cloud-effects entanglement.
4. **⏳ Still open, not blocking:** the imagery fallback (compliance §6.2). §3.1 makes it less urgent than the plan assumed, but it remains a Stage 1 item.

**On approval I will proceed to 0.4** (repo scaffolding, CI, Worker skeleton, Pages config) and hold Parts A/B/C implementation for Stage 1 unless you want Part A landed in Stage 0 — the master plan puts the Class-D removal in Stage 0's exit criteria, so **my assumption is that Part A lands now**, as its own PR, after your approval.
