# God's Eye View — Inspection Report

**Task:** Eye of Atlas Stage 0.1 — *Inspect and run the source project*
**Date:** 2026-09-01
**Inspected commit:** `6d83bb6008738db2aa067284586be04ea0c5eabb` — *"fix(data): keep node:fs out of the browser-built data modules (#83)"*, authored 2026-08-31 (one day before inspection)
**Upstream:** https://github.com/bilawalsidhu/gods-eye-view · MIT
**Local checkout:** `eyeofatlas/gods-eye-view-upstream/` (shallow clone, gitignored — not vendored into our repo yet)
**Method:** shallow clone → `npm install` → `npm run build` → `npm run dev` (browser-verified) → `vite preview` (endpoint probes) → `npm test` → static source analysis

> **Scope note.** This document records the *actual observed state* of the code, not the README's or the master plan's claims. Where the master plan §3 differs from what is on disk, the difference is called out explicitly in §9. Licence classification and commercial actions are deliberately **out of scope here** — they belong to task 0.2 (`COMMERCIAL_COMPLIANCE.md`). This report supplies the code-path evidence that 0.2 will cite.

---

## 1. Executive summary — the five things that matter

1. **There is no server component.** The entire "server-side proxy" is **~7,400 lines of Vite dev-server middleware inside `vite.config.js`** — 19 plugins exposing 24 `/api/*` endpoints. It is not a deployable service. Upstream `SECURITY.md` says so plainly: *"The Vite server is a development/preview server."* **This is the single biggest thing Stage 0 must replace**, and it is the direct justification for the Cloudflare Worker in the master plan §6.4.
2. **`vite build` produces a static bundle that is functionally broken on its own.** The build succeeds (5.5 s, 28 MB `dist/`) but ships zero backend. Of the 19 proxy plugins, only 9 register `configurePreviewServer`; the other 10 are dev-only. **Verified empirically** — under `vite preview`, `/api/celestrak`, `/api/opensky` and `/api/firms` return `text/html` (the SPA index fallback), not data. Half the layers silently break in preview; on a pure static host all of them do.
3. **The Google Maps API key is compiled into the browser bundle** by Vite `define` — confirmed, it appears 4× in `dist/assets/index-*.js`. Upstream treats this as intentional and mitigates with Google Cloud referrer restrictions. For a public ad-supported product this is the cost/abuse risk the master plan §13 flags, and it is exactly what the Worker broker must fix.
4. **Cost controls are weaker than the plan assumed.** There is **no daily budget cap on Google or OpenAI** — only an *opt-in, per-IP, per-minute, in-memory* limiter that is **unlimited by default**. The only daily budget anywhere is TomTom's (`TOMTOM_DAILY_TILE_BUDGET`, default 40,000). The code comments say it outright: *"it is NOT a billing cap."* Worse for us, one **metered Google Places call fires on page load** (§5.3).
5. **The good news is substantial.** The app boots and **degrades gracefully** when the Google key is invalid (falls back to the Cesium globe, verified live). All 16 layers default **OFF**. `adsb.lol → OpenSky-shape` normalisation **already exists** (`src/data/adsbLolFallback.js`), so the Class-D flight-source swap is far cheaper than the plan assumed. The TeleGeography removal is nearly a clean delete. Google News RSS → GDELT is a **~30-line change in one function**. 2,602 tests pass.

---

## 2. Real tech stack & toolchain

| Item | Actual state |
|---|---|
| Language | **Vanilla JavaScript**, ES modules. No React/Vue/Svelte. No TypeScript. |
| Rendering | **CesiumJS `^1.124.0`** + Google Photorealistic 3D Tiles |
| Build | **Vite `^6.0.0`** (resolved `6.4.3`) + `vite-plugin-cesium ^1.2.23` |
| Node (declared) | `>=24.14.0 <25 \|\| >=26 <27` (`package.json` `engines`) |
| Node (used here) | **v24.19.0** via nvm. ⚠️ *This machine's default `node` is **v18.19.1** — it does not satisfy `engines`.* See §8. |
| npm | 9.2.0 (system) / bundled with Node 24 |
| Package manager | npm; `package-lock.json` committed |
| Runtime deps | 6 only: `cesium`, `satellite.js`, `egm96-universal`, `mgrs`, `pbf`, `@mapbox/vector-tile` |
| Dev deps | `vite`, `vite-plugin-cesium`, `puppeteer`, `sharp`, `ws` |
| Total installed | 201 packages — **a genuinely lean tree** |
| Tests | Node's built-in `node:test`, run by `scripts/run-unit-tests.mjs` |
| Licence | MIT (`LICENSE`, © Bilawal Sidhu) |

**No framework, no router, no state library, no CSS framework.** `style.css` is a single hand-written 9,163-line / 247 KB file. `index.html` is a single 899-line / 53 KB document containing the entire UI skeleton.

### `npm audit` — 9 high severity, all build/dev-side

