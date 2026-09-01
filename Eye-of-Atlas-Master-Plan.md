# Eye of Atlas — Master Development & Growth Plan

> **Eye of Atlas — The world. Right now.**
> An interactive, AI-powered window into what is happening around Earth right now.

**Document status:** v1.0 · Prepared 31 August 2026
**Audience:** Project owner (human supervisor) + Claude Code (implementation agent) + future project documentation
**Source foundation:** [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT, ~14.2k★ at time of audit)

---

## 0. How to read this document

This is the single source of truth for building Eye of Atlas. It is written to be handed **directly to Claude Code**, stage by stage. The companion PDF (`Eye-of-Atlas-Master-Plan.pdf`) is the executive/strategic summary; **this Markdown file holds the full implementation detail** and is authoritative where the two differ.

**Verified vs. recommended.** Throughout, claims are tagged:
- **[VERIFIED]** — confirmed against the actual GitHub repo, official docs, or provider terms (sources listed in §24).
- **[RECOMMENDATION]** — the author's engineering/strategy judgment, to be validated.
- **[ASSUMPTION]** — a decision made to move forward; flagged so it can be overturned.

**Confirmed scope decisions** (from project owner, made before drafting):
1. **Ask Atlas v1 is text-only, powered by Google Gemini's free tier** via a serverless proxy. The original's OpenAI Realtime *voice* is dropped from v1 (revisit as BYOK/premium later).
2. **"No backend database" is interpreted as: static frontend + a minimal serverless key-proxy** (Cloudflare Workers free tier) for secrets that cannot be exposed in a browser. No database, no persistent server storage.
3. The PDF is **executive + strategic depth**; granular Claude Code tasks live here.

**The one question this plan answers:** *With Claude Code doing most of the build, ~$0 infrastructure budget, and the goal of a public ad-supported product — what is the smartest sequence of work that maximises the odds of building something people actually use and share?*

The answer, in one line: **Ship a small, fast, beautiful, commercially-clean live-Earth globe on free static hosting; make every interesting moment one tap to share; wrap it in real SEO landing pages that give both Google and AdSense something to index; add a cheap, data-grounded Ask Atlas as the differentiator — and let organic discovery, not spend, drive growth.**

---

## 1. Executive summary

Eye of Atlas is a browser-based, photorealistic 3D globe that shows **live planetary activity** — flights, ships, satellites, earthquakes, wildfires, weather — and lets anyone **ask questions about it in plain language** and **share the exact view** they are looking at. It is built on the open-source God's Eye View (GEV) foundation but is deliberately **not a clone**: GEV is a "spy-satellite simulator" aimed at builders and tinkerers; Eye of Atlas is a **friendly, shareable, SEO-discoverable consumer product** with a sustainable ad-supported path.

The strategy rests on seven load-bearing choices:

