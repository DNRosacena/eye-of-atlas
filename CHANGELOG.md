# Changelog

All notable changes to Eye of Atlas are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning will follow [Semantic Versioning](https://semver.org/) from the
first public release.

---

## [Unreleased]

### Stage 0 — Research, Audit & Preparation

#### Added
- `docs/GEV-INSPECTION.md` — inspection of God's Eye View at commit `6d83bb6`,
  documenting its real state: 144 source modules / 92.7k LOC, 16 live layers,
  and a "server proxy" that is 7,383 lines of Vite dev-server middleware rather
  than a deployable service.
- `COMMERCIAL_COMPLIANCE.md` — per-source audit trail: licence, commercial
  class, required attribution string, provider rate/cache rules, and the exact
  `file:line` load paths. Terms re-verified against providers' own pages on
  2026-09-01.
- `docs/STAGE0-CHANGE-PLAN.md` — approved file-level plan for the Class-D
  cleanup, the Worker key broker, and Cloudflare Pages deployment.
- `workers/api-proxy/` — Cloudflare Worker skeleton. Origin allowlist, per-IP
  rate limiting keyed on `CF-Connecting-IP`, per-source daily budget caps with
  a `layer-paused` degradation contract, and provider cache-window enforcement.
  One dummy brokered endpoint (`/api/ping`) proves the pipeline end-to-end;
  22 unit tests, verified live under `wrangler dev`.
- Repo scaffolding: `.gitignore`, `.env.example`, `.nvmrc` (Node 24),
  `LICENSE` (MIT), `NOTICE`, `README.md`, issue and PR templates, Dependabot,
  and CI (lint, test, build, `npm audit`, secret scan). No deploy job yet.

#### Removed — commercial data cleanup (change plan Part A)
Four data sources whose terms forbid use in a monetised product:
- **TeleGeography submarine cables** (CC BY-NC-SA 3.0, NonCommercial) — the
  bundled dataset, the layer module, its registration, credits, voice-tool
  enums, allocation-benchmark profile and three QA scripts. URL share token
  `u` is retired and must not be reused.
- **OpenSky** (non-commercial; explicitly prohibits *"advertisements on web
  pages/applications using the API"*) — `/api/opensky` and
  `/api/opensky-track` replaced by `/api/flights`, backed by **adsb.lol**
  (ODbL 1.0). All OAuth machinery, credentials, keychain lookups, the setup
  doctor checks, the Provider Settings card and the import script are gone.
- **Google News RSS** (personal, non-commercial use only) — **GDELT DOC 2.0**
  is now the sole headline source, with its required citation link.
- **Open-Meteo free API** (forbids ad-supported use) — the weather-effects
  proxy and briefing weather. The cockpit cloud renderer is left intact and
  simply has no observation to drive it.

#### Changed
- **Flights are regional now, and the UI says so.** The layer row reads
  `adsb.lol · regional coverage - not all aircraft`. adsb.lol was previously
  classified as a *fallback* source, which would have permanently displayed
  `FALLBACK` on a healthy feed; it is now correctly treated as primary, and the
  coverage caveat rides the nominal status line instead of the fault vocabulary.
- Dams layer source label corrected from `USACE` to `OSM / OpenInfraMap` — it
  is an ODbL OpenStreetMap extract and the old label misattributed it.
- Historical trail backfill removed with OpenSky's `/tracks/all`. Trails are
  built from locally accumulated fixes, which was already the fallback on any
  backfill failure. Repointing at adsb.lol traces is a Stage 1 follow-up.

#### Notes
- Parts B and C of the change plan (Worker routes, deployment) remain
  unimplemented; only the Worker skeleton exists.
- Forked from God's Eye View at `6b7bca2` (v0.1.0), which added keyless boot,
  in-app Provider Settings and an Esri World Imagery basemap. **Esri's terms
  have not been audited** — see `COMMERCIAL_COMPLIANCE.md` §6.6.
- The all-live allocation budget (182,000 B/frame) was calibrated with the
  submarine-cable cohort included. It is now conservative rather than tight and
  should be re-measured.
- Corrections to master plan §4 found during the audit, each verified against
  the provider's own terms:
  - **Open-Meteo's free API is non-commercial** ("apps that display
    advertisements … are considered commercial use"). The plan classed it as
    Class B / commercial-OK. **Weather is cut from MVP** as a result.
  - **Cesium ion reclassified C → E** — its ToS is ambiguous for a public
    ad-supported product, and `tile.openstreetmap.org` is explicitly unsuitable
    for high-traffic commercial use. The P0 imagery fallback has no confirmed
    licensed source yet.
  - **Google Photorealistic 3D Tiles bills per root tileset query (≈ per
    session), not per tile** — renderer-originating tile requests are not
    billable. This makes the cost risk in §6.6 substantially smaller than
    modelled, and is why 3D Tiles are capped at Google's quota layer rather
    than proxied. Needs confirmation against real billing.
  - **Gemini's free tier trains on submitted content** with possible human
    review — a privacy-policy disclosure requirement for Stage 3.
- **Ships are out of Stage 1.** AISStream has no formal ToS and prohibits
  direct browser connections, which would force Durable Objects. The Worker is
  therefore designed purely request-scoped.

---

## Attribution

Eye of Atlas is built on [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)
by Bilawal Sidhu (MIT). See `NOTICE`.
