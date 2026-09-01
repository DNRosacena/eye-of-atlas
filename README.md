# Eye of Atlas

> **The world. Right now.**
> An interactive, AI-powered window into what is happening around Earth.

A fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by
Bilawal Sidhu (MIT), being reshaped into a commercially clean, shareable,
search-discoverable consumer product.

**Status: Stage 0 — foundation.** The audit is done and the data sources that
cannot be used in a monetised product have been removed. Product work starts in
Stage 1.

---

## How this differs from God's Eye View

Upstream is a spy-satellite simulator for builders and tinkerers, and it is
excellent at that. Eye of Atlas is aimed at a different person: someone who
lands from a search result or a shared link, stays because it is mesmerising,
and shares it because that takes one tap.

That difference drives every change:

| | God's Eye View | Eye of Atlas |
|---|---|---|
| Audience | Builders, OSINT enthusiasts | General public arriving from search or a shared link |
| Data sources | Everything interesting | **Only what is licensed for commercial use** |
| AI | OpenAI Realtime voice, 28 tools | Text-only "Ask Atlas" on Gemini (Stage 3) |
| Hosting | Run locally; the dev server brokers keys | Static site on Cloudflare Pages + a small Worker |
| Discovery | GitHub, YouTube | Pre-rendered SEO routes, share links with previews |

**What we removed, and why.** Four sources are incompatible with an
ad-supported product. This was not a preference:

- **OpenSky** — non-commercial licence that explicitly prohibits
  *"advertisements on web pages/applications using the API."* Flights now come
  from **adsb.lol** (ODbL), which is regional rather than global — a real
  trade-off, surfaced honestly in the UI.
- **TeleGeography submarine cables** — CC BY-NC-SA 3.0 (NonCommercial).
- **Google News RSS** — personal use only; explicitly forbids using it *"to
  increase traffic to your Web site for commercial reasons, such as
  advertising sales."*
- **Open-Meteo's free API** — forbids ad-supported use. Weather is cut from the
  MVP rather than paid for.

Full reasoning, licences, attribution strings and provider rules:
**[`COMMERCIAL_COMPLIANCE.md`](COMMERCIAL_COMPLIANCE.md)**.

---

## Quick start

Requires **Node 24.14+**. Upstream's keyless boot means no API key is needed to
get a globe on screen.

```bash
npm install
npm run doctor      # setup policy checks
npm run dev         # http://localhost:4173
```

The API proxy Worker is a separate package:

```bash
cd workers/api-proxy
npm ci
npm test            # 22 tests — no network, no Cloudflare account needed
npx wrangler dev    # http://localhost:8787
```

Copy `.env.example` to `.env` for keys. **`.env` is gitignored and must never
be committed.** Every variable is documented there, including which two keys
are client-exposed by design and which stay server-side.

---

## Architecture

Static frontend, no database, and a deliberately small request-scoped Worker.

```
Browser (CesiumJS globe, URL-encoded view state)
   │
   ├── direct ──▶ USGS earthquakes (public domain, keyless)
   │              Google 3D Tiles (key is a public token by design)
   │
   └── /api/* ──▶ Cloudflare Worker
                    • brokers secrets (FIRMS, Geocoding, later Gemini)
                    • enforces provider cache windows and rate ceilings
                    • per-source daily budget caps → graceful "layer paused"
```

The Worker exists for two reasons that are worth separating. It hides keys that
must not reach the browser — but it also enforces provider rules a browser
cannot be trusted with. CelesTrak is the clearest case: it IP-blocks clients
that ignore non-200 responses, so without a shared 6-hour cache we would get
the Cloudflare edge IP blocked and break satellites for everyone.

**Google 3D Tiles are deliberately not proxied.** Renderer-originating tile
requests are not billable — only root tileset queries are — so proxying would
push the unbillable bulk through a 100k/day free tier for no benefit. Spend is
capped at Google's own quota layer instead, which is a hard cap rather than a
best-effort counter. Reasoning in
[`docs/STAGE0-CHANGE-PLAN.md`](docs/STAGE0-CHANGE-PLAN.md) §3.1.

**Deployment:** Cloudflare Pages, whose free tier permits commercial use with
unlimited bandwidth. **Vercel is excluded** — its Hobby tier is non-commercial,
so running ads there would breach the terms.

---

## The documents that matter

Read these before changing anything:

- **[`COMMERCIAL_COMPLIANCE.md`](COMMERCIAL_COMPLIANCE.md)** — every data
  source, its licence, its commercial class, the exact attribution string it
  requires, and the rate/cache rules we are bound by. Adding a data source
  means updating this file.
- **[`docs/GEV-INSPECTION.md`](docs/GEV-INSPECTION.md)** — what the upstream
  codebase actually is, as distinct from what its README claims.
- **[`docs/STAGE0-CHANGE-PLAN.md`](docs/STAGE0-CHANGE-PLAN.md)** — the approved
  plan for the cleanup, the Worker, and deployment.
- **[`DATA_SOURCES.md`](DATA_SOURCES.md)** — inherited from upstream and kept
  current; the per-source provenance index.

---

## Ground rules

- **Data licensing is not negotiable.** Do not reintroduce a removed source
  without a written commercial licence. CI fails the build if one reappears.
- **Attribution is a licence condition, not a courtesy.** Every source's credit
  stays visible while its data is shown. Google additionally requires that its
  logo is never overlapped or obscured — which constrains where ads may go.
- **Never commit secrets.** Keep `.env.example` current when keys change.
- **Every metered call sits behind a daily budget cap.**
- **Graceful degradation is a requirement**, not a nice-to-have: the globe must
  work with AI off and with any single layer unavailable.

## Open decisions

- ~~The P0 low-cost imagery fallback has no confirmed licensed source.~~
  **Resolved:** Esri World Imagery via **ArcGIS Location Platform** (commercial
  deployment licence, 2M basemap tiles/month free). Set `ARCGIS_API_KEY`;
  without it the app falls back to OSM, which is fine for development but not
  licensed for production traffic.
- Google 3D Tiles billing is understood from published documentation, not from
  observed billing. It needs confirming before we rely on it.

## Contributing upstream

Fixes that are not specific to our commercial constraints belong upstream in
God's Eye View. Please send them there as well — it is the better home for
them, and this project exists because that one is open.

## Licence

MIT — see [`LICENSE`](LICENSE), which carries both copyright lines, and
[`NOTICE`](NOTICE).

**Neither covers the data.** Every source carries its own licence and
attribution obligation: see
[`COMMERCIAL_COMPLIANCE.md`](COMMERCIAL_COMPLIANCE.md).
