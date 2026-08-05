# Tournament Test Plan

**Status:** IMPLEMENTATION-READY — not executed  
**Audit date:** 2026-08-05  
**Commit-gate correction:** 2026-08-05 — aligned to WP1–WP8  
**Production GO:** NO  

**Live evidence:** Staging fixtures must use clubs with explicit tenant (mirror ACCC `venue-prod-main`); do not rely on Production cloud blob containing Owner IDs.

## Sequencing rules (same as remediation plan)

- HIDING_THE_MISSING_TENANT_BANNER_IS_NOT_A_VALID_FIRST_REMEDIATION
- LOCAL_BROWSER_TOURNAMENT_PRESERVATION_PRECEDES_RUNTIME_CHANGES
- PRODUCTION_DATA_MIGRATION_REQUIRES_SEPARATE_OWNER_GO

## Tests by work package (WP1 → WP8)

### WP1 — Preserve and export browser-local tournaments

| ID | Case | Expected |
|----|------|----------|
| T-WP1a | Inventory three Owner local tournament objects | IDs listed; payloads present |
| T-WP1b | Full payload export | Definitions, participants, teams, settings, referee, schedules, draws, results, related IDs |
| T-WP1c | Checksum + rollback copy | SHA-256 recorded; copy retained |
| T-WP1d | Browser storage | **Not** cleared |
| T-WP1e | Migration gate | Migration blocked until export verification passes |

### WP2 — Establish cloud tournament durable authority

| ID | Case | Expected |
|----|------|----------|
| T-WP2a | Canonical tables/RPCs/services selected | Documented ownership |
| T-WP2b | tenant_id / club_id / venue_id | Ownership defined; no default-tenant SSOT |
| T-WP2c | Single durable writer / reader | One writer authority; one reader authority |
| T-WP2d | localStorage as Production SSOT | Removed |
| T-WP2e | Reload + cross-device | Persistence verified |

### WP3 — Migrate or reconcile local-only tournaments

| ID | Case | Expected |
|----|------|----------|
| T-WP3a | Local → cloud ID map | Stable mapping |
| T-WP3b | Relationships preserved | Participants/teams/draws intact |
| T-WP3c | Duplicate prevention | No double insert |
| T-WP3d | Dry-run | Pass before any Production write |
| T-WP3e | Separate Owner Production mutation GO | Required; audit GO remains NO until granted |

### WP4 — Propagate tenant, club, venue scope

| ID | Case | Expected |
|----|------|----------|
| T-WP4a | `resolveTournamentPageScope` with tournament.tenantId | Canonical tenant |
| T-WP4b | Club without tenant | null, not default-tenant |
| T-WP4c | Daily / Internal / Official / Team | tenantId passed into pairing/registration |
| T-WP4d | Missing scope | Mutation controls disabled |
| T-WP4e | UI vs backend | Scope validation agree |

### WP5 — Eliminate dual writers and dual readers

| ID | Case | Expected |
|----|------|----------|
| T-WP5a | Dual-writer conflicts | DW-01..DW-03 resolved (count = array length) |
| T-WP5b | Dual-reader conflicts | 4 resolved |
| T-WP5c | localStorage/mock/fallback Production authority | LMF-01..LMF-03 removed or explicit adapters only |
| T-WP5d | Compatibility | Explicit adapters only |

### WP6 — Controlled legacy route migration

| ID | Case | Expected |
|----|------|----------|
| T-WP6a | `/tournament/internal/:id` | Controlled redirect to `/tournaments/:id/*` after dependency proof |
| T-WP6b | Query params / deep links / public links | Preserved |
| T-WP6c | Independent legacy runtime | Removed |
| T-WP6d | Dual active menus | Prevented |

### WP7 — RBAC and tenant isolation

| ID | Case | Expected |
|----|------|----------|
| T-WP7a | SUPER_ADMIN / CLUB_OWNER / CLUB_MANAGER / REFEREE / PLAYER | Role matrix enforced |
| T-WP7b | Cross-tenant | Denied |
| T-WP7c | Unauthorized read/write | Denied |
| T-WP7d | Backend enforcement | Independent of frontend guards |

### WP8 — Production-safe rollout and rollback

| ID | Case | Expected |
|----|------|----------|
| T-WP8a | Local export verified | WP1 gate green |
| T-WP8b | Cloud migration dry-run | WP3 gate green |
| T-WP8c | Separate Owner Production mutation GO | Present before Production writes |
| T-WP8d | Post-deploy persistence + cross-browser | Pass |
| T-WP8e | Rollback / forward-fix conditions | Documented and tested |

## Defect regression (after WP4–WP6 on staging)

Replay owner-observed routes on staging with SUPER_ADMIN:

- `/tournament/daily/tournament-1785921300822` (or staging equivalent)
- `/tournament/internal/tournament-1785921409840`
- `/tournament/official/tournament-1785921550968`

Expected: No TP-UI-001/002/003 errors from missing scope; pairing controls operational or fail-closed with disabled UI — **not** by hiding the banner alone.

## TP-UI-005 — Gender display (dependency)

| ID | Case | Expected |
|----|------|----------|
| T-GENDERA | Player list render | Normalized gender labels only |
| T-GENDERB | Mixed-doubles filter | Uses canonical gender enum |

Do not merge wider gender schema work into Tournament sprint.

## Evidence contract (CI)

`node --test tests/tournament-production-remediation-evidence.test.js`

## Production read-only smoke (post-remediation)

- Navigate defect routes in read-only mode (no mutation clicks)
- Capture screenshots for evidence package (local-only / redacted policy)
- Zero unauthorized Production mutations logged

## Test data

- Staging clubs with explicit tenantId (not default-tenant)
- WP1 export archives as golden fixtures for migration dry-run
