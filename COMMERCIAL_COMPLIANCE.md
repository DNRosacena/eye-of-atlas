# Eye of Atlas — Commercial Data-Source Compliance Audit

**Task:** Stage 0.2 — *Commercial data-source audit*
**Date of audit:** 2026-09-01
**Auditor:** Claude Code (implementation agent), reviewed by the project owner
**Codebase audited:** God's Eye View @ `6d83bb6` (see [docs/GEV-INSPECTION.md](docs/GEV-INSPECTION.md))
**Authority:** Eye of Atlas Master Plan §4
**Status:** 🟢 **Class-D removal LANDED 2026-09-01** (commit `chore: commercial data cleanup`). Five owner decisions resolved (weather, ships, Esri, imagery fallback, geocoding); one legal-review flag remains (§6.5).

**What changed since this audit was written:**
- Weather **cut from MVP** (owner decision) — Open-Meteo removed, §6.1 closed.
- Ships **out of Stage 1** (owner decision) — §6.3 closed.
- All four Class-D sources are **removed from the codebase and verified absent** from the production build. CI now fails if any is reintroduced.
- 🟢 **Esri World Imagery audited and remediated (§6.6).** The keyless Noncommercial endpoint has been removed and replaced with **ArcGIS Location Platform** (keyed, commercial deployment licence, 2M basemap tiles/month free). Esri moves **D → C**. Outstanding owner action: obtain and set a real `ARCGIS_API_KEY`.

> ⚠️ **This is not legal advice.** It is an engineering audit trail recording what each provider's official terms said on the date checked, what our code does, and what we propose. Items marked **[FLAG — legal review]** warrant a lawyer's eyes before monetisation.

---

## 1. How to read this document

Classes follow master plan §4:

| Class | Meaning |
|---|---|
| **A** | Safe to reuse commercially |
| **B** | Reusable with attribution (some ODbL share-alike) |
| **C** | Reusable only under conditions (paid / BYOK / quota / provider rules) |
| **D** | **Unsuitable for monetised deployment** — remove or replace |
| **E** | Unclear — requires verification or a licensing decision |

**Verification column:**
- ✅ **Direct** — I fetched the provider's own terms page on 2026-09-01 and quote it below.
- 🔶 **Secondary** — verified via search/summary rather than the primary ToS document; noted where it matters.
- ⬜ **Carried** — not independently re-verified this pass; classification carried from the repo's `DATA_SOURCES.md` and master plan §4. Low-risk sources only, and none of them are MVP-blocking.

---

## 2. Headline: what changed since the master plan was written

**Twelve findings. Three change MVP scope.** These are the reason 0.2 exists.

### 🔴 2.1 Open-Meteo is **non-commercial on the free API** — the plan has this wrong

Master plan §4.1 classifies Open-Meteo as **Class B — "✅ Yes, commercial"**. **That is incorrect for the free endpoint we would use.**

Open-Meteo's pricing page (checked 2026-09-01):

> "The free API is for non-commercial use" — and does not include a commercial use licence. Paid plans grant this licence.

Their definition of commercial use is explicit and names our exact model:

> "Operating websites or apps that have subscriptions or **display advertisements** … are considered commercial use."

