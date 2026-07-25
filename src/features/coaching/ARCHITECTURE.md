# Coaching & Training Architecture (COACHING-01)

**Status:** Domain + authorization + application services + in-memory repositories + Platform Core adapter + legacy localStorage compatibility. SQL Phase 28 audited (not applied). UI cutover deferred.

## Layers

| Layer | Path |
|-------|------|
| Domain | `domain/` |
| Authorization | `authorization/` |
| Application | `application/` |
| Repository ports + memory | `repositories/` |
| Platform adapter | `platform/` |
| Legacy LS | `services/coachingService.js` |

Import only from `src/features/coaching` (barrel).

See `docs/coaching-training/coaching-01/01_DOMAIN_AUTHORIZATION_FOUNDATION.md`.