| Package | Path | Ships to browser? |
|---|---|---|
| `extract-zip` → `@puppeteer/browsers` → `puppeteer` | devDep (test harness) | No |
| `sharp` (libvips CVEs) | devDep (image scripts) | No |
| `ip-address` | transitive dev | No |
| `js-yaml` | transitive dev | No |
| `nanoid`, `postcss` | transitive via Vite (build time) | No |

Two fixes (`puppeteer@25`, `sharp@0.35`) are **breaking major bumps** — per our ground rules and master plan §28.3 these are **not** to be applied without explicit approval. Non-breaking `npm audit fix` clears `ip-address`, `js-yaml`, `nanoid`, `postcss`. **Recommendation deferred to 0.3.**

---

## 3. How the SPA boots

Entry: `index.html` → `<script type="module" src="/src/main.js">`. `src/main.js` is **336 lines** and is the whole bootstrap.

Boot sequence (`src/main.js:69` `async function init()`):

1. `main.js:77` — read `import.meta.env.CESIUM_ION_TOKEN`; if set → `Cesium.Ion.defaultAccessToken`.
2. `main.js:83-85` — read `import.meta.env.GOOGLE_MAPS_API_KEY`; **throws** if absent. *This is a hard boot dependency.*
3. `main.js:87` — `Cesium.GoogleMaps.defaultApiKey = googleApiKey`.
4. `main.js:90` — **`window.__GOOGLE_MAPS_API_KEY__ = googleApiKey`** — the key is also parked on `window` for `src/locations.js` geocoding. Two separate client-side exposure paths.
5. `main.js:92-124` — construct `Cesium.Viewer` with all default chrome disabled; a `#cesium-credits` div is created for the **required** Google/data attribution (the code comments correctly note ToS requires it stay visible even in clean/recording modes).
6. `main.js:131` — `viewer.targetFrameRate = 60` (caps 120 Hz displays — a deliberate perf fix).
7. `main.js:139` — `registerDataCredits(viewer)` registers per-layer attribution into the "Data attribution" popover.
8. `main.js:159-171` — `createGooglePhotorealistic3DTileset()` inside a `try/catch`. **On failure it logs a warning and re-shows the Cesium globe rather than aborting** — this is the graceful-degradation path, verified live in §5.2.
9. `main.js:178` — `MapStackController` with `initialStack: tileset ? 'photoreal' : 'osm'`.
10. `main.js:194` — `StyleManager` (`src/ui.js`, 455 KB) takes over HUD/locations/share-links.
11. `main.js:202-207` — if no share state in the URL → `flyToAustin(viewer)`. **Austin, TX is the hardcoded default view.**
12. `main.js:209-230` — `DataLayerManager` construction and **16 `register()` calls** (§4).
13. `main.js:231` — `finalizeRegistrations(LAYER_STATE_REGISTRY)` seals the registry before share-state restore.
14. `main.js:241` — `buildTogglePanel(document.getElementById('data-toggles'))`.
15. `main.js:245-250` — `SceneDirector` (cinematics) and `initAnnotations`.
16. `main.js:254-263` — loading screen hides after `initialRestorePromise` **and** a hard 1,000 ms floor; then `initFirstRunExperience`.

**Everything is statically imported.** `main.js:1-34` pulls in all 13 layer modules eagerly. There is **no code splitting and no lazy loading of layer modules** — confirmed by the dev network trace (193 module requests on boot) and by the production build emitting one 1.35 MB `index-*.js`.

---

## 4. True file/folder structure

The master plan §3.3 reproduces the README's tidy 8-line tree. **Reality is roughly an order of magnitude larger.**

```
gods-eye-view/
├── vite.config.js        7,383 lines / 322 KB  ← build config + THE ENTIRE BACKEND
├── index.html              899 lines /  53 KB  ← full UI skeleton
├── style.css             9,163 lines / 247 KB  ← single hand-written stylesheet
├── package.json                               ← 6 runtime deps
├── src/
│   ├── main.js             336 lines          ← bootstrap only
│   ├── ui.js               455 KB             ← StyleManager, HUD, panels (largest module)
│   ├── hud.js               34 KB
│   ├── sharelink.js                           ← URL view-state encode/decode (relevant to plan §8)
│   ├── locations.js         42 KB             ← search + geocode (uses window.__GOOGLE_MAPS_API_KEY__)
│   ├── mapStackController.js                  ← Google / Bing / OSM stack switching
│   ├── camera.js · cameraVerbs.js · orbit.js · navigationPolicy.js
│   ├── data/              ~110 modules        ← layers, policies, renderers, context store
│   │   └── local_data/
│   │       ├── datacenters/       2.5 MB
│   │       ├── dams/              730 KB
│   │       ├── natural_earth/     2.6 MB
│   │       ├── neighborhoods/     222 KB
│   │       └── telegeography_submarine_cables/  1.1 MB  ← Class-D, see 0.2
│   ├── voice/             gevRealtime.js (108 KB) · gevActions.js (136 KB) · voiceCost.js
│   ├── overlays/          worldOverlay.js (93 KB) + Node benchmark worker
│   ├── annotations/       5 modules
│   ├── scenes/            director.js · recipes.js · scenePolicy.js
│   └── styles/            anime · noir · retro · snow · surveillance · thermal
├── scripts/               dev-secure.sh · run-unit-tests.mjs · track-regression.mjs · qa-*
├── config/ · docs/ · public/ · tools/
└── README.md · DATA_SOURCES.md (21 KB) · SECURITY.md · TESTING.md · CONTRIBUTING.md · CHANGELOG.md
```