1. **Commercial-clean data only.** GEV bundles and calls several sources that are *not* licensed for a monetised product (OpenSky's non-commercial terms, TeleGeography submarine cables under CC BY-NC-SA, Google News RSS). These are removed or replaced **before** any ads run. This is the single biggest legal risk and is handled first (Stage 0).
2. **No database, near-zero infra.** Static frontend on Cloudflare Pages (unlimited bandwidth, commercial use allowed) + thin Cloudflare Workers proxies only for keys that can't be exposed. Everything else is browser-side fetching of public APIs.
3. **Shareability is a core feature, not an afterthought.** View state (location, camera, layers, selection, time) is encoded into the URL so any view reproduces without a server record — the engine of organic growth.
4. **SEO as distribution.** A structured set of `/live/*`, `/earthquakes/*`, `/flights/*` etc. landing pages, each genuinely useful (live summary + explainer + interactive globe), turns the product into thousands of search entry points — and gives AdSense real content to approve.
5. **Ask Atlas is data-grounded, cheap, and optional.** It reads *filtered, aggregated* context (never raw 10k-record dumps), returns structured map actions the frontend executes, runs on Gemini's free tier, and **degrades gracefully** — the globe works fully when AI is off.
6. **Ads without wrecking UX.** Ads live on SEO/content pages and non-intrusive panel slots, never over the globe; ad-free becomes a later premium option, not an MVP concern.
7. **Ship-learn-grow, not build-big.** Two tracks: **Track A ($0 launch)** is everything above; **Track B (after traction)** adds paid data, caching, better AI, and possibly native apps — and is deliberately *not* architected in up front.

**Highest-probability path to "people use and share it":** a fast globe + earthquakes + flights + fires + satellites (the visually strongest, most licence-clean, most searched layers), instant shareable views, 8–12 excellent SEO landing pages, a lightweight Ask Atlas, and disciplined community launches (Show HN, relevant subreddits, short-form video). Everything else is deferred.

---

## 2. Product vision & positioning

### 2.1 Positioning statement
> **Eye of Atlas is an interactive, AI-powered window into what's happening around Earth right now — beautiful enough to lose yourself in, simple enough for anyone, and shareable in one tap.**

### 2.2 The transformation
From *"a cool 3D globe"* → to *"an intelligent interface for exploring what is happening around Earth right now."* The globe is the canvas; **live data + AI + discovery + sharing** is the product.

### 2.3 Who it's for (in priority order)
1. **Curious general public** — people who land from search ("earthquakes today", "flights over me") or a shared link, stay because it's mesmerising, and share because it's easy.
2. **Enthusiast communities** — aviation, space/satellites, GIS/maps, data-viz, disaster-watchers — the early amplifiers.
3. **Educators & students** — a free, safe, real-data teaching tool.

### 2.4 Brand personality
Modern, intelligent, visually impressive, trustworthy, technically sophisticated **but accessible**. The Atlas myth (a Titan bearing the world) informs the name and a restrained visual identity — **not** a mythological gimmick. Tone: calm, factual, awe-inspiring. Think "planetary observation deck," not "spy thriller."

### 2.5 Why someone chooses Eye of Atlas over the alternatives
Existing tools each own one slice — FlightRadar24 (flights), MarineTraffic (ships), Windy/Zoom Earth (weather), USGS/earthquake maps (quakes), Heavens-Above/satellite trackers (space). They are powerful but **siloed, dense, and expert-oriented**. Eye of Atlas wins on **breadth on one beautiful globe + plain-language AI + effortless sharing + discovery** ("show me something interesting right now"). It is the **generalist explorer's** entry point, not the specialist's dashboard. (Full competitor analysis: §21.)

### 2.6 Non-goals (guardrails against scope creep)
- Not a safety/operational/navigation system (see §22 disclaimers).
- Not a person-tracking or surveillance tool — **inherit GEV's ethical stance** (no named-person search, no face recognition, no individual tracking). This is both ethically right and brand-protective. **[VERIFIED]** GEV states this explicitly.
- Not a data marketplace, not a social network (in v1).

---

## 3. Repository audit — God's Eye View (the foundation)

*All items in this section are [VERIFIED] against the repo and its `README.md` / `DATA_SOURCES.md` unless noted.*

### 3.1 What it is
A single-page web app: a photorealistic 3D globe (Google Photorealistic 3D Tiles rendered via **CesiumJS**) overlaid with ~13 live data layers, a tactical HUD, cinematic "scene director," and an AI voice interface (OpenAI Realtime API with ~28 tools). Tagline: *"A spy satellite simulator in your browser, except the data is real."* MIT-licensed, ~14.2k★ / ~2.8k forks at audit.

### 3.2 Technology stack
- **Rendering:** CesiumJS + Google Photorealistic 3D Tiles (planet surface); Bing/OSM map stacks switchable.
- **Language/framework:** **Vanilla JavaScript** — no React/Vue/Svelte. Modular ES modules.
- **Build system:** **Vite** (bundling, dev server, HMR).
- **Runtime:** Node.js 24.14.x or 26.x (enforced in `package.json`); npm.
- **AI:** OpenAI Realtime API (voice + HUD scene summaries), ~28 registered "tools."
- **Key handling:** local-first; secret-bearing providers (OpenAI, AISStream, TomTom) are **brokered server-side**; only Google Maps + Cesium ion creds reach the browser. **[VERIFIED]** — important: GEV *already* assumes a small server-side proxy for secrets, which validates our serverless-proxy decision.

### 3.3 Project structure (as documented)
```
src/
├── main.js                # Bootstrap, Google 3D tiles, layer registration
├── ui.js                  # Runtime UI panels, HUD, styles
├── hud.js                 # Intelligence HUD + AI scene summary
├── mapStackController.js  # Map layer switching (Google/Bing/OSM)
├── iconOrientation.js     # Screen-projected heading rendering
├── voice/                 # OpenAI Realtime session + 28 tools
├── data/                  # Layer modules, management, context store
│   └── local_data/        # Bundled datasets w/ source provenance
└── scenes/                # Cinematic scene director
config/  docs/  public/  scripts/  tools/
```
Docs present: `README.md`, `CONTRIBUTING.md`, `DATA_SOURCES.md`, `SECURITY.md`.

### 3.4 Data ingestion & layers (13 live)
- **No auth:** OpenSky (flights), adsb.lol (military/ADS-B), CelesTrak (satellite TLEs), USGS (earthquakes), city CCTV (Austin/Caltrans/TfL), Radio Browser, GBFS (bikeshare), Launch Library 2, OSM/Overpass/Nominatim, Open-Meteo (weather), GDELT/Google News.
- **Free key (signup):** AISStream (ships), NASA FIRMS (fires), TomTom (traffic), Cesium ion (Bing imagery), OpenSky authenticated (higher limits).
- **Metered billing:** **Google Maps Tiles API** (~free first 1,000/mo, then ~$6/1,000 — the 3D planet), **OpenAI API** (voice/HUD, usage-metered, in-app $5 session cap).

Bundled static datasets: datacenters (~4.3k, OSM/ODbL), dams (704, OSM/ODbL), **TeleGeography submarine cables (712 + 1,917 landing pts, CC BY-NC-SA — non-commercial)**, Natural Earth regions (public domain), DataSF neighborhoods (PDDL).

### 3.5 Environment variables
`GOOGLE_MAPS_API_KEY` (required), `OPENAI_API_KEY` (optional), `AISSTREAM_API_KEY`, `FIRMS_API_KEY`/`FIRMS_MAP_KEY`, `TOMTOM_API_KEY` (optional), plus rate-limit knobs `GEV_RATELIMIT_OPENAI_PER_MIN`, `GEV_RATELIMIT_GOOGLE_PER_MIN`. Sourced from `.env` / `.env.example`; macOS `scripts/dev-fresh.sh` pulls from Keychain.

### 3.6 Deployment assumptions
Vite build → static assets **plus a small server component** for key brokering and proxy rate-limiting (implied by server-side secret handling, TomTom "server-side proxy 120s cache," and per-minute rate-limit env vars). It is **not** a pure static site today; it expects a Node runtime for the proxy layer.

### 3.7 Existing features
Live globe; flights/ships/satellites/quakes/fires/traffic/CCTV/radio/bikeshare/launches; HUD with AI scene summary; voice control; cinematic scenes; map-stack switching; local info (weather/news/reverse-geocode); terrain; LAN sharing (opt-in, with security warnings).

### 3.8 Performance profile
- Cold start ~1.86s median on recent hardware **[VERIFIED per README]**.
- Heavy by nature: Google 3D Tiles streaming + many live entities + frequent polling = high GPU/network load, especially mobile/low-end. No published mobile benchmarks; **[ASSUMPTION]** mobile perf is a real risk needing our own budgets (§14).

### 3.9 Known limitations (stated or evident)
- Explicitly **not for operational/safety use** (data may be delayed/modeled/wrong). **[VERIFIED]**
- Several data sources **incompatible with commercial monetisation** (see §4).
- Google 3D Tiles + OpenAI are **metered costs** that scale with traffic — dangerous for a free ad-supported product without hard caps.
- Vanilla-JS SPA → **SEO-hostile by default** (client-rendered, one URL). Our SEO strategy (§8) must add real routes/pre-rendered pages.
- Mobile behaviour/perf under-specified.

### 3.10 What we keep, change, drop
- **Keep:** CesiumJS core, layer module pattern, `DATA_SOURCES.md` provenance discipline, ethical guardrails, the visual quality, the "context store" idea (feeds Ask Atlas).
- **Change:** replace voice AI with text Ask Atlas (Gemini); add SEO routes + share system + OG images; retune performance for mobile; formalise the serverless proxy on Cloudflare.
- **Drop for commercial launch:** OpenSky (non-commercial) → rely on adsb.lol/ADS-B; TeleGeography cables (NC) → remove; Google News RSS → GDELT; anything else flagged in §4-D.

---

## 4. Licensing & data-source commercial audit  ⚠️ highest priority

**Bottom line:** GEV's own `DATA_SOURCES.md` is unusually honest and does much of this work — but it is a *starting point, not legal clearance.* **[VERIFIED]** items reflect the repo's stated terms; commercial deployment still requires the owner to confirm current provider terms and, where flagged, obtain legal review. **Nothing here is legal advice.**

Two cross-cutting issues to internalise:
- **ODbL "share-alike."** adsb.lol, OSM/Overpass/Nominatim, and the datacenter/dam bundles are **ODbL 1.0**: commercial use is fine **with attribution**, but ODbL has a **share-alike obligation on *derived databases***. Displaying the data in an app is fine; if you *produce and publish a modified database* from it, that derivative may need to be shared under ODbL. **[FLAG — legal review]** Practically: attribute properly, don't republish enriched datasets as your own product, and you're almost certainly fine — but confirm.
- **"No caching" clauses.** Google Maps content **may not be cached/stored/rehosted**; Radio Browser audio must never be proxied/cached/redistributed. These constrain how the serverless proxy may behave.

### 4.1 Classification table

| Source | Data | License / terms | Commercial? | Class | Attribution | Notes / action |
|---|---|---|---|---|---|---|
| **USGS Earthquakes** | Quakes | US public domain | ✅ Yes | **A Safe** | "Data courtesy of USGS" (courtesy) | Ideal MVP layer. |
| **NASA FIRMS** | Wildfires | CC0 / US public domain | ✅ Yes | **A Safe** | Credit NASA FIRMS | Needs free `FIRMS_MAP_KEY`; proxy it. Cache 30m OK. |
| **CelesTrak** | Satellite TLEs | US-gov origin, no license | ✅ Yes | **A Safe** | Cite CelesTrak / T.S. Kelso | Compute SGP4 client-side. Ideal MVP layer. |
| **Natural Earth** | Base vectors/regions | Public domain | ✅ Yes | **A Safe** | "Made with Natural Earth" (courtesy) | Keep bundled. |
| **DataSF neighborhoods** | SF polygons | PDDL 1.0 (PD) | ✅ Yes | **A Safe** | Courtesy | Niche; optional. |
| **Launch Library 2** | Launches | "use/share any form" | ✅ Yes | **A Safe** | Encouraged | 15 calls/hr unauth → cache 15m; token for more. |
| **GDELT DOC 2.0** | News headlines | Unrestricted incl. commercial | ✅ Yes | **A Safe** | Cite GDELT + publisher | **Replacement for Google News RSS.** |
| **Open-Meteo** | Weather | CC BY 4.0 | ✅ Yes | **B Attribution** | "Weather data by Open-Meteo.com" (linked) | Great free weather; attribute adjacent. |
| **adsb.lol** | Flights (incl. military), traces | ODbL 1.0 | ✅ Yes | **B Attribution + share-alike** | "adsb.lol contributors" | **Primary commercial flight source** (replaces OpenSky). Regional, not global-complete. |
| **OSM / Overpass / Nominatim** | Roads, geocode, POIs | ODbL 1.0 (+ Nominatim policy) | ✅ Yes | **B Attribution + share-alike** | "© OpenStreetMap contributors" | Nominatim: ≤1 req/s, must respect usage policy; heavy use → self-host/alt geocoder. |
| **Datacenters / Dams bundles** | Infra points | ODbL 1.0 | ✅ Yes | **B Attribution + share-alike** | © OSM (+ OpenInfraMap) | Keep w/ attribution; don't republish DB. |
| **Re:Earth Terrain (Mapterhorn)** | Terrain mesh | CC BY 4.0 (+ EGM2008 PD) | ✅ Yes | **B Attribution** | Credit Re:Earth/Mapterhorn | Keyless terrain option. |
| **Google Maps 3D Tiles / Places / Geocode** | 3D planet, search | Google Maps Platform ToS | ✅ Yes (BYO billing) | **C Conditional (paid + rules)** | Show Google logo (required) | **Metered cost**; **no caching/rehosting**; must keep Google attribution. Hard usage caps required. Consider Cesium World Terrain/OSM buildings or 2D-imagery fallback to cap spend. |
| **TomTom Traffic** | Congestion | TomTom Developer ToS | ✅ (BYOK, plan-dependent) | **C Conditional** | "© TomTom" | Optional; proxy w/ 120s cache; daily tile budget. Defer past MVP. |
| **AISStream.io** | Ships (AIS) | "Free beta, no formal ToS" | ⚠️ Unclear | **E Unclear — verify** | Courtesy | AIS is public broadcast, but *no formal ToS* = risk for a commercial product. **Confirm terms in writing** or use an alternative AIS provider before monetising ships. |
| **City CCTV — Austin / Caltrans / TfL** | Camera catalogs + frames | Per-city open-data terms | ⚠️ Mixed | **C/E Conditional** | Per city (TfL: "Powered by TfL Open Data…OS © Crown") | Each city's terms differ; TfL & OS Crown copyright have specific attribution. **CCTV also has UX/privacy optics** — recommend **cutting from MVP**. |
| **GBFS bikeshare** | Bike availability | Per-operator (attribution) | ⚠️ Per feed | **C Conditional** | Credit operator + license_url | Low value/high fiddliness → cut from MVP. |
| **Radio Browser** | Station directory | PDDL 1.0 (PD) | ✅ directory | **B/D** | Credit + broadcaster link | Directory PD, **but never proxy/cache/redistribute audio**; streaming third-party audio in an ad product is a rights minefield → **cut from MVP.** |
| **OpenSky Network** | Flights (global snapshot) | **Non-commercial research/education** | ❌ No | **D Unsuitable** | opensky-network.org | **Remove for monetised use.** Operational/commercial needs written OpenSky agreement. Replace with adsb.lol (regional) or a paid ADS-B feed (Track B). |
| **TeleGeography submarine cables** | Cables + landings | **CC BY-NC-SA 3.0** | ❌ No | **D Unsuitable** | © TeleGeography | **Delete this bundled folder before commercial launch** (repo warns of this explicitly). Alternative: none free+commercial; treat as Track B licensed feature or omit. |
| **Google News RSS** | Headlines | Personal/noncommercial only | ❌ No | **D Unsuitable** | — | **Replace with GDELT** (already the repo's fallback). |
| **Cesium ion (Bing imagery)** | Imagery | Cesium ion ToS (free tier) | ⚠️ Tier-limited | **C Conditional** | Per Cesium ion | Free tier has quota; fine for MVP base imagery; watch limits. |

### 4.2 Summary by class
- **A — Safe to reuse commercially:** USGS, NASA FIRMS, CelesTrak, Natural Earth, DataSF, Launch Library 2, GDELT.
- **B — Reusable with attribution (some ODbL share-alike):** Open-Meteo, adsb.lol, OSM/Overpass/Nominatim, datacenters/dams, Re:Earth Terrain.
- **C — Reusable only under conditions (paid/BYOK/quota/per-feed):** Google Maps 3D Tiles/Places, TomTom, Cesium ion, GBFS, some CCTV.
- **D — Unsuitable for monetised deployment (remove/replace):** OpenSky, TeleGeography cables, Google News RSS.
- **E — Unclear, requires verification/licensing:** AISStream (no formal ToS), some CCTV.

### 4.3 Mandatory **Commercial Data Source Cleanup Stage** (blocks monetisation)
Before *any* ads run, Claude Code must, as a discrete gated task (part of Stage 0/pre-launch):
1. **Remove** the TeleGeography `telegeography_submarine_cables/` folder and any code paths that load it.
2. **Remove/disable** the OpenSky layer as a *data source*; make adsb.lol the flight source; document the "regional, not global-complete" limitation in the UI.
3. **Replace** Google News RSS with GDELT everywhere.
4. **Cut from MVP** (UX/licensing/effort): CCTV, Radio audio, GBFS, TomTom traffic. (Re-add later only with confirmed terms.)
5. **Verify AISStream terms in writing** before enabling ships in a monetised build; otherwise ship-layer stays off or uses a confirmed alternative.
6. **Wire required attributions** for every remaining source into a persistent, visible **"Data & attributions"** UI (Google logo, © OpenStreetMap contributors, Open-Meteo link, adsb.lol, USGS, NASA FIRMS, CelesTrak, GDELT, etc.). Missing attribution is a licence breach.
7. **Enforce provider rules in the proxy:** no caching of Google tiles; Nominatim ≤1 req/s; FIRMS/Launch caches within stated windows; daily budget caps on all metered calls.
8. **Produce a `COMMERCIAL_COMPLIANCE.md`** recording each source, its class, the action taken, and the attribution string — the audit trail for AdSense/legal.

**[FLAG — legal review]** ODbL share-alike scope, AISStream absence of ToS, and per-city CCTV terms are the three items warranting a lawyer's eyes if the product grows.

---

## 5. MVP definition (Stage 1)

### 5.1 Design principle
The smallest version that is **genuinely compelling** — mesmerising in 5 seconds, useful in 30, shareable in one tap. Keep GEV's visual wow; drop everything that adds cost, licence risk, or complexity without proportional user value.

### 5.2 Feature priority matrix

| Feature | User value | Visual impact | Data reliability | Licence risk | API cost | Complexity | Perf impact | **MVP?** | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Interactive 3D globe (Cesium + tiles) | ★★★★★ | ★★★★★ | High | C (Google) | **Metered** | Med | High | ✅ | **P0** |
| 2D/low-cost imagery fallback | ★★★ | ★★★ | High | A/C | Low | Med | Low | ✅ | **P0** |
| Camera controls (fly-to, zoom, orbit) | ★★★★★ | ★★★★ | — | — | — | Low | Med | ✅ | **P0** |
| Location search (geocode) | ★★★★★ | ★★ | High | B | Free* | Low | Low | ✅ | **P0** |
| **Earthquakes (USGS)** | ★★★★★ | ★★★★ | High | **A** | Free | Low | Low | ✅ | **P0** |
| **Satellites (CelesTrak TLE)** | ★★★★ | ★★★★★ | High | **A** | Free | Med | Med | ✅ | **P0** |
| **Wildfires (NASA FIRMS)** | ★★★★ | ★★★★ | High | **A** | Free key | Low | Med | ✅ | **P1** |
| **Flights (adsb.lol)** | ★★★★★ | ★★★★★ | Med (regional) | **B** | Free | Med | **High** | ✅ | **P1** |
| Weather (Open-Meteo) | ★★★★ | ★★★ | High | B | Free | Low | Low | ✅ | **P1** |
| Info panels (click entity → details) | ★★★★★ | ★★★ | — | — | — | Med | Low | ✅ | **P0** |
| Layer controls | ★★★★★ | ★★ | — | — | — | Low | Low | ✅ | **P0** |
| **Share view (URL state)** | ★★★★★ | ★★ | — | — | Free | Med | Low | ✅ | **P0** |
| OG image / social preview | ★★★★ | ★★★ | — | — | Free/low | Med | Low | ✅ | **P1** |
| Responsive + mobile support | ★★★★★ | ★★★ | — | — | — | Med | — | ✅ | **P0** |
| Loading/error/empty states | ★★★★ | ★★ | — | — | — | Low | — | ✅ | **P0** |
| Attribution / legal / privacy pages | ★★★ (required) | ★ | — | — | — | Low | — | ✅ | **P0** |
| Analytics (privacy-friendly) | ★★★ | — | — | — | Free | Low | — | ✅ | **P1** |
| **Ask Atlas (text, Gemini)** | ★★★★★ (differentiator) | ★★★ | Med | — | Free tier | Med-High | Low | ✅ (thin v1) | **P1** |
| Ships (AISStream) | ★★★★ | ★★★★ | Med | **E** | Free key | Med | High | ⚠️ gated on ToS | P2 |
| Traffic (TomTom) | ★★★ | ★★★ | Med | C | Metered | Med | Med | ❌ | P2 |
| CCTV cameras | ★★ | ★★★ | Low | C/E | Free | High | Med | ❌ | P3 |
| Radio / bikeshare | ★ | ★ | Low | B/C | Free | Med | Low | ❌ | P3 |
| Submarine cables | ★★ | ★★★ | High | **D** | — | Low | Low | ❌ (NC) | — |
| Voice AI | ★★★ | ★★ | — | — | **Expensive** | High | Low | ❌ | P3/BYOK |
| Ads architecture | (business) | ★ | — | — | — | Med | Low | ✅ *(after UX/perf OK)* | **P1** |

\*Nominatim is free but rate-limited; heavy usage needs an alternative.

### 5.3 MVP layer set (final)
**P0 launch layers:** Globe + camera + search + **earthquakes** + **satellites** + info panels + layer controls + share + responsive + states + legal/attribution.
**P1 fast-follow (same stage if time allows):** **wildfires**, **flights (adsb.lol)**, **weather**, **Ask Atlas (thin)**, OG images, analytics, ad slots on content pages.
**Explicitly excluded from MVP:** ships (until ToS), traffic, CCTV, radio, bikeshare, submarine cables, voice.

Rationale: earthquakes + satellites are **licence-clean (Class A), cheap, visually striking, and highly searched** — the perfect risk-free core. Flights are the biggest "wow"/traffic magnet but carry the highest perf cost and only regional coverage on the free source, so they're P1 with heavy performance guardrails.

### 5.4 MVP completion criteria (measurable)
- Loads to interactive globe in **< 3s** on a mid-range laptop, **< 6s** on a mid-range 2023+ phone (cold, fast 4G).
- P0 layers render, update on their schedule, and can be toggled without jank (≥ 30 fps desktop, ≥ 24 fps mobile with mobile defaults).
- Any view is shareable via URL and **reproduces exactly** on another device.
- Zero Class-D sources present; all required attributions visible; privacy + legal pages live.
- Lighthouse: Performance ≥ 80 (desktop), Accessibility ≥ 90, Best-Practices ≥ 90 on the landing routes.
- Works with AI **disabled** (graceful degradation verified).

---

## 6. Architecture ($0 infrastructure strategy)

### 6.1 Guiding philosophy
**Static frontend + browser-side data fetching + free public APIs + a minimal serverless key-proxy. No database. No persistent server storage.** Serverless is used *only* where a secret can't be exposed or a provider rule (rate limit/cache) must be enforced.

### 6.2 High-level diagram
```
                    ┌─────────────────────────────────────────┐
                    │              Browser (SPA)                │
   Static assets ──▶│  CesiumJS globe · layers · UI · Ask Atlas │
   (Cloudflare      │  URL-encoded view state · client SGP4     │
    Pages CDN)      └───────┬───────────────┬──────────────────┘
                            │               │
     direct fetch (no key)  │               │  needs secret / rule enforcement
   ┌────────────────────────▼───┐   ┌───────▼──────────────────────────────┐
   │ USGS · CelesTrak · FIRMS*  │   │  Cloudflare Workers (thin proxy)      │
   │ Open-Meteo · adsb.lol ·    │   │  • Google 3D Tiles key broker         │
   │ GDELT · Overpass/Nominatim │   │  • FIRMS/AIS key broker               │
   └────────────────────────────┘   │  • Gemini proxy (rate-limit, no key   │
     *some via proxy for the key     │    in browser, abuse guard)          │
                                     │  • per-source budget caps + caching   │
                                     │    windows (never caches Google)      │
                                     └───────────────────────────────────────┘
   Pre-rendered SEO pages (/live/*, /earthquakes/*, …) served statically,
   hydrate into the same SPA. OG images generated at build or via Worker.
```

### 6.3 Frontend stack decision
- **Keep CesiumJS** (proven, matches GEV). **[RECOMMENDATION]**
- **Framework:** two viable options.
  - **Option A — Astro + island hydration (recommended).** Astro pre-renders the SEO routes to static HTML (great for §8) while mounting the Cesium SPA as a client island. Best SEO/perf story for a content-heavy static product.
  - **Option B — keep GEV's Vanilla-JS + Vite** and add a small static-page generator + route pre-render step. Lower migration risk, weaker SEO ergonomics.
  - **[RECOMMENDATION]** Start by getting GEV running as-is (Stage 0), then migrate the *shell/routing* to Astro in Stage 4 when SEO pages are built — don't rewrite the globe. Keep the Cesium/layer code largely intact.

### 6.4 Where a backend *is* genuinely required (and why it stays tiny)
| Need | Why browser-only fails | Cheapest viable | Postponable? | Free-tier limits |
|---|---|---|---|---|
| Google 3D Tiles key | Key would be stolen/abused; billing risk | Worker broker + referer/rate limits | No | CF Workers 100k req/day free |
| Gemini API key | Same; abuse → cost | Worker proxy w/ rate-limit + daily cap | Yes (AI is optional) | Same |
| FIRMS / AIS keys | Keys leak in browser | Worker broker | Ships: yes; fires: preferred | Same |
| OG image generation | Dynamic per-view images | Build-time for static routes; Worker (satori/resvg) for dynamic | Partly (start static) | Same |
| Provider rule enforcement (cache windows, budgets) | Can't trust client | Worker | No | Same |

**No database is needed for MVP.** All "state" is either in the URL (shares), the client (session), or the provider (live data). If we ever need saved user accounts/collections → that's **Track B** (and even then, prefer a free-tier KV/edge store over a relational DB).

### 6.5 Security-vs-backend tension (explicit)
We do **not** expose secret keys in the browser to avoid a backend. Google Maps + Gemini + FIRMS/AIS keys go through the Worker proxy, which also does origin checks, per-IP rate limiting, and hard daily budget caps so a scraper or abuse spike can't run up a bill. This is the *minimum* backend that keeps the product both cheap **and** safe.

### 6.6 Cost-control architecture for metered sources (critical)
- **Google 3D Tiles is the main cost risk.** Mitigations: (1) hard daily request cap in the Worker; (2) aggressive client-side tile reuse within Cesium's own cache (no rehosting); (3) a **2D/low-detail imagery fallback** (Cesium ion free imagery / OSM) that engages automatically when the daily 3D budget is near-exhausted or on low-end mobile; (4) idle-throttling of tile requests when the camera is static. Target: stay within Google's free 1,000 tile-loads/month *as long as possible*, then a small fixed monthly ceiling the owner sets.
- **Every metered/keyed call passes through a budget governor** in the Worker (per-source daily cap; returns cached/last-known or a graceful "layer paused" state when exceeded).

### 6.7 Track A vs Track B (architecture)
- **Track A ($0):** everything above. Static + Workers free tier + free APIs + no DB.
- **Track B (post-traction):** paid ADS-B/AIS feeds (global completeness), edge KV cache for hot SEO data, higher AI limits/better models, image-render service, possibly accounts (saved views/collections) on a free-tier edge store, native app wrapper. **Do not build Track B into the v1 architecture** beyond leaving clean seams (a `dataSource` interface, a `proxy` module, an `aiProvider` interface).

---

## 7. AI architecture — "Ask Atlas"

### 7.1 Concept
Ask Atlas is a **map-aware, data-aware assistant**, not "ChatGPT in a sidebar." It understands a question, pulls *only the relevant, pre-filtered* live context, answers in plain language, and can **return structured actions the frontend executes** (fly-to, select, toggle layer). v1 is **text-only on Gemini's free tier**.

### 7.2 Capability tiers
- **A. ASK** — "What's happening around Japan right now?" / "Where are the biggest earthquakes today?" / "What satellites are over Europe?"
- **B. EXPLAIN** — "What does this earthquake marker mean?" / "Explain what I'm looking at."
- **C. NAVIGATE** — "Take me to Tokyo." / "Zoom to the largest earthquake."
- **D. DISCOVER** (fast-follow) — "Show me something interesting happening right now" → picks a notable event from current data and flies there. This is the engagement/virality multiplier.

### 7.3 The grounding pipeline (never dump raw data)
```
User question
   │
   ▼
[Intent + entity extraction]  (small model call OR local heuristics)
   │  → {intent: NAVIGATE|ASK|EXPLAIN|DISCOVER, place?, layer?, superlative?}
   ▼
[Context builder — runs in the CLIENT over already-loaded data]
   • filter to viewport / named place / requested layer
   • aggregate: counts, top-N by magnitude/size, bounding stats
   • compact to a small JSON "situation brief" (target < 1–2 KB, < ~500 tokens)
   ▼
[Gemini call via Worker proxy]  system prompt + situation brief + question
   │  → returns: { answer_text, actions: [ {type:"flyTo",lat,lon,height}, {type:"select",id}, {type:"setLayer",...} ] }
   ▼
[Frontend validates + executes actions]  (whitelist of action types; clamp coords)
```
**Key rule:** if 10,000 aircraft exist, Ask Atlas never sees 10,000 records. The client aggregates to e.g. `{region:"Philippines", flights_in_view: 143, notable:[{callsign, alt, type}], busiest_bearing:"NE"}`. The LLM reasons over the *brief*, not the firehose.

### 7.4 Structured actions (the "controls the globe" part)
- Define a **strict JSON action schema** (`flyTo`, `select`, `setLayer`, `setTime`, `highlight`). Use Gemini's JSON/function-calling mode.
- Frontend has an **action executor** that whitelists types and **clamps/validates** every parameter (lat/lon ranges, known layer ids, known entity ids). Anything off-list is ignored. This is also the primary defence against prompt-injection driving the map (§13).

### 7.5 Model & provider
- **v1: Gemini 2.5 Flash / Flash-Lite on the free tier** (input ≈ $0.175/M, output ≈ $0.75/M once paid; free tier covers early usage). **[VERIFIED pricing order-of-magnitude]** Cheapest capable option that fits "$0."
- Abstract behind an `aiProvider` interface so GPT-mini/Claude Haiku can be swapped in Track B.

### 7.6 Graceful degradation (non-negotiable — Principle 4)
The product must be **fully usable with AI off**. If Gemini is unavailable / quota exhausted / user over limit / cost circuit-breaker tripped:
- Ask Atlas input shows a friendly "Atlas is resting — explore manually" state.
- All manual controls (search, layers, click-to-inspect, share) keep working.
- DISCOVER falls back to a **non-AI heuristic** ("largest quake today," "most flights in view") computed client-side — so even the discovery hook survives with zero AI.

### 7.7 Privacy in the AI path (§13 expands)
Only the question + the minimal situation brief go to Gemini. **Never** send IP, precise geolocation, tracking IDs, user identifiers, or full datasets. Publish exactly what's sent in the privacy policy.

---

## 8. Share system (database-free viral engine)

### 8.1 Requirement
Any view — location, camera (lat/lon/height/heading/pitch), active layers, selected entity, filters, and relevant time/state — must be reproducible from a URL **with no server record**.

### 8.2 Mechanism (recommended)
**Encoded URL state, no DB.**
- Serialise a compact state object → **URL-safe Base64 of a minified/`msgpack`-style payload**, or a fixed **positional param scheme** for the common case. Example: `eyeofatlas.com/?v=<base64>` or human-friendly `…/live/earthquakes?lat=..&lon=..&h=..&lyr=eq,sat&sel=us7000abcd`.
- **Round-trip determinism:** loading the URL rebuilds the exact camera + layers + selection. Live data is re-fetched fresh (a share is "this *view/place/time-window*," not a frozen snapshot — set expectations in copy: "showing latest data for this view").
- Keep payloads short (well under browser/SEO-safe URL limits, target < 1,500 chars); drop defaults; version the schema (`v1:`) so old links keep working.
- **No signing needed** for public views (state is non-sensitive). If we later add "official" curated links, a short **hash → static JSON on the CDN** (still no DB) can back a pretty `/view/abc123` slug generated at build/PR time.

### 8.3 Share UX
- Prominent **"Share this view"** → copy link, native share sheet (mobile), and social buttons (X, Facebook, Reddit, WhatsApp).
- **Open Graph / Twitter Card** per shared view: title ("M6.1 earthquake near Tokyo — live on Eye of Atlas"), description (live summary), and an **OG image** of that view.
- **OG image strategy:** MVP = a small set of layer/route-level static OG images + a templated card; fast-follow = Worker-generated image (satori/resvg) rendering the situation brief (place, layer, key stat) — cheap, no globe render needed.
- Canonical URLs on SEO routes; share URLs use query params so they don't fragment canonicals.
- **Privacy:** shares encode only public view state — never anything user-identifying.

### 8.4 Why this drives growth
Every "whoa" moment (a big quake, a wall of flights, a fire front) becomes a link a person sends to a friend, who lands *inside the product on that exact view* — the top of the viral loop (§19).

---

## 9. SEO strategy

### 9.1 Objective
**Create many genuinely useful search entry points into the interactive app** — not thin autogenerated pages. Each page must stand on its own for a real query *and* drop the visitor onto the live globe.

### 9.2 URL architecture
- **Layer hubs (static, indexable):** `/live/earthquakes`, `/live/flights`, `/live/satellites`, `/live/wildfires`, `/live/weather`. Each: what it is, how to read it, live summary, embedded globe.
- **Phenomenon/topic pages (static, indexable):** `/earthquakes/what-is-magnitude`, `/satellites/what-is-the-iss`, `/wildfires/how-firms-detects-fire` — evergreen explainers that rank and internally link to the live hubs.
- **Place pages (static shell, dynamic data, indexable — curated set):** `/earthquakes/near/tokyo`, `/flights/over/los-angeles`, `/live/over/manila`. **Generate only for a curated list of high-search-volume places** (top ~200–500 cities/regions), not every lat/lon — this is how we avoid thin/duplicate spam.
- **Event pages (dynamic, mostly `noindex`):** a specific quake `/earthquakes/event/us7000abcd`. Index **only** significant events (e.g. M≥5.5) to avoid churn/thin pages; everything else `noindex,follow`.
- **View shares:** query-param URLs, `noindex` (they're infinite and personal), but crawlable via `follow` for OG.

### 9.3 Static vs dynamic vs index rules
| Page type | Rendering | Indexable? | Why |
|---|---|---|---|
| Home, layer hubs, explainers | **Static (pre-rendered)** | ✅ index | Stable, high-value, fast |
| Curated place pages | Static shell + client data | ✅ index | Real demand, bounded count |
| Significant event pages | Dynamic (built on threshold) | ✅ index (threshold-gated) | Newsworthy, unique |
| Minor event pages | Dynamic | ❌ noindex,follow | Avoid thin/churn |
| Share/view URLs | Client | ❌ noindex,follow | Infinite/personal |
| Search results, filters | Client | ❌ noindex | Duplication |

### 9.4 Anti-thin-content rules (quality gate)
Every indexable page must contain, server-rendered where possible: a **current data summary**, a **last-updated timestamp**, an **explainer of the phenomenon**, **geographic context**, **relevant stats**, **the interactive globe**, and **internal links to related places/events**. A page that can't be populated with real data is **not generated**. No page is published purely to exist.

### 9.5 Technical SEO
- **JS-rendering:** Google renders JS but slowly/unreliably for a heavy Cesium SPA → **pre-render the meaningful content as static HTML** (Astro), hydrate the globe as an island. The text/stats Google needs must be in the initial HTML.
- **Sitemaps:** segmented sitemaps (hubs, explainers, place pages, active significant events) regenerated on build / on a schedule; event sitemap pruned as events age.
- **robots.txt:** allow hubs/explainers/place/significant-event; disallow share/query/filter noise.
- **Canonicals:** self-canonical on hubs/place/explainer; event pages canonical to themselves; share URLs canonical to the relevant hub.
- **Structured data (schema.org):** `Dataset`/`WebApplication` on hubs; for quakes consider `Event`/`GeoCoordinates`; `BreadcrumbList` for hierarchy; `FAQPage` on explainers. (Use only where accurate — no fake markup.)
- **Core Web Vitals:** static shells + deferred Cesium load = good LCP on content; lazy-init the globe below the fold or behind an explicit "Launch globe" on content pages to protect CWV.
- **Internal linking:** hubs ↔ explainers ↔ place pages ↔ significant events, forming a crawlable web.

### 9.6 Freshness without a database
Live data changes constantly, but **structure is static**. Pages are static shells; **numbers hydrate client-side** from public APIs; **"last updated" is stamped at render/fetch**. Significant-event pages are (re)generated by a scheduled build (Cloudflare cron / GitHub Action) that reads USGS/FIRMS and writes static HTML — still no DB.

---

## 10. Automated content engine

### 10.1 Principle
Use the live-data nature as a **content advantage**, but **never fabricate** — every claim is grounded in fetched data, with a source and timestamp. **No mass-generated SEO spam.**

### 10.2 What it produces
- **Daily "State of the Planet" brief** (static page + social post): "Today: 3 M5+ quakes (largest M6.1 near ___), 412 active fire detections in ___, ISS passed over ___." Auto-drafted from real data, **human-approved before publish** in early days.
- **Notable-event pages:** auto-created when thresholds trip (M≥5.5 quake, major fire cluster, notable launch).
- **Shareable visualisations/screenshots** (see §23 Capture Mode).

### 10.3 Pipeline (grounded generation)
```
Scheduled job (CF cron / GH Action)
  → fetch USGS/FIRMS/CelesTrak/Launch Library (Class-A/B sources only)
  → compute facts (counts, superlatives, locations) — deterministic code, not AI
  → AI writes prose ONLY from those facts (Gemini), with numbers passed as data
  → validation: every number in output must match a source fact (regex/lint check)
  → human approval queue (early) → publish static page + queue social post
```

### 10.4 Quality controls
- **Fact-lint:** generated text is diffed against the computed fact set; any number/claim not in the fact set blocks publish.
- **Human-in-the-loop** for the first ~30–60 days, then spot-check.
- **Rate/volume caps:** at most a few pages/posts per day; quality over quantity.
- **Clear labelling:** "Auto-generated from live data, [sources], [timestamp]."
- **No opinions, no predictions, no attribution to people.**

---

## 11. Community & open-source distribution

### 11.1 Principle
**Usefulness and contribution first; promotion second.** Eye of Atlas builds on an MIT open-source project with a large audience — respect that lineage, credit it prominently, and add value back.

### 11.2 GitHub / open-source posture
- Public repo (respect GEV's MIT licence; **retain attribution/NOTICE**; keep our own additions clearly licensed).
- Excellent **README** (what/why, live demo link, screenshots, GIF, architecture, data sources + licences, how to run).
- **Demo page**, short **demo video/GIF**, **CHANGELOG**, **issue templates**, **CONTRIBUTING**, a public **roadmap**.
- Contribute fixes/improvements **upstream to GEV** where sensible — goodwill + backlinks + credibility.

### 11.3 Launch surfaces (contribution-first, no spam)
- **Hacker News (Show HN)** — the single highest-leverage launch; needs a genuinely working, fast demo and an honest write-up ("built on God's Eye View, here's what we changed and why").
- **Reddit** — value-first posts in r/dataisbeautiful, r/geography, r/spaceflight, r/aviation, r/gis, r/webdev, r/opensource (read each sub's self-promo rules; lead with something interesting, not "check out my site").
- **Communities:** GIS, aviation, astronomy/space, data-viz Discords/forums — participate before posting.
- **Product Hunt** (GEV itself launched there) once the product is polished.

### 11.4 Feedback loop
Issue templates for bugs/data-source problems/feature requests; a lightweight public roadmap; changelog cadence; respond fast in the first weeks.

---

## 12. Traffic & acquisition strategy

**Do not rely on paid ads (budget ≈ $0).** Prioritise compounding organic channels.

| Channel | What to publish | Frequency | Difficulty | Time to results | Automatable? | Human-controlled? | Success metric |
|---|---|---|---|---|---|---|---|
| **Organic search (SEO)** | Hubs, explainers, curated place pages | Build once, expand steadily | Med-High | 2–6 months | Partly (place-page gen) | Content quality | Impressions, clicks, ranking keywords |
| **Shareable views** | The product itself | Continuous | Low (product-led) | Immediate | Yes (built-in) | — | Share rate, referral visits |
| **Short-form video (TikTok/Reels/Shorts)** | Capture-Mode clips of striking events | 3–7/week | Med | Weeks | Semi (Capture Mode) | Editing/voice | Views, saves, referral spikes |
| **YouTube** | Longer explainers / "what happened this week on Earth" | 1–2/week→month | Med-High | 1–3 months | Partly | Yes | Watch time, subs, referrals |
| **Reddit/community** | Genuinely interesting finds | 1–3/week | Med (rules) | Immediate-weeks | No | Yes | Upvotes, referral traffic |
| **GitHub/open source** | Repo, upstream contribs | Ongoing | Low-Med | Weeks | No | Yes | Stars, forks, backlinks |
| **Hacker News (Show HN)** | Launch + notable updates | 1–2 total | High | Immediate | No | Yes | Front page, traffic, backlinks |
| **Digital PR** | Pitch after a big natural event | Opportunistic | High | Opportunistic | No | Yes | Press links (DA) |
| **Data-driven content** | Daily/weekly briefs | Daily/weekly | Low-Med | 1–3 months | Yes (grounded) | Approval | Indexed pages, long-tail traffic |
| **Word of mouth** | (emergent from sharing) | — | — | — | — | — | Direct/returning visits |

**Sequencing:** SEO foundations + share system + Capture Mode **before** the HN/Reddit/PH launch blitz, so launch traffic converts into indexed pages, shares, and social clips rather than leaking away.

---

## 13. Security & privacy

### 13.1 Threat surfaces & mitigations
| Surface | Risk | Mitigation |
|---|---|---|
| **API key exposure** | Keys stolen from browser → runaway billing | All secret keys in **Worker proxy only**; origin/referer checks; per-IP rate limits; **hard daily budget caps**. |
| **Prompt injection via external data** | Live text (news headlines, place names) fed to Ask Atlas contains "ignore instructions…" | **Never** put raw external free-text in the system prompt; pass data as **typed JSON fields**, not prose; instruct model that data is untrusted; **whitelist + validate all returned actions**; the action executor is the hard boundary. |
| **AI endpoint abuse** | Someone hammers the Gemini proxy → cost/quota burn | Per-IP + global rate limits; daily cap circuit-breaker; lightweight bot checks (e.g. Turnstile) if abused. |
| **Malicious URL params (shares)** | Crafted state → XSS or crash | Strict parse/validate/clamp of every decoded field; never `eval`; never inject state into DOM as HTML. |
| **XSS** | User/data-driven strings rendered as HTML | Escape/encode all dynamic text; CSP header; framework auto-escaping. |
| **Third-party scripts (ads/analytics)** | Supply-chain / privacy | Minimise; load async; pin/subresource-integrity where possible; CSP allowlist. |
| **Dependency vulnerabilities** | Cesium/Vite/npm supply chain | Dependabot/`npm audit` in CI; pin versions; review updates. |
| **CORS** | Overbroad access to proxy | Lock Worker CORS to our origins. |
| **Scraping / DoS** | Traffic spikes → cost | Cloudflare in front (rate limiting, caching, bot mgmt free tier); budget governors fail to a static state, never to unbounded spend. |
| **UGC (future)** | Abuse if added | Out of scope v1; if added, moderation + rate limits. |

### 13.2 Privacy (data-conscious by design)
- **To the AI:** only the question + minimal situation brief. No IP, no precise location, no identifiers, no tracking data. Documented in the privacy policy.
- **Geolocation:** only with explicit user permission ("center on me"); never sent to third parties; not stored.
- **Analytics:** privacy-friendly, cookieless where possible (§16); consent banner where required (GDPR/UK/relevant regions).
- **No accounts / no PII in v1** → dramatically smaller privacy surface.

---

## 14. Performance strategy & budgets

### 14.1 Why this matters
Cesium + Google 3D Tiles + many live entities + polling is GPU/network/battery heavy — worst on mobile and low-end devices, exactly the audience arriving from shares/search.

### 14.2 Techniques (map to Claude Code tasks)
- **Viewport filtering:** only fetch/render entities within current camera bounds (esp. flights).
- **Clustering + level-of-detail:** cluster dense points at distance; expand on zoom.
- **Entity caps:** hard max visible per layer (e.g. flights ≤ N in view); prioritise by size/importance.
- **Layer-specific refresh intervals:** quakes ~1–5 min, fires ~15–30 min, flights ~5–15 s (only when flight layer active + tab visible), satellites propagate client-side (no polling).
- **Adaptive refresh & idle-throttle:** slow/stop polling when tab hidden or camera idle; back off on low battery/`prefers-reduced-motion`.
- **Web Workers:** SGP4 satellite propagation and heavy parsing off the main thread.
- **Lazy loading:** load a layer's code/data only when enabled; defer Cesium init on content pages.
- **Mobile defaults:** fewer entities, 2D/low-detail imagery option, lower refresh, reduced effects; auto-detect low-end → conservative mode.
- **Network discipline:** batch/debounce requests; respect cache windows; avoid redundant tile loads.

### 14.3 Performance budgets (targets)
- Time-to-interactive: **< 3s desktop / < 6s mobile** (cold, fast 4G).
- Frame rate: **≥ 30 fps desktop / ≥ 24 fps mobile** during interaction.
- Content-page LCP: **< 2.5s** (globe deferred).
- Peak visible entities (mobile default): **≤ ~300**; desktop **≤ ~1,500** (tune empirically).
- Data transfer after load: keep per-refresh payloads small (aggregate/viewport-limit).
- **Measure first:** Stage 1 includes instrumenting actual entity counts + FPS before optimising (no blind "improve performance").

---

## 15. Mobile strategy

**Priority: an excellent responsive *web* app.** Most share/search traffic is mobile, so mobile is a first-class MVP target, **not** a native app. Requirements: touch camera controls, mobile-safe layout (collapsible panels, bottom-sheet info), mobile ad placements that never cover the globe, conservative performance defaults, `prefers-reduced-motion` respect.

**Do not build a native Android/iOS app in v1.** Revisit only after demand is validated (e.g. strong mobile retention + repeated requests + a feature that genuinely needs native, like background notifications for "quake near you"). If justified later (Track B), a thin wrapper (Capacitor/PWA-to-store) over the same web app is the cheapest path. A **PWA (installable, offline shell, add-to-home-screen)** is a low-cost middle step worth considering in Stage 2.

---

## 16. Analytics

### 16.1 Approach
Privacy-conscious, low/zero cost. **[RECOMMENDATION]** Cloudflare Web Analytics (free, cookieless, pairs with our host) and/or Plausible/Umami (self-host Umami on free tier if desired). Avoid GA4 unless needed for AdSense insight — and if used, gate behind consent.

### 16.2 Metrics that matter (not vanity)
Visitors & sources; **SEO landing pages & queries** (Search Console); **share creation & share-referral visits** (the viral coefficient inputs); **Ask Atlas usage & success/fallback rate**; popular **locations & layers**; **session duration & interaction depth**; **returning-visitor %**; **mobile vs desktop**; **performance (CWV, error rate)**; and for monetisation: **RPM/CTR by page type, invalid-traffic signals**.

### 16.3 Key derived metrics
- **Share rate** = shares / sessions.
- **Viral referral share** = visits from share links / total.
- **AI engagement** = Ask Atlas sessions / sessions; **AI fallback rate** (health).
- **SEO share of traffic** and **top entry pages**.
Define events for: share_created, share_opened, ai_query, ai_fallback, layer_enabled, event_page_view.

---

## 17. Monetisation

### 17.1 Model & staging
| Phase | What | Gate to enter (metrics) |
|---|---|---|
| **1. Free public product** | Ship it; grow; measure | MVP done, stable, licence-clean |
| **2. Advertising** | AdSense (or equiv.) on **content/SEO pages** + non-intrusive panel slot | Consistent traffic (e.g. thousands of sessions/mo), quality content pages exist, policy pages live |
| **3. Optional ad-free** | Small one-time/subscription to remove ads | Enough ad revenue + demand signal that ads bother power users |
| **4. Premium AI/features** | Higher Ask Atlas limits, voice (BYOK/premium), saved views | AI usage high + users hitting free limits |
| **5. Sponsorship / other** | Sponsored explainers, data partnerships, API | Meaningful audience + inbound interest |

**No premium in MVP.** Ads only **after** UX/performance are good.

### 17.2 Ad placement (protect the experience)
- **Yes:** content/SEO pages (explainers, place pages — where AdSense wants context anyway); a non-intrusive desktop **sidebar/info-panel slot**; mobile-safe anchored slot that never overlaps the globe.
- **No:** popups, interstitials, ads over the globe, high density, misleading/auto-play. These kill retention and risk policy violations.

### 17.3 AdSense reality check (important) **[VERIFIED direction]**
- Approval is **not guaranteed** and is **content-quality driven**. A bare interactive globe (one thin page) is a **weak AdSense candidate** — this is a core reason the **SEO content pages exist**: they give AdSense real, original, useful content to approve.
- Requirements to prepare: **original/sufficient content**, clear **navigation**, **privacy policy**, **terms**, **cookie/consent** (CMP for GDPR/UK), **ad disclosure**, site ownership on a **custom domain**, and full policy compliance. Some regions require the site to be older/established.
- **Invalid-traffic protection:** never click your own ads, don't buy junk traffic, keep bot traffic out (Cloudflare) — invalid activity → bans.
- **Contingency:** if AdSense is declined/slow, alternatives (Ezoic, Media.net, or affiliate/sponsorship) — but fix the underlying content/traffic quality first.

### 17.4 Cost side of the ledger
Because infra is ~$0 and the biggest variable costs (Google Tiles, AI) are **hard-capped by budget governors**, the product can run at near-zero marginal cost. Track **revenue-per-visitor vs. cost-per-visitor**; only scale paid data/AI (Track B) when revenue clearly covers it.

---

## 18. Development workflow with Claude Code

### 18.1 Per-stage task contract
Every stage below is specified so a stage (or task) can be handed to Claude Code and supervised. Each carries: **Objective · Dependencies · Files/components affected · Tasks · Acceptance criteria · Tests · Manual verification · Risks · Rollback · Definition of Done.**

### 18.2 Claude Code execution protocol
1. **Inspect** relevant code before changing (read, summarise, confirm understanding).
2. **Propose** an implementation plan for the task/batch; **human reviews**.
3. **Implement in small batches** on a **feature branch**.
4. **Automated tests** run (unit/integration where feasible).
5. **Human tests in browser** (desktop + mobile viewport).
6. **Performance check** against §14 budgets where relevant.
7. **Small commit** with a clear message; open PR.
8. **Next task.**

**Rules for Claude Code:**
- **No destructive changes without explicit approval** (no deleting data folders, force-pushes, history rewrites, or dependency major-bumps unprompted). *(The one pre-approved destructive act is the §4.3 removal of Class-D data folders — done as its own reviewed PR.)*
- Prefer **small, reversible commits**; feature branches per stage/task.
- Never commit secrets; use `.env` + provider dashboards; keep `.env.example` current.
- **Always report:** what changed · why · files changed · tests performed · known issues · next recommended step.
- If a task is ambiguous or risks licence/cost/security, **stop and ask**.

### 18.3 Definition of Done (global)
Code merged to `main` via reviewed PR; tests pass; meets acceptance criteria; performance within budget (if applicable); attributions/legal intact; no secrets committed; docs/changelog updated.

---

## 19. Viral loop design

```
User arrives (search / shared link / social clip)
        ↓
Sees something striking (big quake, wall of flights, fire front)
        ↓
Ask Atlas / info panel explains it in plain language
        ↓
User explores nearby (DISCOVER: "show me something interesting")
        ↓
User taps SHARE → gets a link/clip of the exact view
        ↓
Friend opens the exact view (no signup, instant wow)
        ↓
Friend explores another event → shares → …loop
```
**Product features that strengthen each step:** great first-load wow (perf + visuals); instant, jargon-free explanations; one-tap DISCOVER; frictionless share (copy/native/social + OG image); zero-friction landing (no login wall); Capture Mode clips for social seeding. **Instrument every step** (§16) and optimise the weakest link.

---

## 20. Metrics, milestones & launch gates

### 20.1 Milestones
- **M0 — Product validation:** app loads reliably; P0 layers work; acceptable mobile performance; share round-trips; AI-off works.
- **M1 — Initial launch:** live on custom domain; first public users; first organic visitors; first shared views; Show HN + first community posts done.
- **M2 — Early traction:** returning visitors present; Search Console impressions rising; social referral traffic exists; measurable share rate.
- **M3 — Monetisation-ready:** enough quality content pages + traffic to pursue AdSense; policy pages live; invalid-traffic protections on.
- **M4 — Growth:** MAU trend up; returning-user %, engagement, AI usage, RPM tracked; infra cost near-zero; decide on Track B items with data.

### 20.2 Launch gates (must pass before the next thing)
- **Before ads:** §4.3 cleanup complete (`COMMERCIAL_COMPLIANCE.md` signed off) · privacy/terms/consent live · content pages exist · CWV green.
- **Before AI on by default:** cost circuit-breaker + rate limits verified · graceful degradation verified · injection defences tested.
- **Before public launch:** performance budgets met on mobile · error monitoring on · attributions complete.

Avoid inventing revenue predictions; define the **metric that unlocks each phase**, not a dollar forecast.

---

## 21. Competitor & market analysis

| Product | Focus | Does well | Does poorly | Audience | Monetisation | Our differentiation |
|---|---|---|---|---|---|---|
| **God's Eye View** (origin) | Everything on a 3D globe, voice AI | Breadth, wow, open source, honesty | Builder-oriented, cost-heavy (Google/OpenAI), SEO-hostile, not consumer-polished, non-commercial data mixed in | Devs, tinkerers | None (OSS) | Consumer polish, SEO, sharing, licence-clean, cheap AI |
| **FlightRadar24 / Flightradar** | Flights | Coverage, data depth, brand | Flights only, dense/expert, paywalled | Aviation enthusiasts | Subs + ads | Multi-layer + AI + free/shareable |
| **ADS-B Exchange** | Flights (unfiltered) | Coverage, no censoring | Niche, technical UI | Enthusiasts | Ads/API | Consumer-friendly generalist |
| **MarineTraffic / VesselFinder** | Ships | Coverage, brand | Ships only, paywalled, dense | Maritime | Subs/ads | Breadth + accessibility |
| **Windy.com** | Weather | Beautiful, fast, deep weather | Weather-centric, complex | Weather geeks, pros | Subs/ads | Broader "what's happening," AI explainers |
| **Zoom Earth** | Weather/storms/fires imagery | Clean, fast, shareable | Imagery-centric, no flights/sats | General public | Ads | Multi-layer + interactive globe + AI |
| **earth.nullschool.net** | Wind/ocean/particulate | Gorgeous, iconic | Single-purpose, niche UI | Data-viz fans | Donations | Broader + guided discovery |
| **USGS / earthquake maps** | Quakes | Authoritative | Utilitarian, ugly | Researchers, public | Gov | Beautiful, contextual, cross-layer |
| **Heavens-Above / satellite trackers / Stuff in Space** | Satellites | Accurate | Technical, dated UX | Space fans | Ads/none | Consumer polish + integrated |
| **Google Earth** | Explorable globe | Imagery, reach | Not live-events focused | Everyone | Google ecosystem | Real-time events + AI + focused |

**Opportunity / differentiation thesis:** every competitor owns *one* slice and skews expert. **No one owns "beautiful, friendly, AI-guided, shareable overview of everything happening on Earth right now."** That gap — generalist + AI + shareable + free — is Eye of Atlas's wedge. Answer to *"why use this instead of X?"*: **breadth on one gorgeous globe, plain-language answers, and one-tap sharing — for everyone, not just specialists.**

---

## 22. Legal / safety positioning & disclaimers

- **Not operational/safety-critical.** Inherit and prominently display GEV's disclaimer: data may be **delayed, incomplete, modeled, inferred, or wrong**; **not for navigation, emergency response, medical, or investment decisions.**
- **Per-layer freshness/accuracy notes:** flights (adsb.lol) are **regional/observed, not global-complete**; satellites are **propagated predictions** (TLE + SGP4), not live fixes; fires are **NRT detections** (may include false positives / miss fires); quakes are **automated, may be revised**; weather is **modeled**.
- **Ethical guardrails (inherited):** no named-person search, no face recognition, no individual tracking. State this publicly — it protects users and brand.
- **Required legal pages:** Privacy Policy, Terms of Use, Cookie/Consent, Data & Attributions, Disclaimer. All live **before** ads.
- **Attribution as legal duty:** the §4 attribution strings are contractual/licence obligations, not decoration.
- **[FLAG — legal review]** ODbL share-alike scope, AISStream ToS absence, CCTV per-city terms, and AdSense/consent compliance in target regions.

---

## 23. Content Capture Mode (social content tool)

### 23.1 Purpose
An internal tool to produce **shareable clips/images** for TikTok/Reels/Shorts/X — the fuel for the short-form channels in §12, at near-zero cost.

### 23.2 Cheapest practical first version (MVP-of-the-tool)
- **Not** automated video generation. Start with: **framed screenshot export** — pick location/layer/camera, overlay **stat readout + branding + timestamp/source**, export **PNG** in **16:9 / 9:16 / 1:1**.
- v1.5: **client-side screen/canvas capture** of a short scripted camera move (fly-to + orbit) exported as **WebM** via `MediaRecorder` — no server render, no cost.
- Later (Track B): server-side/offline high-quality renders, automated "event → clip" pipeline.

### 23.3 Controls
Location, layer(s), camera/animation preset, duration, aspect ratio, stat overlay toggle, branding toggle. Reuse the **DISCOVER** logic to auto-suggest "clip-worthy" current events.

---

## 24. Sources & references

**Primary (repo & author):**
- God's Eye View repo — https://github.com/bilawalsidhu/gods-eye-view
- `DATA_SOURCES.md` — https://github.com/bilawalsidhu/gods-eye-view/blob/main/DATA_SOURCES.md
- README — https://github.com/bilawalsidhu/gods-eye-view/blob/main/README.md
- Author announcement — https://www.spatialintelligence.ai/p/i-open-sourced-gods-eye-view ; https://kbssidhu.substack.com/p/the-planet-in-one-browser-tab-bilawal

**Hosting free tiers (2026):**
- Cloudflare vs Vercel vs Netlify comparison — https://hosting-ranked.com/cloudflare-pages-vs-vercel-vs-netlify/ (⚠️ Vercel free tier = non-commercial; Cloudflare Pages = unlimited bandwidth, commercial OK)

**AI pricing (2026):**
- AI API pricing comparison — https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude (Gemini 2.5 Flash ≈ $0.175/$0.75 per M; Claude Haiku ≈ $1/$5 per M)

**AdSense (2026):**
- AdSense approval requirements overview — https://theguidex.com/google-adsense-approval/ (verify against official Google AdSense policies before applying)

**Data-source licences (verify current terms before commercial launch):** USGS (public domain), NASA FIRMS (CC0), CelesTrak (US-gov origin), Open-Meteo (CC BY 4.0), OpenStreetMap/adsb.lol/Overpass/Nominatim (ODbL 1.0), Natural Earth (public domain), Launch Library 2 / The Space Devs, GDELT, TeleGeography (CC BY-NC-SA — non-commercial), OpenSky (non-commercial), Google Maps Platform ToS, TomTom Developer ToS, AISStream.io.

> ⚠️ **Reminder:** Provider terms, prices, and free tiers change. Re-verify every Class C/D/E item and all pricing at the start of Stage 0, and again immediately before enabling monetisation.

---

## 25. Consolidated roadmap

| Stage | Goal | Main work | Dependencies | Effort | Cost | Exit criteria |
|---|---|---|---|---|---|---|
| **0 — Research, audit & prep** | Verified foundation, clean base | Run GEV locally; confirm stack; **licence/data audit → `COMMERCIAL_COMPLIANCE.md`**; remove Class-D sources; choose host (Cloudflare) + domain; set up repo/CI/branches; Worker proxy skeleton | This plan | **M** | $0 | GEV runs; audit signed; Class-D removed; proxy hello-world; domain live |
| **1 — Core MVP** | Small compelling globe | Globe + camera + search; **earthquakes + satellites** (P0); then **fires + flights + weather** (P1); info panels; layer controls; **share URL**; responsive/mobile; states; attributions; legal pages; analytics | Stage 0 | **L** | ~$0 | §5.4 criteria met; deployed publicly |
| **2 — Differentiation & growth infra** | Shareable + capturable | OG images; polished share UX; **Capture Mode v1** (screenshot export); PWA (optional); performance hardening to §14 budgets | Stage 1 | **M** | ~$0 | Shares round-trip w/ previews; clips exportable; CWV green |
| **3 — Ask Atlas (AI)** | Data-grounded assistant | Context builder (client aggregation); Gemini proxy + rate/budget caps; ASK/EXPLAIN/NAVIGATE; **DISCOVER** (+ non-AI fallback); injection defences; graceful degradation | Stages 1–2 | **M-L** | ~$0 (free tier) | AI works + degrades; injection tests pass; cost capped |
| **4 — SEO / content engine** | Search entry points | Astro shell/route migration; hub + explainer + curated place pages; significant-event pages; sitemaps/robots/canonicals/schema; grounded daily brief w/ fact-lint + human approval | Stages 1–3 | **L** | ~$0 | Pages indexed; no thin pages; Search Console live |
| **5 — Community & distribution** | Reach | README/demo/video/changelog/issue templates; upstream contribs; Reddit/Discord participation; short-form video cadence | Stages 1–4 | **M** (ongoing) | ~$0 | Repo polished; first channels active |
| **6 — Launch & measurement** | Public launch | Show HN + Product Hunt + community blitz; monitoring; funnel/viral-loop instrumentation | Stages 1–5 | **S-M** | ~$0 | Launched; metrics flowing |
| **7 — Post-launch optimisation & monetisation** | Sustain & earn | AdSense (after content/traffic gates); optimise weakest viral-loop step; SEO expansion; decide Track B items w/ data | Stage 6 | **M** (ongoing) | ~$0→ | Ads live & compliant; growth loop improving |

**Effort key:** S small · M medium · L large · VL very large. (Rough: Stage 1 is the bulk; Stages 2–4 are each medium-large; 5–7 are ongoing.)

---

## 26. Priority index (anti-scope-creep)

- **P0 (essential, MVP):** globe, camera, search, earthquakes, satellites, info panels, layer controls, **share URL**, responsive/mobile, states, attributions, legal/privacy, Cloudflare deploy, Worker proxy, cost caps.
- **P1 (important, MVP/fast-follow):** wildfires, flights (adsb.lol), weather, **Ask Atlas (thin)**, OG images, analytics, Capture Mode v1, SEO hubs + explainers, ad slots on content pages.
- **P2 (nice to have):** ships (gated on AISStream ToS), curated place pages at scale, DISCOVER polish, PWA, daily brief automation, significant-event pages.
- **P3 (future / Track B):** traffic, CCTV, radio, bikeshare, submarine cables (licensed), **voice AI**, native apps, accounts/saved views, paid global data feeds, automated video pipeline.

---

## 27. Design philosophy (keep returning to these)
1. Build the smallest compelling product first.
2. Traffic/distribution is as important as engineering.
3. The AI must understand the globe, not merely chat.
4. Every important AI feature degrades gracefully when AI is unavailable.
5. No database unless genuinely necessary.
6. Avoid infrastructure spending until there's evidence of demand.
7. Do not compromise data licensing to save money.
8. Do not create low-quality SEO spam.
9. Make interesting discoveries easy to share.
10. Do not overengineer before product-market validation.

---

## 28. Claude Code operating instructions (hand this to the agent)

**You are implementing Eye of Atlas from this plan. Follow this contract on every task:**
1. **Read before you write.** Inspect the relevant existing code; summarise what it does and your intended change; wait for approval on non-trivial changes.
2. **Small batches, feature branches, small commits, PRs.** No direct commits to `main`.
3. **Never** commit secrets, delete data/history, force-push, or major-bump dependencies without explicit approval. The **only** pre-approved deletions are the §4.3 Class-D data sources, done as one reviewed PR titled `chore: commercial data cleanup`.
4. **Respect licences & costs:** keep all §4 attributions; enforce provider cache/rate rules in the Worker; put every metered/keyed call behind a **daily budget cap**; never expose a secret key in the browser.
5. **Graceful degradation is a requirement, not a nice-to-have:** the globe must work with AI and any optional layer disabled.
6. **Performance:** measure before optimising; meet §14 budgets; test a mobile viewport.
7. **Security:** validate/clamp all URL-state and all AI-returned actions against a whitelist; treat all external data as untrusted; escape all dynamic output.
8. **After every task report:** what changed · why · files changed · tests run · known issues · next recommended step.
9. **When ambiguous or risky (licence/cost/security), stop and ask.**
10. Update `CHANGELOG.md`, `.env.example`, and `COMMERCIAL_COMPLIANCE.md` when relevant.

**Suggested first task for Claude Code (Stage 0):** *"Clone and run God's Eye View locally; produce a written inspection report of the actual current stack, file structure, data-source calls, env vars, and the exact code paths that load each Class-C/D/E source from §4; propose the minimal diff to (a) remove Class-D sources, (b) route secret keys through a Cloudflare Worker proxy, and (c) deploy the static build to Cloudflare Pages. Do not change code yet — return the plan for review."*

---

*End of Master Plan. Companion: `Eye-of-Atlas-Master-Plan.pdf` (executive/strategic summary).*

