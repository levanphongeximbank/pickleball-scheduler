# Coaching & Training Architecture

**Status:** COACHING-01 domain foundation + COACHING-02 durable persistence authored (not applied, not runtime-default).

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

SQL authored under `docs/coaching-training/coaching-02/` — **do not apply** in COACHING-02.
Phase 28 (`docs/v5/PHASE_28_COACHING.sql`) is **not** the canonical apply source.
