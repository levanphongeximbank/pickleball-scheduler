# 08 — Cross-Tenant Authorization QA

**Status:** **NOT EXECUTED** (live) — identity-bound plan prepared; marker unset
**Superseding plan:** `docs/crm/phase-1h-b/08_IDENTITY_BOUND_LIVE_QA.md`
**Identity inventory:** `docs/crm/phase-1h-b/10_STAGING_QA_IDENTITY_MATRIX.md`
**QA identities:** reusable Staging pool audited; Owner attestation still required (`CRM_STAGING_QA_IDENTITIES_READY` unset)
**Personal accounts:** not used

## Planned matrix (from Phase 1H-A design)

| Scenario | Result |
|----------|--------|
| SUPER_ADMIN approved access | DEFERRED |
| Owner/manager approved access | DEFERRED |
| Restricted STAFF behavior | DEFERRED |
| PLAYER denied CRM administration | DEFERRED |
| CUSTOMER denied CRM administration | DEFERRED |
| Unauthenticated denied | DEFERRED |
| Missing tenant denied | DEFERRED |
| Missing venue denied | DEFERRED |
| Cross-tenant read/insert/update/delete denied | DEFERRED |
| Same-tenant approved operation succeeds | DEFERRED |
| Permission removal causes denial | DEFERRED |
| Permission grant causes approved access | DEFERRED |

## Credential hygiene

No passwords, JWTs, refresh tokens, or key values printed in this evidence pack.
