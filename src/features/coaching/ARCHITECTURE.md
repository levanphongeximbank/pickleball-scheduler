# Coaching & Training Architecture

**Status:** COACHING-01 domain foundation + COACHING-02 durable persistence authored (not applied, not runtime-default). COACHING-03 Staging activation package authored (preflight/package only; Owner GO not granted; SQL not applied). COACHING-04 assignment-aware RLS/RPCs + UI cutover / localStorage retirement plans authored (`docs/coaching-training/coaching-04/`); **defaults still off** (`COACHING_DURABLE_RUNTIME_DEFAULT=false`, `LOCALSTORAGE_RETIRED=false`); PLAYER self-scope mapping blocked.

## Layers

| Layer | Path |
|-------|------|
| Domain | `domain/` |
| Authorization | `authorization/` |
| Application | `application/` |
| Repository ports + memory | `repositories/` |
| Durable persistence (COACHING-02) | `persistence/` — injectable; **not** runtime default |
| Platform adapter | `platform/` |
| Legacy LS | `services/coachingService.js` |

Import only from `src/features/coaching` (barrel).

## Docs

- COACHING-01: `docs/coaching-training/coaching-01/01_DOMAIN_AUTHORIZATION_FOUNDATION.md`
- COACHING-02: `docs/coaching-training/coaching-02/`
- COACHING-03: `docs/coaching-training/coaching-03/` (guarded Staging activation; Gate C Owner GO required before apply)
- COACHING-04: `docs/coaching-training/coaching-04/` (assignment helpers/RLS/RPCs + cutover plans; authored only; do not apply / do not flip runtime defaults)

SQL authored under `docs/coaching-training/coaching-02/` — **do not apply** without COACHING-03 Owner GO.
COACHING-04 SQL is additive on top of COACHING-02 — **do not apply** without separate Owner GO; does not grant `coaching.records.read` to COACH; does not author PLAYER mapping helpers.
Phase 28 (`docs/v5/PHASE_28_COACHING.sql`) is **not** the canonical apply source.
Staging helpers: `src/features/coaching/staging/` + `scripts/coaching/` — default apply mode REFUSED.
