# V5-D.1 — SQL Static Verification

**Date:** 2026-07-12  
**Status:** PASS (manual static review)

---

## Files reviewed

| File | Status |
|------|--------|
| `PHASE_V5A_REFEREE_FOUNDATION.sql` | Prerequisite — DRAFT |
| `PHASE_V5D_REFEREE_PERSISTENCE.sql` | Patches + read RPC — DRAFT |
| `PHASE_V5D1_REFEREE_HARDENING.sql` | Hardening — DRAFT |

## Checks

| Check | Result |
|-------|--------|
| Object dependency order | PASS — V5A → V5D → V5D1 |
| No reference to missing tables (within chain) | PASS |
| Constraint/index names unique in V5-D.1 | PASS |
| Policy names match V5-D (no duplicate create without drop) | PASS — V5-D.1 adds triggers + internal RPCs |
| Function signatures match grants | PASS |
| Rollback references valid objects | PASS — documented in SQL footer |
| Transaction wrapper | PASS — `BEGIN`/`COMMIT` in V5-D.1 |
| No DROP legacy objects | PASS |
| No authenticated write on internal RPCs | PASS — REVOKE + service_role GRANT |
| Append-only triggers | PASS |
| Partial idempotency index removed | PASS — full unique in V5-D.1 |

## Known V5-D diff (superseded)

V5-D created `referee_v5_apply_match_command` granted to `authenticated`. V5-D.1 **revokes** those grants. Staging must apply both files in order.

## Automated parse

`psql`/`supabase db lint` — **NOT RUN** (no staging apply per owner NO-GO).

## Recommended staging apply

Single migration bundle or sequential apply with verification script after owner GO.