**Counted on disk:**
- **299** `.js`/`.mjs` files under `src/`
- **144** non-test source modules — **92,686 LOC**
- **155** `*.test.mjs` files (test code slightly outnumbers source files)

> **Implication for us.** This is not a small foundation to fork casually. `src/ui.js` alone (455 KB) is bigger than most complete SPAs. The master plan's Stage 4 instruction — *"migrate the shell/routing to Astro… don't rewrite the globe"* — is the right call, but the shell (`index.html` + `ui.js` + `style.css` ≈ 755 KB of hand-written markup/CSS/JS) is itself a significant migration surface. Flagged as a Stage 1/4 sizing risk, not a Stage 0 problem.

### The 16 registered layers

The plan says "~13 live layers". The actual `LAYER_STATE_REGISTRY` (`src/data/layerState.js`) holds **16**:

`flights` · `military` · `earthquakes` · `satellites` · `rocket-launches` · `traffic` · `cctv` · `radio` · `bikeshare` · `ais-live-vessels` · `military-installations` · `military-awareness` · `local-datacenters` · `local-dams` · `local-firms` · `telegeography-submarine-cables`

Registered in `src/main.js:212-230`; the last four come from `src/data/localLayers.js` (which despite the name now includes **live** FIRMS — see the comment at `localLayers.js:36-38`).

**All 16 default to OFF** — verified in-browser (§5.2). Layer state persists via `layerState.js` tokens in the share URL.

---

## 5. Running it locally — what actually happened

### 5.1 Install & build

```
npm install   → 201 packages, 1m16s, 9 high-severity advisories (all dev-side)
npm run build → ✓ built in 5.52s — 152 modules transformed
```

Production `dist/` = **28 MB**: `cesium/` 14 MB · `assets/` 12 MB · `models/` 3.2 MB.

Largest emitted chunks:

| Chunk | Raw | gzip |
|---|---|---|
| `egm96-universal.esm-*.js` | 2,770 KB | 1,850 KB |
| `regions-*.js` (Natural Earth) | 1,987 KB | 684 KB |
| `datacenters-*.geojsonl` | 2,562 KB | — |
| `index-*.js` (app) | 1,353 KB | 417 KB |
| `dams-*.geojsonl` | 730 KB | — |
| `cable-geo-*.json` (TeleGeography) | 728 KB | 243 KB |
| `marine-*.js` | 633 KB | 223 KB |
| `landing-point-geo-*.json` (TeleGeography) | 359 KB | 73 KB |
| `index-*.css` | 184 KB | 32 KB |

Two findings here:

- **The Class-D TeleGeography data ships in the production build** (1,087 KB raw across two chunks). Confirms it is not merely a repo artefact.
- **The bundle is far outside the master plan §14 performance budgets.** ~4 MB gzip of eagerly-bundled payload before Cesium's own 14 MB of assets. Every bundled dataset is emitted whether its layer is on or not. Not a Stage 0 problem, but it sets the real scale of Stage 2's perf work.

**Key-in-bundle check:** built with `GOOGLE_MAPS_API_KEY=PLACEHOLDER_NOT_A_REAL_KEY`; the literal appears **4×** in `dist/assets/index-*.js`. Confirmed: `vite.config.js:7370-7373` `define` inlines it.

### 5.2 Dev server — it runs

`npm run dev` → Vite ready in **409 ms**, serving on `:4173` (`PORT` from `.env`).

I ran it with a deliberately fake Google key (I hold no real credentials). Observed in-browser:

```
[warn] [Init] Google 3D Tiles unavailable, falling back to Cesium globe:
       {statusCode: 400, ... "API ... please pass a valid API key."}
[log]  [Detection] Initialized
[log]  [TrackedReadout] Initialized
[log]  [Detection] Mode: DENSE
```

DOM verification after load:

```json
{ "loadingHidden": true,
  "canvas": true,
  "credits": "Data attribution",
  "toggles": ["✈️ Live Flights — OFF  (OpenSky Network · never)",
              "🎖️ Military Flights — OFF  (adsb.lol · never)",
              "🌋 Earthquakes (24h) — OFF  (USGS · never)",
              "🛰️ Satellites — OFF ..."] }
```

**Verdict: GEV runs locally.** The loading screen clears, the Cesium canvas renders, the attribution control is present, and the layer panel is populated with all layers off. Only one console `error` — the expected 400 from the fake key.

> **Not verified:** Google Photorealistic 3D Tiles themselves, Cesium ion imagery, FIRMS, AISStream, TomTom, and the OpenAI voice path — all require credentials I do not have. **Question for you in §11.**

