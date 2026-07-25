# COACHING-02 — Executive Summary

**Status:** AUTHORED + LOCAL CERTIFICATION ONLY  
**Does not apply SQL. Does not cut over UI. Does not remove localStorage.**

## Objective

Author durable persistence adapter, canonical SQL schema, RLS authorization package, rollback, and verification contracts for Coaching & Training — implementing COACHING-01 repository ports against injectable Supabase-like clients.

## Canonical package location

`docs/coaching-training/coaching-02/`

| File | Role |
|------|------|
| `01_DURABLE_PERSISTENCE_ARCHITECTURE.md` | Ownership + adapter design |
| `02_PHASE_28_DRIFT_AND_DISPOSITION.md` | Phase 28 drift matrix |
| `03_RLS_AND_AUTHORIZATION_DESIGN.md` | Fail-closed RLS |
| `04_IDENTITY_PERMISSION_HANDOFF.md` | 14 action → Identity ids |
| `10_COACHING_02_TABLES.sql` | Forward schema |
| `15_COACHING_02_PERMISSION_SEED.sql` | Catalog seed (no role grants) |
| `20_COACHING_02_INDEXES.sql` | Tenant/club indexes |
| `30_COACHING_02_RLS.sql` | ENABLE/FORCE + policies |
| `40_COACHING_02_ATTENDANCE_CORRECTION_RPC.sql` | Atomic correction |
| `45_COACHING_02_ENTITLEMENT_CONSUME_RPC.sql` | Atomic consume |
| `50_COACHING_02_GRANTS.sql` | Fail-closed grants |
| `60_COACHING_02_IMMUTABLE.sql` | Append-only triggers |
| `90_COACHING_02_ROLLBACK.sql` | Down migration |
| `99_COACHING_02_VERIFICATION.sql` | Read-only readiness |

## Adapter

`src/features/coaching/persistence/` — injectable `CoachingDatabaseClientPort`. **Not** the runtime default. UI remains on legacy `coachingService` / localStorage until COACHING-04.

## Mirror convention

CUSTOMER-03 numbered SQL pack + durable repository via database client port.
