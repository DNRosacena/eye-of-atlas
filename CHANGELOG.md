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

#### Notes
- **Nothing from the Stage 0 change plan has been implemented yet.** No Class-D
  source has been removed and no application logic has been modified. Parts A,
  B and C of the change plan are approved but unimplemented.
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
