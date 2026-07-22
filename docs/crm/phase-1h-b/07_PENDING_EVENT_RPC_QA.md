# 07 — Pending Event RPC QA

**Status:** **STRUCTURAL PASS** / **BEHAVIORAL DEFERRED** (QA identities missing)
**External provider delivery:** not triggered (workers not enabled)
**Staging project ref:** `qyewbxjsiiyufanzcjcq`

## Live structural RPC evidence

| Check | Result |
|-------|--------|
| `crm_claim_pending_events` exists | **PASS** |
| `crm_release_expired_pending_event_claims` exists | **PASS** |
| SECURITY DEFINER | **PASS** (both) |
| Explicit `search_path=public, pg_temp` | **PASS** (both) |
| `FOR UPDATE … SKIP LOCKED` present in claim body | **PASS** |
| EXECUTE granted to `authenticated` | **PASS** |
| EXECUTE for PUBLIC/anon on claim/release | **PASS** (none) |
| Scope gate uses `crm_phase1g_scope_allows` | **PASS** (definition) |
| Permission gate uses `crm.audit.view` / `is_super_admin` | **PASS** (definition) |

## Claim / release behavioral checklist (requires QA identities)

| Check | Result |
|-------|--------|
| Bounded claim limit | DEFERRED |
| Deterministic claim order | DEFERRED |
| No double claim under concurrency | DEFERRED |
| Claim owner recorded | DEFERRED |
| Claim expiry recorded | DEFERRED |
| attempt_count increments once | DEFERRED |
| Release only expired claims | DEFERRED |
| Release clears ownership | DEFERRED |
| Release preserves attempt_count | DEFERRED |
| Release does not acknowledge / fail | DEFERRED |
| Cross-tenant claim denied | DEFERRED |
| Unauthorized caller denied | DEFERRED |

## Static certification retained

`docs/crm/phase-1h/05_PENDING_EVENT_RPC_CERTIFICATION.md`

## Blocker

`CRM_STAGING_QA_IDENTITIES_READY` unset — identity-bound claim/release QA cannot run yet.