**Boot timing (dev, unbundled):** `domContentLoaded` **7.14 s**, `load` **7.73 s**, across **193** module requests. This is *not* comparable to the README's 1.86 s claim, which is presumably a production build on the author's hardware. **A meaningful cold-start number requires a production build with a real Google key** — deferred, and noted as an open item for the Stage 1 perf baseline.

### 5.3 What actually goes over the wire on boot

With all layers off, exactly **one** upstream call fires:

```
GET /api/google/nearby-places?lat=30.267197&lon=-97.7431&radiusM=5000
```

(Austin — the hardcoded default view.) Issued from `src/voice/gevActions.js:3054`.

**This is a metered Google Places call on every page load, before the user does anything.** With no daily cap (§7.2) and no default rate limit, this is a direct per-pageview cost on a product intended to be free and ad-supported. **Flagged as a Stage 0.3 must-fix.**

Also fired: `POST /api/realtime/debug-log` → 204 (local voice debug logging, writes to gitignored `.gev-logs/`).

### 5.4 `vite preview` — the static-hosting failure, demonstrated

Built, then served with `vite preview` on `:4180`, probing the same endpoints against dev on `:4173`:

| Endpoint | `vite preview` | `npm run dev` |
|---|---|---|
| `/api/launches` | `application/json` ✅ real data | `application/json` ✅ |
| `/api/celestrak/active` | **`text/html`** ❌ SPA fallback | `text/plain` ✅ real TLEs |
| `/api/opensky` | **`text/html`** ❌ SPA fallback | `application/json` ✅ live states |
| `/api/firms` | **`text/html`** ❌ SPA fallback | `503` ✅ correct "no key" |

The `200 OK` on the broken endpoints is **misleading** — it is `index.html` being served by the SPA history fallback. The client asks for JSON and receives an HTML document. This is a *silent* failure mode, and it is what a naive Cloudflare Pages deploy of `dist/` would do for **all 24** endpoints.

Cause: only **9 of 19** plugins register `configurePreviewServer` —

| Survives `vite preview` (9) | Dev-server only (10) |
|---|---|
| `ais-live-proxy` · `google-places-context-proxy` · `military-installations-proxy` · `openai-realtime-proxy` · `radio-browser-proxy` · `regional-brief-proxy` · `rocket-launches-proxy` · `track-backfill-proxies` · `weather-effects-proxy` | `adsbdb-proxy` · `adsblol-proxy` · `cctv-proxy` · `celestrak-proxy` · `firms-proxy` · `gbfs-proxy` · `opensky-proxy` · `overpass-proxy` · `terrain-heights-proxy` · `tomtom-proxy` |

### 5.5 Test suite

```
npm test → 2,602 tests · 2,534 ✔ · 0 ✖ · 0 skipped · ~2m11s wall
```

**A green suite on first run with no configuration.** The tests are hermetic (no network, no keys). Notable: the perf suite asserts per-frame allocation budgets under simulated load (e.g. *"steady moving-source frames stay in budget with the Dense detection lane active over 5,000 observations"*). This is a genuinely valuable inheritance — it gives us a regression net for Stage 1/2 refactors. `TESTING.md` documents the harness.

---

## 6. The server/proxy component — the pattern we must replace

### 6.1 What it is

**`vite.config.js`** — 7,383 lines. Structure: ~1,200 lines of shared infrastructure (rate limiters, response caps, SSRF guards, cache helpers, Overpass QL sanitiser), then 19 plugin factories, then a 50-line `defineConfig` at `:7333`.

Each plugin follows the same shape:

```js
function celestrakProxy() {
  return {
    name: 'celestrak-proxy',
    configureServer(server) {
      server.middlewares.use('/api/celestrak', async (req, res) => { /* ... */ });
    },
  };
}
```

Registered as an ordinary plugin array at `vite.config.js:7342-7354`.

### 6.2 The 24 endpoints and their client callers