**The distinction that causes the confusion:** the *weather data* is CC BY 4.0 (commercial use fine — this is what the plan and GEV's `DATA_SOURCES.md` both cite). But *access to Open-Meteo's free API service* is separately restricted to non-commercial use. Both are true; only the second one binds us.

**Impact:** weather is a **P1 MVP layer** (plan §5.3). As specified, it cannot ship in an ad-supported build.
**Options:** (a) paid Open-Meteo plan — smallest tier, breaks "$0" but modestly; (b) **self-host** Open-Meteo (it is open-source) — free but real infra, contradicts §6.1 "no server"; (c) different weather provider; (d) **cut weather from MVP**.
**My recommendation: (d) cut from MVP**, revisit as a paid Track B item. Weather is the least differentiated layer we have (Windy and Zoom Earth own it), it is P1 not P0, and it is the only MVP layer that would cost money on day one. → **Owner decision required, §6.1.**

### 🟢 2.2 The P0 "2D/low-cost imagery fallback" — **resolved 2026-09-01** (was: no confirmed source)

Master plan §5.2 lists a 2D/low-cost imagery fallback as **P0**, and master plan §6.6 makes it the mechanism that caps Google 3D Tiles spend. It suggests "Cesium ion free imagery / OSM". **Both are now in doubt:**

- **Cesium ion** — the ToS is enterprise-oriented and ambiguous for our case: the licence *"does not permit you to include ion in your own solution that you make commercially available to other organizations"*, and the service *"may not be operated … as, or to perform, a service for or on behalf of any third parties."* Whether a free public ad-supported website is "commercially available to other organizations" is genuinely unclear. Separately, **the "Cesium ion" logo must be prominently displayed** on the main application window. → reclassified **C → E**.
- **`tile.openstreetmap.org`** — the OSMF tile usage policy states access *"may be withdrawn at any point"*, blocks occur *"without prior notice"*, and it is **unsuitable for mission-critical commercial services**; they direct commercial/high-traffic sites to alternative providers or self-hosting.

**Impact at the time:** the cost-control architecture in master plan §6.6 depended on a fallback with no licensed source. **Now resolved** — ArcGIS Location Platform supplies it (§6.2, §6.6). Neither Cesium ion nor `tile.openstreetmap.org` is used for it.

> **Update 2026-09-01:** §6.6 below identifies a likely answer — **ArcGIS Location Platform**'s free tier (2M basemap tiles/month) carries a commercial deployment licence, giving us a licensed satellite basemap and the cost-capping fallback in one move, with no infrastructure to run.

### 🔴 2.3 Gemini's free tier trains on user input, with human review

Gemini API terms (checked 2026-09-01), unpaid services:

> "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services."
> "Do not submit sensitive, confidential, or personal information to the Unpaid Services."

Human reviewers may read and annotate inputs and outputs.

**Impact on Stage 3:** Ask Atlas questions typed by the public would be used for Google's product development and may be seen by humans. Plan §7.7 already says "publish exactly what's sent in the privacy policy" — this makes that **mandatory and more consequential**, and it strengthens the §7.3 rule that we never send user identifiers or precise location. Not a Stage 0 blocker (AI is Stage 3), recorded now so it is not discovered late.

### 🟠 2.4 Google's attribution rules constrain **ad placement**

Map Tiles API policies, **last updated 2026-08-31** — the day before this audit:

> "you must not pre-fetch, index, store, or cache any Content except under the limited conditions stated in the terms."
> "you must not overlap or obscure the Google logo with any other logo."
> "you must not overlap or obscure the Google data attribution in any way."

Plus concrete logo geometry: **minimum height 16dp, maximum 19dp**, clear space 10dp left/right/top and 5dp bottom, and the logo must not be modified.

**Impact:** plan §17.2 says ads live in "non-intrusive panel slots" and never over the globe. That instinct is now a **hard licence requirement**, not a UX preference — any ad unit that overlaps the Google logo or attribution is a ToS breach. Also: the API sends `Cache-Control`/`ETag` headers that must be respected, which means the Worker must **pass Google responses through untouched** and never add its own caching layer.

### 🟠 2.5 AISStream **prohibits direct browser connections**

From aisstream.io (checked 2026-09-01): *"Direct browser connections are not permitted"*, with *"up to three open connections per originating IP and three subscribed connections per account."*

**Impact:** this is not merely a "nice to proxy it" situation — a persistent **server-side** WebSocket is architecturally mandatory. On Cloudflare that means **Durable Objects**, well beyond the thin stateless Worker the plan assumes. Combined with the still-absent formal ToS (§4, AISStream row), this reinforces keeping ships out of Stage 1 entirely. → **§6.3.**

### 🟠 2.6 Nominatim is a poorer fit for us than the plan implies

OSMF Nominatim usage policy:

> "No heavy uses (an absolute maximum of 1 request per second)."
> "Results **must be cached** on your side."
> "Applications and services whose primary function is related to geocoding must run their own service."

Location search is a **P0 MVP feature** (plan §5.2). We are not *primarily* a geocoder, so we are probably on the right side of that line — but at consumer traffic, 1 req/s is a hard ceiling and access can be withdrawn. Plan §4.1 says "heavy use → self-host/alt geocoder"; this audit upgrades that from a footnote to a **Stage 1 design requirement**. Note GEV already funnels this through a serial queue (`_nominatimQueue`) which our Worker must replicate — see §5.

### 🟠 2.7 CelesTrak will IP-block, and a stateless Worker would trigger it

CelesTrak usage policy:

> "M2M (machine-to-machine) software should immediately stop querying when it receives any non-HTTP 200 responses"

Repeatedly ignoring non-200s causes IP blocking. Guidance is "only download data once per update" (GP data updates every 2 hours).

**GEV is compliant only because of its server-side cache**: the CelesTrak proxy holds TLEs for **6 hours** on disk (`vite.config.js:1470-1500`, `TLE_TTL_MS = 6 * 3600_000`) while the client refreshes every 5 minutes (`src/data/satellites.js:1524`). **Without an equivalent cache, our Worker would forward the 5-minute client cadence to CelesTrak and get the Cloudflare edge IP blocked** — which would break satellites for everyone, not just us. Satellites are a **P0 MVP layer**. This is a mandatory Worker requirement, not an optimisation.

### 🟢 2.8 OpenSky's terms are **worse** than the plan states — Class D fully confirmed

OpenSky's own terms page returned HTTP 403 to automated fetching; verified 🔶 via search summarising that page. Commercial use requires written consent, and the prohibited list explicitly includes:

> "advertisements on web pages/applications using the API"

That is a verbatim description of Eye of Atlas. **No ambiguity: OpenSky must go.**

### 🟢 2.9 Google News — Class D fully confirmed

Google News ToS:

> "You may only display the content of the Service for your own personal use (i.e., non-commercial use)"

and it explicitly forbids using the Service *"to increase traffic to your Web site for commercial reasons, such as advertising sales"* and *"tak[ing] the results from the Service and reformat[ting] and display[ing] them"* — which is precisely what `normalizeRssArticles()` does. **No ambiguity.**

### 🟢 2.10 TeleGeography — Class D confirmed, with a Track B path

CC BY-NC-SA 3.0 confirmed 🔶. TeleGeography sells a commercial licence for the geocoded dataset (annual, delivered as a JSON API) — so plan §4.1's "Alternative: none free+commercial; treat as Track B licensed feature" is correct and the commercial route genuinely exists.

The endpoints in `source.json` are still live and return the data **with no licence header** — meaning nothing at fetch time would warn a developer. The repo's own `source.json` carries the warning instead: *"Check TeleGeography terms before redistribution or commercial use."*

### 🟢 2.11 adsb.lol confirmed clean — with a licensing nuance worth recording

Two different licences apply at two different points:
- **Feeders** waive rights under **CC0** when contributing (*"you agree, to the extent possible under law, to waive all copyright … under the CC0 license"*).
- The **published database** is **ODbL 1.0** — this is the one that binds us.

**No documented API rate limits** ("The API is available to everyone"). That is a *risk*, not a permission: an undocumented limit can appear at any time, and courteous self-governing caps in our Worker are the right response.

### 🟢 2.12 The dams layer displays a **wrong source label** (resolves 0.1 open question 5)

Master-plan open question resolved. `src/data/local_data/dams/README.md`:

> "Extracted from local decoded OpenInfraMap/PostGIS layers. Filters: `waterway=dam`, `man_made=dam`, or `building=dam`. **License: Open Database License (ODbL) 1.0.**"

Confirmed against the data itself: records carry negative OSM ids (e.g. `-19953989`) and include non-US features (a sample at 14.29°E, 46.17°N — Slovenia). The US Army Corps of Engineers publishes US-only data, so this is unambiguously an OSM extract.

**But `src/data/localLayers.js:31` sets `source: 'USACE'`**, which the layer panel displays to the user. This is a **UI label bug that misattributes ODbL OpenStreetMap data to a US federal agency** — a (minor) attribution defect in its own right. The `dataCredits.js` entry is correct (© OSM + Open Infrastructure Map); only the panel label is wrong. **Fix in 0.3.** *(Dams are not an MVP layer, so this is low-urgency — but it is a licence-correctness fix, so it should not be dropped.)*

---

## 3. Classification table — full audit

Attribution strings are quoted from `src/data/dataCredits.js` where GEV already implements them (these are reusable verbatim); where our required string differs, that is noted.

### 3.1 Class A — safe to reuse commercially

| Source | Data | Licence / terms | Verified | Attribution string | Rate / cache rules | Code paths |
|---|---|---|---|---|---|---|
| **USGS Earthquakes** | Quakes (24 h feed) | US public domain | ✅ API docs; ⬜ copyright page (usgs.gov TLS chain failed to verify from this machine — status is well established and uncontested) | "Earthquakes: Data courtesy of the U.S. Geological Survey" | Max 20,000 events/query (400 above); no documented rate limit. GEV polls **60 s** | `src/data/earthquakes.js:28` (**direct browser fetch to `earthquake.usgs.gov` — no proxy needed**), cadence `:136` |
| **NASA FIRMS** | Active fires (VIIRS ×3 NRT) | CC0 / US public domain; free `MAP_KEY` required | ✅ | "Active fires: NASA FIRMS — we acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (earthdata.nasa.gov/firms), part of NASA's Earth Observing System Data and Information System (EOSDIS)" | **5,000 transactions / 10-min interval**; larger queries count as multiple. GEV caches **30 min**, 24 h hard staleness ceiling | `src/data/firmsHeatmap.js:39` → `/api/firms`; proxy `vite.config.js:1963-2100`; `src/data/firmsCsv.js`, `firmsAdapt.js`, `firmsLabels.js`. Key: `FIRMS_MAP_KEY` |
| **CelesTrak** | Satellite TLEs | US-gov-origin data, no licence; citation requested | ✅ | "Satellites (TLEs): CelesTrak (celestrak.org), Dr. T.S. Kelso" | ⚠️ **Must stop querying on any non-200 or be IP-blocked.** Download once per update cycle (GP = 2 h). GEV caches **6 h** | `src/data/satellites.js:1096,1635`; `src/data/rocketLaunches.js:3258` → `/api/celestrak/*`; proxy `vite.config.js:1470-1560`. SGP4 client-side via `satellite.js` |
| **GDELT DOC 2.0** | News headlines | Unrestricted academic/commercial/governmental; citation + link required | ✅ | "Cockpit regional headlines: GDELT Project (location-matched article links; publisher terms apply)" — link to gdeltproject.org **required** | None documented. GEV requests `maxrecords=5`, `timespan=48h` | `vite.config.js:7069-7076` (currently the *fallback*; **becomes primary** in 0.3); client `src/data/regionalBrief.js:128` |
| **Natural Earth** | Base vectors / regions | Public domain | ⬜ | "Physical region boundaries from Natural Earth (public domain)" — courtesy only | Bundled; none | `src/data/naturalEarthRegions.js`; `src/data/local_data/natural_earth/` (2.6 MB) |
| **DataSF neighborhoods** | SF polygons | PDDL 1.0 (public domain) | ⬜ | Courtesy only | Bundled; none | `src/data/neighborhoodPolygons.js`; `src/data/local_data/neighborhoods/` |
| **Launch Library 2** (The Space Devs) | Launch metadata | Use/share in any form; attribution encouraged | ⬜ | "Space mission launch, payload & recovery metadata: Launch Library 2 — The Space Devs" | **15 calls/hr unauthenticated**; GEV disk-caches. Not an MVP layer | `src/data/rocketLaunches.js:16` → `/api/launches`; proxy `vite.config.js:1615-1720` |

> **Verified quote — GDELT:** *"all datasets released by the GDELT Project are available for unlimited and unrestricted use for any academic, commercial, or governmental use"*, provided *"any use or redistribution of the data must include a citation to the GDELT Project and a link to this website."*

### 3.2 Class B — reusable with attribution (ODbL share-alike where noted)

| Source | Data | Licence | Verified | Attribution string | Rate / cache rules | Code paths |
|---|---|---|---|---|---|---|
| **adsb.lol** | Flights, military flights, traces | **ODbL 1.0** (database); feeder contributions CC0 | ✅ | "Military flights, aircraft traces & bounded regional flight fallback: adsb.lol (ODbL 1.0)" → **becomes** "Flights: adsb.lol contributors (ODbL 1.0)" once it is the primary source | **None documented** — we must self-govern. GEV caches point queries **12 s**, 250 nm radius, 8 MB response cap | `src/data/militaryFlights.js:83,2200`; `src/data/militaryRegistry.js:108` → `/api/adsblol/*`; normaliser `src/data/adsbLolFallback.js`; proxy `vite.config.js:129-138, 2799-2884, 4716-4760` |
| **OSM / Overpass** | Road geometry, installation context | ODbL 1.0 | ⬜ (policy ✅ for tiles/Nominatim) | "Road geometry (traffic): © OpenStreetMap contributors (ODbL 1.0)" | GEV caches 24 h memory / 7 d disk (30 d boundaries); QL sanitiser bounds bbox 12°, around 50 km, timeout 30 s | `src/locations.js:867`; `src/data/traffic.js:45`; `src/annotations/annotationResolver.js:820` → `/api/overpass`; proxy `vite.config.js:144-660, 2587-2700` |
| **OSM / Nominatim** | **Place search (P0)** + reverse geocode, place labels | ODbL 1.0 + **usage policy** | ✅ | "Cockpit place context: © OpenStreetMap contributors via Nominatim (ODbL 1.0)" | ⚠️ **≤1 req/s absolute**; results **must** be cached; valid identifying User-Agent/Referer required; geocoding-primary apps must self-host | `vite.config.js:7020-7042` (serial `_nominatimQueue`); via `/api/regional-brief` |
| **Datacenters bundle** (4,351) | Infra points | ODbL 1.0 (OSM extract) | ⬜ | "Datacenters: © OpenStreetMap contributors (ODbL 1.0)" | Bundled | `src/data/localLayers.js:13-23`; `src/data/local_data/datacenters/` (2.5 MB) |
| **Dams bundle** (704) | Infra points | ODbL 1.0 (**OpenInfraMap/OSM** — see §2.12) | ✅ (repo provenance + data inspection) | "Dams: © OpenStreetMap contributors (ODbL 1.0) + Open Infrastructure Map" | Bundled | `src/data/localLayers.js:25-34` — ⚠️ **`source: 'USACE'` at `:31` is wrong, fix in 0.3** |
| **Re:Earth Terrain** (Mapterhorn) | Terrain mesh | CC BY 4.0 (+ EGM2008, NGA public domain) | ⬜ | "Terrain (keyless globe stacks): Re:Earth Terrain / Mapterhorn (CC BY 4.0) / EGM2008 (NGA)" | Not documented | `src/mapStackController.js:45`; `src/data/terrainHeightsProxy.js:97`; `src/data/terrainHeights.js` → `/api/terrain/heights` |

> **ODbL share-alike, practical reading.** Displaying ODbL data in our app is unambiguously fine with attribution. The share-alike obligation attaches to publishing a *derived database*. Eye of Atlas renders and discards; it does not publish enriched datasets. **We stay clear by never shipping a modified dataset as a product.** One consequence worth stating: if we ever cache adsb.lol/OSM results into an exportable store, or add a "download this data" feature, that changes the analysis. **[FLAG — legal review]** if the product grows.

### 3.3 Class C — conditional (paid / BYOK / provider rules)

| Source | Data | Terms | Verified | Attribution | Rules we must enforce | Code paths |
|---|---|---|---|---|---|---|
| **Google Map Tiles API** (Photorealistic 3D Tiles) | The 3D planet | Google Maps Platform ToS — metered billing | ✅ (policies **last updated 2026-08-31**) | Google logo, **16–19dp**, unmodified, 10dp clear space (5dp bottom), **not overlapped or obscured by any other logo**; data attributions in full or via expandable "Data sources" UI | ⚠️ **No pre-fetch, index, store, or cache.** Respect `Cache-Control`/`ETag` — **Worker must pass through, never cache.** Hard daily budget cap required | `src/main.js:83-90` (**key inlined into bundle** + `window.__GOOGLE_MAPS_API_KEY__`), `:159`; `vite.config.js:7370-7373` `define` |
| **Google Places / Text Search / Geocoding** | Search, context | Same ToS — **metered per call** | ✅ | Same | ⚠️ **One call fires on every page load** (`/api/google/nearby-places`, Austin default). **No daily cap exists**; per-minute limiter is opt-in and unlimited by default | `src/voice/gevActions.js:3054,1271,2945`; `src/data/militaryInstallations.js:449`; `src/annotations/annotationResolver.js:613,665,687`; `src/locations.js:359` (**direct browser call using the exposed key**) |
| **TomTom Traffic** | Congestion | TomTom Developer ToS, BYOK | ⬜ | "Traffic flow data © TomTom" — registered **only when live flow activates** (`TOMTOM_CREDIT`, `dataCredits.js:186`) | 120 s cache; **daily tile budget `TOMTOM_DAILY_TILE_BUDGET` (default 40,000)** — the only daily cap in the whole codebase | `src/data/tomtomTiles.js:4`; `src/data/flowTiles.js:8,135`; `src/data/traffic.js:25,195,1236,1284,1293`; proxy `vite.config.js:1731-1958`. **Cut from MVP** |
| **GBFS bikeshare** (9 operators) | Bike availability | Per-operator, attribution | ⬜ | "Bikeshare availability: GBFS operator feeds (e.g. Austin BCycle)" — **each feed's `license_url` must be honoured individually** | Per feed; GEV polls 60 s | `src/data/bikeshare.js:84-238,528` → `/api/gbfs/`. **Cut from MVP** |
| **Radio Browser** | Station directory | PDDL 1.0 (directory is public domain); **broadcaster stream terms apply separately** | ⬜ | "Internet-radio station directory: Radio Browser (public domain; audio delivered directly by each broadcaster)" | ⚠️ **Never proxy, cache, record, or redistribute audio.** GEV is compliant — browser connects directly to broadcaster after explicit user action | `src/data/radio.js:5,37,1763` → `/api/radio/*`; proxy `vite.config.js:741-1260`. **Cut from MVP** |

### 3.4 Class D — unsuitable for monetised deployment (**must remove**)

| Source | Licence | Verified | Why it fails | Full removal surface |
|---|---|---|---|---|
| **OpenSky Network** | Non-commercial research/education | 🔶 (terms page 403s to automated fetch) | Commercial use needs **written** consent; prohibited list explicitly names *"advertisements on web pages/applications using the API"* | **Proxy:** `vite.config.js:2894-3246` (`openSkyProxy`), constants `:88-140`, adsb.lol fallback `:2799-2884`. **Client:** `src/data/flights.js:273` (`API_URL`), `:3049`. **Credits:** `src/data/dataCredits.js:29-36`. **Env:** `OPENSKY_AUTH_MODE`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `OPENSKY_CREDENTIALS_FILE`. **Script:** `scripts/opensky-import-client.sh` + `package.json` `opensky:import`. ⚠️ **Works fully anonymously** — verified live in 0.1 — so it will keep working silently unless deliberately removed |
| **TeleGeography submarine cables** | CC BY-NC-SA 3.0 | 🔶 | NonCommercial. Commercial licence sold separately by TeleGeography (Track B option) | **Data:** `src/data/local_data/telegeography_submarine_cables/` (1.1 MB — `cable-geo.json`, `landing-point-geo.json`, `README.md`, `source.json`). **Module:** `src/data/telegeographySubmarineCables.js` (1,043 lines). **Registration:** `src/data/localLayers.js:3,50`. **State:** `src/data/layerState.js:292`. **Credits:** `src/data/dataCredits.js:170-177`. **Voice:** `src/voice/gevActions.js:173-175,3270`; enums `vite.config.js:5157,5643,5657,5688,5790`. ⚠️ **Benchmark coupling:** `src/overlays/worldOverlayAllocation.worker.mjs:68-73,833,836,910-922` (Node harness, not a browser worker) + its perf test. **Ships in the production build** as `dist/assets/cable-geo-*.json` |
| **Google News RSS** | Personal / non-commercial only | ✅ | *"You may only display the content of the Service for your own personal use (i.e., non-commercial use)"*; explicitly forbids using it *"to increase traffic to your Web site for commercial reasons, such as advertising sales"* and *"tak[ing] the results … and reformat[ting] and display[ing] them"* | **Primary path:** `vite.config.js:7047-7060` (inside `fetchRegionalNews`). **Helpers:** `decodeRssText` `:6980`, `rssTag` `:6988`, `normalizeRssArticles` `:6992`. **Credits:** `src/data/dataCredits.js:100-107`. **Replacement already present** at `:7069-7076` (GDELT) — promote to primary |
| **Open-Meteo free API** *(newly classified — see §2.1)* | Data CC BY 4.0, but **free API service is non-commercial** | ✅ | *"The free API is for non-commercial use"*; *"apps that … display advertisements … are considered commercial use"* | **Client:** `src/cockpitCloudEffects.js:375` → `/api/weather-effects`; regional brief weather via `/api/regional-brief`. **Proxy:** `vite.config.js` `weatherEffectsProxy`, `regionalBriefProxy`. **Credits:** `src/data/dataCredits.js:91-98`. **Not removal — a scope decision**, see §6.1 |

### 3.5 Class E — unclear, decision required

| Source | Issue | Verified | Code paths | Recommendation |
|---|---|---|---|---|
| **AISStream.io** | **Still no formal ToS** (unchanged since the plan). New constraints found: *"Direct browser connections are not permitted"*; *"up to three open connections per originating IP and three subscribed connections per account"* | ✅ | `src/data/aisLiveVessels.js:55,1657`; `src/data/aisStreamAdapter.js`; `src/data/aisWatchdog.js`; proxy `vite.config.js` `aisLiveProxy` + WebSocket `:6232`. Env `AISSTREAM_API_KEY` + 4 tuning vars | **Keep ships out of Stage 1.** No formal ToS is unacceptable risk for a monetised product, and the browser prohibition forces Durable Objects. Revisit only with written terms or a different AIS provider |
| **Cesium ion** | ToS ambiguous for a public ad-supported site (§2.2). **ion logo must be prominently displayed** | ✅ | `src/main.js:77-79`; `src/mapStackController.js`; `vite.config.js:7372` (`CESIUM_ION_TOKEN` **inlined into the bundle**) | **Do not depend on it for the P0 fallback** until clarified. Owner decision §6.2 |
| **City CCTV — Austin / Caltrans / TfL** | Three different per-city regimes. TfL requires a specific compound string incl. **OS © Crown copyright**. Privacy/UX optics on a consumer product | ⬜ | `src/data/cctv.js` (198 KB) + 5 helper modules; proxy `vite.config.js:4492-4716`; `config/cctv_sources.*.json`; credits `dataCredits.js:110-133` | **Cut from MVP** as plan §4.3 already directs. No further verification needed unless we revive it |
| **`tile.openstreetmap.org`** | OSMF policy: unsuitable for high-traffic commercial; withdrawal without notice | ✅ | `src/mapStackController.js` (OSM stack + Esri failure fallback) | Fine for local dev; **not** a production fallback. §6.2 |
| **Esri World Imagery** via **ArcGIS Location Platform** (keyed `ibasemaps-api.arcgis.com`) | **Class C** — commercial deployment licence; free tier 2M basemap tiles/month; API key required. *(The keyless `services.arcgisonline.com` endpoint it replaced was Class D — Noncommercial only.)* | ✅ | `src/mapStackController.js` (stack def, `ARCGIS_API_KEY` gate, `fromBasemapType`); `src/main.js` | Attribution mandatory; **never cache tiles** (§3.1(d)(6)); key is client-exposed → restrict by referrer. §6.6 |
| **Gemini free tier** (Stage 3) | Free-tier input used for training, human review possible (§2.3) | ✅ | Not yet in our codebase | Proceed, but the privacy policy must disclose it explicitly before Ask Atlas ships |

---

## 4. Required attribution surface (the "Data & attributions" UI)

Plan §4.3 item 6 requires a persistent, visible attribution UI. **GEV already has one** and it is well built: `registerDataCredits()` (`src/data/dataCredits.js:230`) registers every credit as a Cesium static credit with `showOnScreen=false`, landing them in the expandable bottom-left **"Data attribution"** popover. Verified rendering in 0.1. `TOMTOM_CREDIT` and `NATURAL_EARTH_CREDIT` register dynamically only when those sources activate — the correct pattern for conditional attribution.

**We inherit this wholesale.** Changes needed for Eye of Atlas:

| Action | Entry |
|---|---|
| **Remove** | `opensky` (`:29-36`), `telegeography` (`:170-177`), `google-news-rss` (`:100-107`) |
| **Remove or keep** pending §6.1 | `open-meteo` (`:91-98`) |
| **Promote** | `gdelt` (`:108-115`) — drop "fallback" framing; **link to gdeltproject.org is required, not optional** |
| **Rewrite** | `adsblol` (`:38-45`) — currently reads "Military flights, aircraft traces & bounded regional flight fallback"; becomes the primary flight credit |
| **Add** | Google Maps logo compliance (16–19dp, unobscured — Cesium's credit container handles the logo, but our CSS and any ad slot must not overlap it) |
| **Add** | Cesium ion logo, **if** §6.2 resolves in favour of ion |
| **Fix** | `src/data/localLayers.js:31` `source: 'USACE'` → OSM/OpenInfraMap (§2.12) |

**Attribution correctness is a licence condition, not a nicety.** Missing attribution is a breach for ODbL, CC BY, Google, and TfL alike.

---

## 5. Provider rules the Cloudflare Worker must enforce

Consolidated from the above; this is the compliance input to task 0.3(b).

| Rule | Source | Requirement |
|---|---|---|
| **Never cache Google content** | Google Maps ToS | Pass through; forward `Cache-Control`/`ETag` untouched. No Worker-side caching, no rehosting |
| **Hard daily budget cap per metered source** | Plan §6.6; nothing in GEV provides this | Google Tiles, Google Places, Gemini. Fail to a graceful "layer paused" state, never to unbounded spend |
| **Kill the page-load Places call** | Cost (§3.3) | `/api/google/nearby-places` must not fire before user intent |
| **CelesTrak ≥ 6 h cache + stop-on-non-200** | CelesTrak policy | Mandatory — a stateless Worker forwarding the 5-min client cadence gets the edge IP blocked |
| **FIRMS ≤ 5,000 tx / 10 min; 30 min cache** | FIRMS | Preserve GEV's 30 min TTL and 24 h staleness ceiling |
| **Nominatim ≤ 1 req/s, cached, identifying User-Agent** | OSMF policy | Serial queue cannot span isolates — needs Durable Object or KV token bucket |
| **adsb.lol self-governed caps** | No documented limit | Keep GEV's 12 s point cache and 250 nm bound; add our own ceiling |
| **Never proxy/cache/redistribute radio audio** | Radio Browser | Moot if radio is cut from MVP; do not reintroduce carelessly |
| **Use `CF-Connecting-IP` for rate limiting** | 0.1 finding | GEV's `clientKey()` (`vite.config.js:488`) deliberately ignores `X-Forwarded-For` — correct for localhost, **wrong behind Cloudflare**, where all traffic would collapse into one bucket |
| **Origin checks + locked CORS** | Plan §13 | Restrict to our origins |

---

## 6. Decisions I need from you

I have deliberately **not** guessed on any of these — each changes scope, cost, or legal exposure.

### 6.1 🔴 Weather / Open-Meteo (§2.1) — changes MVP scope
The free API forbids ad-supported use. Options: **(a)** paid Open-Meteo plan · **(b)** self-host (open-source, but contradicts "no server") · **(c)** another provider · **(d)** **cut weather from MVP** ← my recommendation. It is P1, the least differentiated layer we have, and the only MVP layer that costs money on day one.

### 6.2 🟢 The P0 imagery fallback — **CLOSED 2026-09-01: ArcGIS Location Platform**

**Resolved by the §6.6 work.** The P0 low-cost imagery fallback (master plan §5.2, and the mechanism master plan §6.6 relies on to cap Google 3D Tiles spend) is **Esri World Imagery served through ArcGIS Location Platform** — already implemented and running.

Why this is the right answer rather than the alternatives I had listed:

| Option previously considered | Verdict |
|---|---|
| **ArcGIS Location Platform** | ✅ **Chosen.** Commercial deployment licence, 2M basemap tiles/month free, no infrastructure to run, and it is satellite imagery — visually continuous with the Google 3D globe rather than a jarring switch to a street map |
| Cesium ion | ❌ Terms ambiguous for a public ad-supported product (§2.2); would also require displaying the ion logo |
| `tile.openstreetmap.org` | ❌ OSMF policy: unsuitable for high-traffic commercial use, withdrawal without notice. Retained **only** as a development fallback when no key is set |
| Self-hosted Protomaps on R2 | ❌ Licence-clean and cheap, but real infrastructure to build and operate — and it buys nothing over the above |
| No fallback at all | ❌ Leaves master plan §6.6's cost control with no mechanism |

**What this gives us, in one move:** a commercially licensed satellite basemap, *and* the automatic degradation target when the Google 3D daily budget is near-exhausted or the device is low-end (master plan §6.6), *and* the keyless-boot path — with no servers and no monthly cost at MVP volume.

**Sizing.** The free tier is 2,000,000 basemap tiles/month. A Cesium session at typical zoom pulls on the order of a few hundred tiles, so this comfortably covers early traffic; the ceiling should be re-measured against real sessions once we have any. Note this is a *separate* budget from Google's — the two do not interact, which is what makes it usable as an overflow target.

**Caveats carried forward, not closed by this:**
- The key cannot be validated by the app (§6.6) — tiles render even with a bogus token, so a misconfiguration is silent.
- Tiles must **not** be cached or proxied (Agreement §3.1(d)(6)), so the fallback cannot be routed through the Worker. This matches the Google 3D Tiles decision and means the budget governor for basemaps lives at Esri's quota layer, not ours.
- Attribution is mandatory whenever the imagery is displayed.

**Master plan §6.6 correction stands.** With Google 3D Tiles billed per root tileset query (≈ per session) rather than per tile, this fallback is justified primarily as a **mobile-performance and quota measure**, not as the load-bearing cost control the plan originally assumed.

### 6.3 🟠 Ships / AISStream (§2.5)
Confirm ships stay **out of Stage 1** so I can design the Worker as purely request-scoped (no Durable Objects). *(This repeats 0.1 question 2 — the browser-connection prohibition makes it more clear-cut than before.)*

### 6.4 🟢 Geocoding provider — **CLOSED 2026-09-02: Nominatim**

**Forced and then settled.** The owner dropped the Google Maps key (no card on file), which took Google Geocoding with it — and location search is a **P0 MVP feature** (master plan §5.2) that was throwing `No Google Maps API key available for geocoding`. Nominatim is now the provider.

**Implemented, not just chosen:**
- New `/api/geocode` proxy. It must stay server-side — Nominatim's policy caps use at **1 request/second** and **requires** caching, neither honourable from a browser spread across many visitors.
- It **shares the existing `_nominatimQueue`** with the reverse-geocode path, so forward and reverse geocoding together stay inside one 1 req/s budget rather than one each. Verified: two fresh queries took 6.0 s wall.
- **24 h cache**, 300 entries. Verified: repeat query served in 7 ms with `X-Geocode-Cache: HIT` vs 706 ms cold.
- Identifying `User-Agent` naming this application and repo, per policy.
- Nominatim's `category`/`type`/`addresstype` are mapped onto the Google type tokens `geocodeNavigationMode()` switches on, so the camera-framing logic is unchanged — the same normalise-at-the-edge trick `adsbLolFallback.js` uses for flights. Verified: Manila → `locality` (city framing), Mount Everest → `natural_feature` (region framing).

**The constraint we are living inside.** OSMF policy says applications *"whose primary function is related to geocoding must run their own service"*. We are a globe with a search box, not a geocoder, so we are on the right side of that line — but it **is** a line. If search volume grows, the answer is self-hosting Nominatim or a commercial geocoder, not more caching.

**Google Places recovery degrades, it does not break.** `placesNearViewRecovery()` still calls `/api/google/text-search`, which now fails without a key; `placesTextSearch()` already returns `null` on a non-ok response, so search falls back to the plain geocode result. The "did you mean the one on screen" refinement is simply absent, which is acceptable.

### 6.5 🟢 ODbL share-alike — **[FLAG — legal review]**
My read (§3.2) is that we are clear because we render and discard rather than publish derived databases. Low urgency, but you asked to be told when something warrants a lawyer. Two future features would change the analysis: a data-export button, or persisting adsb.lol/OSM results into a queryable store.

---

## 7. Verification log

| Provider | URL checked | Result |
|---|---|---|
| GDELT | `gdeltproject.org/about.html` | ✅ unrestricted commercial; citation + link required |
| Google News | `google.com/intl/en_us/terms_google_news.html` | ✅ personal/non-commercial only |
| Google Map Tiles | `developers.google.com/maps/documentation/tile/policies` | ✅ **updated 2026-08-31**; no caching; logo 16–19dp, unobscured |
| Gemini API | `ai.google.dev/gemini-api/terms` | ✅ free tier trains on input; human review |
| Open-Meteo | `open-meteo.com/en/licence` + `/en/pricing` | ✅ data CC BY 4.0; **free API non-commercial**; 10k/day |
| NASA FIRMS | `firms.modaps.eosdis.nasa.gov/api/area/` | ✅ 5,000 tx / 10 min |
| CelesTrak | `celestrak.org/usage-policy.php` | ✅ stop on non-200; IP blocking; once per update cycle |
| USGS | `earthquake.usgs.gov/fdsnws/event/1/` | ✅ API limits. ⬜ copyright page — TLS chain failed from this machine |
| Nominatim | `operations.osmfoundation.org/policies/nominatim/` | ✅ ≤1 req/s; must cache; geocoding-primary apps self-host |
| OSM tiles | `operations.osmfoundation.org/policies/tiles/` | ✅ unsuitable for high-traffic commercial |
| adsb.lol | `adsb.lol/privacy-license/` + `/docs/open-data/api/` | ✅ ODbL 1.0 database; CC0 feeder waiver; no documented limits |
| AISStream | `aisstream.io` | ✅ no formal ToS; **no browser connections**; 3 conns/IP |
| Cesium ion | `cesium.com/legal/terms-of-service/` | ✅ ambiguous for our case; ion logo required |
| OpenSky | `opensky-network.org/about/terms-of-use` | 🔶 **HTTP 403** to automated fetch; verified via search summary of that page |
| TeleGeography | `submarinecablemap.com` + search | 🔶 CC BY-NC-SA 3.0; commercial licence sold separately. Endpoints live, no licence header |
| Cloudflare vs Vercel | search | 🔶 CF Pages free tier permits commercial; **Vercel Hobby is non-commercial** — plan §24 confirmed. *Secondary source; since we are excluding Vercel anyway, the residual risk is nil* |
| Dams provenance | repo `README.md` + data inspection | ✅ OpenInfraMap/OSM, ODbL — **UI label is wrong** |

**Not re-verified this pass (⬜):** Natural Earth, DataSF, Launch Library 2, Overpass ODbL, Re:Earth Terrain, TomTom, GBFS operators, Radio Browser, per-city CCTV. All are either public-domain/uncontested, or cut from MVP. **None are MVP-blocking.** Re-verify TomTom, GBFS, Radio Browser and CCTV only if a later stage revives them; re-verify all Class C/D/E again immediately before monetisation, per plan §24.

---

## 8. Status against plan §4.3 (the mandatory cleanup gate)

| § | Requirement | Status |
|---|---|---|
| 1 | Remove TeleGeography folder + loaders | 🟢 **DONE** — data, module, layer registration, credits, voice enums, benchmark profile and QA scripts all removed; absent from `dist/` |
| 2 | Remove/disable OpenSky; adsb.lol primary; UI caveat | 🟢 **DONE** — `/api/opensky*` replaced by `/api/flights` (adsb.lol only); OAuth machinery, credentials, scripts and Provider Settings card removed. Layer row reads `adsb.lol · regional coverage - not all aircraft`, verified in-browser with 372 live aircraft |
| 3 | Replace Google News RSS with GDELT | 🟢 **DONE** — RSS branch and its three parser helpers removed; GDELT is the sole source and its required citation link is in the attribution panel |
| 4 | Cut CCTV, radio, GBFS, TomTom from MVP | 🔵 Confirmed, all Class C/E |
| 5 | Verify AISStream terms in writing | 🔴 **Still no formal ToS.** Ships confirmed out of Stage 1 by the owner; the layer remains present but off, and the Worker is designed request-scoped so nothing depends on it |
| 6 | Wire required attributions into a visible UI | 🟢 **DONE** — OpenSky, TeleGeography, Google News and Open-Meteo credits removed; adsb.lol promoted to the primary flight credit with its coverage caveat. Verified in the rendered attribution panel |
| 7 | Enforce provider rules in the proxy | 🔵 Consolidated in §5 as input to 0.3(b) |
| 8 | Produce `COMMERCIAL_COMPLIANCE.md` | 🟢 **This document**, updated as Part A landed |

🟢 done · 🔵 ready for 0.3 · 🔴 blocked on external facts
