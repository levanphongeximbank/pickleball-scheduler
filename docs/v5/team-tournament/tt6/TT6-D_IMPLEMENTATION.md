# TT-6D — Multi-device + Observability Hardening

**Date:** 2026-07-13  
**Branch:** `feature/tt6d-multi-device-observability`  
**Base:** `feature/competition-core-standardization` @ PR #6 merge (`1d129e9`)  
**Production:** UNTOUCHED

---

## Scope (deferred from TT-6C)

| Area | Deliverable |
|------|-------------|
| Multi-device Preview E2E | `scripts/verify-phase-tt6d-multi-device-preview.mjs` — 5 isolated Playwright contexts |
| Shared browser harness | `scripts/lib/tt6-preview-browser-harness.mjs` |
| Observability hardening | `realtimeDebugFlags.js`, `configureRealtimeObservabilityDebug()` |
| Staging gates | `scripts/verify-phase-tt6d-staging.mjs` |
| Unit tests | `tests/team-tournament-tt6d.test.js` |

---

## Device profiles (5 contexts)

| Profile | Default email | Route |
|---------|---------------|-------|
| BTC A | `owner@staging.local` | `/tournament/team/{id}` |
| BTC B | `owner-b@staging.local` | `/tournament/team/{id}` |
| Captain A | `player@staging.local` | `/team-portal/{id}` |
| Captain B | `club@staging.local` | `/team-portal/{id}` |

Password resolution (harness): `owner-b@staging.local` → `STAGING_OWNER_B_PASSWORD` or `STAGING_NON_COHORT_NEW_PASSWORD`; `club@staging.local` → `STAGING_CLUB_PASSWORD` or default QA password; `player@staging.local` → `STAGING_PLAYER_NEW_PASSWORD`.
| Referee V5 desk | `owner@staging.local` | `/team-referee/{id}` |

Probe tournament: `phase23d-probe-tournament` (`tests/fixtures/team-tournament-blob-probe.json`).

---

## Flags

| Flag | Default | Effect |
|------|---------|--------|
| `VITE_TT_REALTIME_ENABLED` | `false` | Unchanged from TT-6B/C |
| `VITE_TT_REALTIME_DEBUG` | `false` | Enables safe structured debug logs (no payload/JWT) |

---

## Verification

```bash
node --test tests/team-tournament-tt6d.test.js
node scripts/verify-phase-tt6d-staging.mjs
STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt6d-multi-device-preview.mjs
```

Evidence: `docs/v5/qa-evidence/phase-tt6/TT6D_*.json`

---

## Not in TT-6D

- Production deploy / SQL apply
- Offline queue production rollout
- DreamBreaker realtime
- TT-7+ feature work

---

## Rollback

Set `VITE_TT_REALTIME_DEBUG=false`. Multi-device harness is CI-only — no runtime impact when flag off.