| Endpoint | Client call site(s) | Secret held server-side |
|---|---|---|
| `/api/opensky` | `src/data/flights.js:273` | `OPENSKY_CLIENT_ID/SECRET` (optional — works anonymously) |
| `/api/opensky-track` | `src/data/flights.js:3049` | same |
| `/api/adsblol/mil` | `src/data/militaryFlights.js:83`, `src/data/militaryRegistry.js:108` | none |
| `/api/adsblol/trace` | `src/data/militaryFlights.js:2200` | none |
| `/api/adsbdb/type/`, `/api/adsbdb/route/` | `src/data/flights.js:822`, `:846` | none |
| `/api/celestrak/*` | `src/data/satellites.js:1096`, `:1635`; `src/data/rocketLaunches.js:3258` | none |
| `/api/firms` | `src/data/firmsHeatmap.js:39` | **`FIRMS_MAP_KEY`** |
| `/api/launches` | `src/data/rocketLaunches.js:16` | none (optional token) |
| `/api/ais-live`, `/api/ais-live/track` | `src/data/aisLiveVessels.js:55`, `:1657` | **`AISSTREAM_API_KEY`** |
| `/api/tomtom`, `/api/tomtom/flow/`, `/api/tomtom/status` | `src/data/tomtomTiles.js:4`, `src/data/flowTiles.js:8,135`, `src/data/traffic.js:25,195,1236,1284,1293` | **`TOMTOM_API_KEY`** |
| `/api/overpass` | `src/locations.js:867`, `src/data/traffic.js:45`, `src/annotations/annotationResolver.js:820` | none |
| `/api/route` | `src/annotations/annotationEngine.js:1094` | none |
| `/api/military-installations` | `src/data/militaryInstallations.js:422`, `src/data/militaryInstallationData.js:3` | none (Overpass) |
| `/api/google/nearby-places` | `src/voice/gevActions.js:3054` | **`GOOGLE_MAPS_API_KEY`** (metered) |
| `/api/google/text-search` | `src/data/militaryInstallations.js:449`, `src/annotations/annotationResolver.js:665,687` | **`GOOGLE_MAPS_API_KEY`** (metered) |
| `/api/regional-brief` | `src/data/regionalBrief.js:128` | none (Nominatim + news) |
| `/api/weather-effects` | `src/cockpitCloudEffects.js:375` | none (Open-Meteo) |
| `/api/terrain/heights` | `src/data/terrainHeights.js:33,90,102,146`; `src/data/cctv.js:2217` | none (Re:Earth) |
| `/api/cctv/{sources,frame,health,media}` | `src/data/cctv.js:106-109` | none |
| `/api/radio/{stations,click/:id}` | `src/data/radio.js:5,37,1763` | none |
| `/api/gbfs/` | `src/data/bikeshare.js:528` | none |
| `/api/realtime/token` | `src/voice/gevRealtime.js:13`, `src/voice/voiceCost.js:8` | **`OPENAI_API_KEY`** (mints ephemeral token) |
| `/api/openai/hud-summary` | `src/hud.js:37` | **`OPENAI_API_KEY`** (metered) |
| `/api/realtime/debug-log` | `src/voice/gevRealtime.js:35` | none (local logging) |

**Direct browser→internet fetches that bypass the proxy entirely:**

| Target | Call site | Note |
|---|---|---|
| `earthquake.usgs.gov` | `src/data/earthquakes.js:28` | Keyless, public domain — fine as-is |
| `maps.googleapis.com` | `src/locations.js:359`; `src/annotations/annotationResolver.js:613`; `src/voice/gevActions.js:1271,2945` | **Uses `window.__GOOGLE_MAPS_API_KEY__` from the browser — metered, key-exposed** |
| `tile.openstreetmap.org` | `src/mapStackController.js:261` | OSM tile stack |
| `terrain.reearth.land` | `src/mapStackController.js:45`; `src/data/terrainHeightsProxy.js:97` | Keyless terrain |
| `gbfs.*` (9 operators) | `src/data/bikeshare.js:84-238` | Feed URLs; fetched via `/api/gbfs/` |

### 6.3 What the proxy layer does well (worth porting)

Genuinely careful engineering that our Worker should inherit rather than reinvent:

- **SSRF defence.** `/api/radio/*` allowlists Radio Browser hosts, rejects redirects, resolves DNS and **rejects loopback/private/link-local/metadata addresses**, and pins TLS to the validated address (`node:dns/promises` + `node:https`). CCTV fetches only server-registered URLs — clients cannot supply an upstream URL.
- **Response-size caps** on every attacker-influenced upstream (`readResponseTextCapped` / `readResponseJsonCapped`, `vite.config.js:680,717`), e.g. Overpass 32 MB, adsb.lol 8 MB, radio 4 MB.
- **Request coalescing** — `coalesceProxyRequest` (`:725`) collapses concurrent identical upstream calls.
- **Overpass QL sanitiser** (`:493-660`) — bounds `timeout`, `around` radius (50 km) and bbox (12°), and validates element selectors before forwarding.
- **Nominatim serial queue** — `_nominatimQueue` enforces the ≤1 req/s usage policy.
- **Provider cache windows** — FIRMS 30 min (24 h hard staleness ceiling), TomTom 120 s, Overpass 24 h memory / 7 d disk (30 d for boundaries), Launch Library 2 disk-cached, OpenSky ~9 s with adaptive TTL against remaining credits.
- **Never caches or relays audio** — explicit Radio Browser compliance.
- **Redacted debug logs** — strips keys, bearer tokens and data URLs.

### 6.4 What will not port to Cloudflare Workers

| Construct | Where | Why it breaks |
|---|---|---|
| `node:fs` disk caches under `.gev-cache/` | Overpass `:174`, FIRMS `:1979`, TomTom `:1750`, Launch Library `:1615`, adsbdb `:2333`, terrain `:2185` | **No filesystem on Workers.** Must become KV / Cache API / R2. |
| `node:https` + `node:dns/promises` TLS pinning | radio SSRF guard | Not available; Workers use `fetch` only. Needs a different SSRF strategy. |
| Long-lived AISStream **WebSocket** held by the server | `vite.config.js:6232` | Workers are request-scoped. Needs **Durable Objects** — a real architectural decision, see §11. |
| In-memory `Map` rate limiters + caches | `makeRateLimiter` `:398`; all `_*Cache` maps | Per-isolate and ephemeral. Global limits need KV/DO. |
| `_nominatimQueue` serial promise chain | regional-brief | Cannot serialise across isolates. |
| TomTom daily budget counter in `budget.json` | `:1736` | Needs durable storage. |
| **`clientKey()` uses `req.socket.remoteAddress` and *deliberately ignores* `X-Forwarded-For`** | `:488-491` | Correct for localhost; **wrong behind Cloudflare** — every request would appear to come from the edge and collapse into a single rate-limit bucket. Our Worker must use `CF-Connecting-IP`. |

