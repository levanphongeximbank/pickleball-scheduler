# 05 — Pending Event RPC Certification (Phase 1H-A)

**Status:** CERTIFIED (static). No SQL applied. No live DB.

Source: `docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql`, `50_CRM_PHASE_1G_GRANTS.sql`

## `crm_claim_pending_events`

| Rule | Result |
|------|--------|
| Explicit `search_path` | PASS — `public, pg_temp` |
| Scope parameters validated | PASS — non-empty + `crm_phase1g_scope_allows` |
| `worker_id` validated | PASS — non-empty |
| `claim_limit` bounded | PASS — 1..100 |
| TTL bounded | PASS — 1..3600 seconds |
| `FOR UPDATE SKIP LOCKED` | PASS |
| Deterministic ordering | PASS — `available_at, created_at, pending_event_id` |
| Attempt count increments once | PASS — `attempt_count + 1` in claim UPDATE |
| Claim ownership preserved | PASS — sets `claimed_by` |
| No auto-acknowledgement | PASS |
| No provider delivery | PASS |
| No PUBLIC execution | PASS — REVOKE PUBLIC/anon; GRANT authenticated |
| SECURITY DEFINER hardened | PASS — search_path + scope + permission |
| Cannot claim other tenant/venue | PASS — scope gate + WHERE tenant/venue |

## `crm_release_expired_pending_event_claims`

| Rule | Result |
|------|--------|
| Explicit `search_path` | PASS |
| Scope validated | PASS |
| Permission gated | PASS — `crm.audit.view` / super-admin |
| `SKIP LOCKED` | PASS |
| Deterministic ordering | PASS |
| Preserves `attempt_count` | PASS — not modified in SET |
| Clears claim fields only | PASS |
| No ack / fail / delivery | PASS |
| No PUBLIC execution | PASS |

## Function owner / grants (documented)

- Owner: migration role / table owner at apply time (document in Staging evidence).
- Grants: `EXECUTE` to `authenticated` only; RLS/scope still enforced inside SECURITY DEFINER via helpers.

Static tests in `tests/crm-phase-1h-staging-readiness.test.js` assert SQL text rules.
