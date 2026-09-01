## What & why

<!-- What changed, and the reason. Link the stage/task from the master plan. -->

## Files touched

<!-- Key files, with a one-line note each. -->

## Verification

- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Tested in a browser (desktop **and** mobile viewport)

## Compliance checklist

<!-- Master plan §28.4. Delete any line that genuinely does not apply. -->

- [ ] **No secrets committed.** `.env.example` updated if a key was added or removed
- [ ] **No Class-D data source** added or reintroduced (see `COMMERCIAL_COMPLIANCE.md`)
- [ ] **Attribution intact** for every data source touched — this is a licence
      condition, not a courtesy
- [ ] Any new metered/keyed call goes through the Worker **behind a daily budget cap**
- [ ] Provider cache/rate rules respected (and **no caching of Google content**)
- [ ] All URL-state and any AI-returned actions are validated and clamped
- [ ] `CHANGELOG.md` updated
- [ ] `COMMERCIAL_COMPLIANCE.md` updated if a data source changed

## Graceful degradation

- [ ] Works with AI disabled
- [ ] Works with this layer / feature unavailable

## Risks & rollback

<!-- What could break, and how to undo it. -->