---

## 7. Environment variables & key handling

### 7.1 The variables (from `.env.example`, 130 lines — unusually well documented)

| Variable | Required | Exposure | Purpose |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | **Yes** — boot throws without it | **CLIENT (bundled)** | 3D Tiles, Places, Geocoding |
| `CESIUM_ION_TOKEN` | No | **CLIENT (bundled)** | Bing imagery stacks, Cesium World Terrain |
| `OPENAI_API_KEY` | No | Server | Realtime voice + HUD summary |
| `OPENAI_REALTIME_MODEL` / `_MINI` / `_VOICE` / `_REASONING_EFFORT` / `_CONTEXT_TOKENS` / `_CONTEXT_RETENTION` | No | Server | Voice tuning |
| `OPENAI_HUD_SUMMARY_MODEL` | No | Server | default `gpt-5-nano` |
| `AISSTREAM_API_KEY` (+ `AISSTREAM_BOUNDING_BOXES`, `_MESSAGE_TYPES`, `_SILENCE_TIMEOUT_MS`) | No | Server | AIS websocket |
| `FIRMS_MAP_KEY` | No | Server | NASA FIRMS fires |
| `TOMTOM_API_KEY`, `TOMTOM_DAILY_TILE_BUDGET` | No | Server | Traffic (**only daily budget in the codebase**) |
| `OPENSKY_AUTH_MODE` / `_CLIENT_ID` / `_CLIENT_SECRET` / `_CREDENTIALS_FILE` | No | Server | OpenSky auth (`oauth`\|`basic`\|`auto`\|`anon`) |
| `GEV_RATELIMIT_OPENAI_PER_MIN`, `GEV_RATELIMIT_GOOGLE_PER_MIN` | No | Server | **Opt-in, unlimited by default** |
| `VITE_AIS_LIVE_API_URL`, `_MAX_ROWS`, `_LABEL_MAX_ROWS` | No | Client (`VITE_` prefix) | AIS client caps |
| `HOST`, `PORT` | No | — | Binding; `localhost`/`4173` default |
| `CCTV_*` (9 vars) | No | Server/flags | Camera source-pack tuning |

`.env` is gitignored upstream; only `.env.example` with placeholders is tracked. **No secrets are committed in the repo** — verified.

### 7.2 The cost-control gap (most important finding in this section)

```js
// vite.config.js:439
function makeOptInRateLimiter(envValue) {
  const max = Number(envValue);
  if (!Number.isFinite(max) || max <= 0) return null; // unset/0/garbage -> unlimited
  ...
}
```

- **Default is unlimited** for both Google and OpenAI cost endpoints.
- Even when enabled it is per-IP, per-minute, in-memory, and resets on restart.
- `SECURITY.md` and `.env.example` both state plainly: *"it is **NOT** a billing cap."*
- **There is no daily budget cap for Google or OpenAI anywhere in the codebase.** Only TomTom has one.
- Upstream's answer is "set provider-side budgets in the Google Cloud / OpenAI console" — reasonable for a self-hosted tinkerer's tool, **insufficient for a public product**.

This is precisely the gap master plan §6.6 and §13 require the Worker to close. Concrete proposals belong in 0.3.

---

## 8. Build/deploy assumptions & what blocks static hosting

**Upstream's assumption, stated in `SECURITY.md`:** *"The Vite server is a **development/preview** server. If you expose it beyond localhost, put it behind your own auth/proxy."* GEV is designed to be **run locally by its operator**, not deployed. There is no Dockerfile, no `netlify.toml`/`vercel.json`, no CI deploy workflow, no hosting documentation.

**Blockers to pure static hosting, in priority order:**

1. **No deployable backend.** 24 `/api/*` endpoints exist only as Vite middleware. On a static host they 404 or (with SPA fallback) return HTML — the silent failure demonstrated in §5.4. **Affected layers:** flights, military flights, satellites, launches, fires, ships, traffic, CCTV, radio, bikeshare, military installations, terrain heights, regional brief, weather effects, and all AI endpoints. Only **earthquakes** (direct USGS), the bundled local datasets, and the OSM/Re:Earth map stacks survive unaided.
2. **`GOOGLE_MAPS_API_KEY` is compiled into the bundle** (`vite.config.js:7370`, confirmed 4× in `dist/`), and separately parked on `window` (`main.js:90`). On a public host the only protection is Google Cloud referrer restriction — bypassable by spoofed `Referer`, and no defence against quota burn from our own traffic.
3. **Filesystem-backed caches** (`.gev-cache/`) have no equivalent on a static host or on Workers.
4. **The AISStream WebSocket** requires a persistent server connection.
5. **A metered Google Places call fires on every page load** (§5.3) with no daily cap.
6. **Node ≥ 24.14 build requirement** — fine on Cloudflare Pages (configurable), but this machine defaults to **Node v18.19.1**. Local work needs `nvm use 24`. *(For 0.4 I will pin this via `.nvmrc` + CI `node-version`.)*
7. **Bundle scale** — 28 MB `dist/`, ~4 MB gzip of eager JS/data. Within Cloudflare Pages limits, but far outside master plan §14 budgets.
8. **SEO-hostile** — a single client-rendered route, exactly as the plan §3.9 anticipated. Confirmed: `index.html` contains UI chrome but no indexable content.

