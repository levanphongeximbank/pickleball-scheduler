# NEWS-05 — Module Closure Checklist

## Classification (do not conflate)

| Class | Status | Notes |
|-------|--------|-------|
| **A. MODULE_IMPLEMENTATION_COMPLETE** | **YES** | Code, architecture, tests, Staging integration complete |
| **B. MODULE_PRODUCTION_DEPLOYED** | **NO** | Production inventory = ABSENT; no apply |
| **C. MODULE_100_PERCENT_CLOSED** | **NO (pending)** | Requires post-merge verification + cleanup; Production rollout is **not** required for implementation closure under approved BM scope |

Proposed structural closure marker (after PR merge + cleanup, still Production pending):

`NEWS_PUBLIC_CONTENT_MODULE_IMPLEMENTATION_CLOSED_PRODUCTION_NOT_DEPLOYED`

**Do not** declare this marker before post-merge verification.

## Exit criteria checklist

| # | Criterion | Result |
|---|-----------|--------|
| 1 | NEWS-01…04 lineage retained on `main` ancestor | PASS |
| 2 | Canonical public path enforced | PASS |
| 3 | No silent mock fallback | PASS |
| 4 | Public RPC LIVE-only on Staging | PASS (recert) |
| 5 | Staging fixture residue 0 | PASS |
| 6 | Production read-only inventory completed | PASS (ABSENT) |
| 7 | Production GO/NO-GO recorded without overclaim | PASS (`GO_WITH_CONDITIONS`) |
| 8 | Docs do not claim Production deployed | PASS |
| 9 | package/lockfile unchanged | required gate |
| 10 | Local test matrix PASS | required gate |
| 11 | PR opened, **not** merged by agent | required gate |
| 12 | Post-merge verification + cleanup | **Owner / follow-up** |

## Closure conditions (when allowed)

Implementation closure may be proposed only when:

1. NEWS-05 PR merged
2. Post-merge CI / smoke verification PASS
3. Evidence dirs cleaned of accidental secret commits (none expected; gitignored)
4. Docs still state Production not deployed unless a later Production apply workstream succeeds

Production deployment closure requires a **separate** Owner-GO apply + verify workstream.

## Explicit exclusions retained

- CMS authoring UI
- Media upload pipeline
- Scheduler / publish worker
- Permanent role matrix seed beyond `news.*` permission catalog
- Claiming `/news` Production live content before apply

## Production untouched

Confirmed for NEWS-05: no Production SQL apply, no fixtures, no write RPC, no mutating Management API calls beyond read-only SELECT inventory.