**Encouraging:** `vite build` itself is clean, fast (5.5 s), needs no network, and emits a self-contained static tree. **Cloudflare Pages can serve `dist/` as-is** — the work is entirely about supplying `/api/*` from a Worker and removing the key from the bundle.

---

## 9. Where the master plan §3 differs from reality

Recorded so the plan can be corrected. **None of these invalidate the strategy** — several make Stage 0 *easier*.

| Plan §3 says | Actually | Impact |
|---|---|---|
| "~13 live layers" | **16** registered layers | Minor; update §3.4/§4 tables |
| Project structure ≈ 8 dirs, modest | **144 source modules, 92.7k LOC**, `vite.config.js` alone 7,383 lines | **Significant** — sizing for Stages 1/4 |
| "a small server component for key brokering" | **Not a server** — Vite middleware; 19 plugins, 24 endpoints, 10 of them dev-only | **Significant** — this is the Stage 0 headline |
| "GEV *already* assumes a small server-side proxy… which validates our serverless-proxy decision" | Direction is right, but **nothing is reusable as-is** — Node builtins, disk caches, a WebSocket, and `X-Forwarded-For` deliberately ignored | Worker is a **rewrite guided by** GEV's logic, not a port |
| Rate-limit knobs `GEV_RATELIMIT_*` imply cost control | **Opt-in, unlimited by default, explicitly not billing caps**; no daily cap for Google/OpenAI | **Significant** — cost risk larger than assumed |
| "Cold start ~1.86 s **[VERIFIED per README]**" | Unverified here. Dev-mode `load` = **7.73 s**; production+real-key number not yet measured | Re-baseline in Stage 1 |
| Dams "704, OSM/ODbL" | `DATA_SOURCES.md` says OpenInfraMap/OSM extract; the layer's UI `source:` label says **`'USACE'`** (`localLayers.js:31`) | Small provenance inconsistency — **0.2 must resolve which is correct** |
| Google News RSS is a source to replace | Confirmed, and **narrower than feared**: RSS is primary with **GDELT already implemented as fallback** in the same function | **Easier than planned** |
| OpenSky → adsb.lol swap | **Much easier** — `src/data/adsbLolFallback.js` already normalises adsb.lol into OpenSky's state-vector shape, and `/api/opensky` already falls back to a 250 nm adsb.lol snapshot with `X-Flight-Source` / `X-Flight-Coverage` headers | **Easier than planned** |
| Voice AI "~28 tools" | **Exactly 28** — verified | Plan correct |
| "OpenAI, AISStream, TomTom brokered server-side" | Correct, plus FIRMS and OpenSky OAuth | Plan correct |

---

## 10. Class-D code paths (evidence for task 0.2)

Located and verified. Full licence analysis and the removal diff are **0.2 / 0.3 deliverables** — this is the map.

**a) TeleGeography submarine cables** — *smaller footprint than feared*
- Data: `src/data/local_data/telegeography_submarine_cables/` — `cable-geo.json` (728 KB), `landing-point-geo.json` (359 KB), `README.md`, `source.json`
- Layer module: `src/data/telegeographySubmarineCables.js` (45 KB, 1,043 lines)
- Registration: `src/data/localLayers.js:3` (import), `:50` (export array)
- Layer state: `src/data/layerState.js:292`
- Attribution: `src/data/dataCredits.js:172`
- Voice tool surface: `src/voice/gevActions.js:173-175`, `:3270`; enum entries in `vite.config.js:5157, 5643, 5657, 5688, 5790`
- ⚠️ **One non-obvious coupling:** `src/overlays/worldOverlayAllocation.worker.mjs:68-73` imports `CABLE_OVERLAY_COLLISION_CAPACITY`, `CABLE_OVERLAY_SOURCE_ID`, `CABLE_REFERENCE_LABEL_WINNER_CAP`, `createCableOverlayEntry`, and uses them at `:833, 836, 910-922`. **Despite the `.worker.mjs` name this is a Node benchmark harness** (it reads `process.env.GEV_ALLOC_PROFILE`), not a browser worker — it never loads in the browser (absent from the boot network trace). Its `submarine-cables` profile and the matching perf test must be removed alongside the layer.
- Ships in production build: **yes** — `dist/assets/cable-geo-*.json` + `landing-point-geo-*.json`

**b) OpenSky** — *swap already scaffolded*
- Proxy: `vite.config.js:2894-3246` (`openSkyProxy`), constants `:88-140`
- Client: `src/data/flights.js:273` (`API_URL = '/api/opensky'`), `:3049` (`/api/opensky-track`)
- Attribution: `src/data/dataCredits.js:35`
- Env: `OPENSKY_AUTH_MODE`, `OPENSKY_CLIENT_ID/SECRET`, `OPENSKY_CREDENTIALS_FILE`
- ⚠️ **Works fully anonymously** — verified: `/api/opensky` returned live global states with no credentials. Easy to keep using by accident; removal must be deliberate.
- ✅ **Replacement path exists:** `src/data/adsbLolFallback.js` (`normalizeAdsbLolAircraftState`, `normalizeAdsbLolPointResponse`) already emits OpenSky-shaped vectors; `serveAdsbLolPointFallback` (`vite.config.js:2863-2879`) already serves them with `X-Flight-Source: adsb.lol` and `X-Flight-Coverage: 250nm regional fallback`. **The plan's required "regional, not global-complete" UI caveat can be driven straight from that existing header.**

**c) Google News RSS** — *a ~30-line change in one function*
- `vite.config.js:7044-7079` — `fetchRegionalNews()`: Google News RSS is tried **first** (`:7054`), GDELT DOC 2.0 is the `catch` fallback (`:7070`)
- Helpers to remove: `decodeRssText` (`:6980`), `rssTag` (`:6988`), `normalizeRssArticles` (`:6992`)
- Client: `src/data/regionalBrief.js:128` via `/api/regional-brief`
- Attribution: `src/data/dataCredits.js` (GDELT `:108`)
- **Fix = delete the RSS branch, promote GDELT to primary, drop `'GDELT fallback'` → `'GDELT'` in the source label.**

**Class-E to flag (0.2):** AISStream (`vite.config.js` ais-live-proxy + WebSocket `:6232`; `src/data/aisLiveVessels.js`) · CCTV per-city (`vite.config.js:4492+`; `src/data/cctv.js`, 198 KB; `config/cctv_sources.*.json`).

---

## 11. Open questions — I need your decisions

1. **Fork, vendor, or rebuild?** The upstream clone is currently *gitignored*, not committed — I did not want to make that call for you. Three options: (a) **fork on GitHub** and keep an `upstream` remote for merges, (b) **vendor** `dist`-relevant source into our repo and cut ties, (c) **new repo, import selectively**. This affects everything downstream. My lean is **(a) fork** — it preserves MIT attribution cleanly and keeps upstream fixes mergeable — but the divergence we are planning is large, so it is genuinely your call.
2. **The AISStream WebSocket.** Ships are P2 and gated on ToS anyway, but the architecture question is real: a persistent WebSocket needs **Cloudflare Durable Objects**, which is a step beyond the "thin stateless Worker" the plan assumes. Confirm ships stay **out** of Stage 1 so I can design the Worker as purely request-scoped?
3. **Do you have, or want to obtain, a Google Maps API key for Stage 0?** Without one I cannot verify 3D Tiles rendering, real cold-start timings, or the tile-request volume that drives the §6.6 cost model. I can complete 0.2–0.4 without it, but the Stage 1 perf baseline will be guesswork until we have one. *(If you do get one: restrict it to the Map Tiles API + HTTP referrer, and set a Google Cloud billing budget before it is ever used.)*
4. **`npm audit` posture.** 9 high-severity advisories, all dev-side. Non-breaking fixes clear 4. The other 2 need major bumps (`puppeteer@25`, `sharp@0.35`) which our rules forbid without your approval. Want the non-breaking `npm audit fix` folded into 0.3, and the majors deferred?
5. **Dams provenance.** `DATA_SOURCES.md` says OpenInfraMap/OSM (ODbL); the layer's UI label says `USACE` (US public domain). These imply *different licences*. I will resolve it in 0.2, but flagging now since it touches attribution correctness.

---

## 12. Reproducing this inspection

```bash
cd /home/austrom/Projects/VS_Projects/eyeofatlas/gods-eye-view-upstream
nvm use 24                 # system default is v18 and will NOT satisfy engines
npm install
npm test                   # 2,602 tests, ~2m11s
npm run build              # → dist/, ~5.5s
npm run dev                # → http://localhost:4173
```

A ready-made preview config exists at `../.claude/launch.json` (`gev-dev`) which handles the `nvm use 24` step automatically.

**Local state created during this task, all gitignored or outside the repo:**
- `gods-eye-view-upstream/.env` — contains only `GOOGLE_MAPS_API_KEY=PLACEHOLDER_NOT_A_REAL_KEY`. **No real credentials exist on this machine for this project.**
- `gods-eye-view-upstream/node_modules/`, `dist/`, `.gev-cache/`, `.gev-logs/`
- `/home/austrom/Projects/VS_Projects/.claude/launch.json` — dev-server preview config

**No file in the upstream clone was modified.** `git status` in that checkout shows only untracked build/env artefacts.
