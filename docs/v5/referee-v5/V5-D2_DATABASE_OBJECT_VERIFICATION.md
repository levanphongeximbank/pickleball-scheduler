# V5-D.2 — Database Object Verification

**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Method:** MCP `execute_sql` + `verify-phase-v5d2-staging.mjs`

---

## Table verification

| Object | Exists | RLS | Constraints | Indexes | Trigger | PASS |
|--------|-------:|----:|------------:|--------:|--------:|-----:|
| `referee_assignments` | ✅ | ✅ | ✅ PK, status check, expiry/revoke order | ✅ active partial, tenant_user | — | ✅ |
| `match_live_states` | ✅ | ✅ | ✅ PK, status check | ✅ tournament | — | ✅ |
| `match_events` | ✅ | ✅ | ✅ PK, sequence unique, idempotency partial | ✅ replay, match | ✅ append-only ×2 | ✅ |
| `match_sync_mutations` | ✅ | ✅ | ✅ idempotency unique | ✅ | — | ✅ |
| `match_result_revisions` | ✅ | ✅ | ✅ revision unique | — | — | ✅ |
| `match_integration_outbox` | ✅ | ✅ | ✅ event_type check, idempotency unique | ✅ pending partial | — | ✅ |

---

## SECURITY DEFINER functions

| Function | SECURITY DEFINER | Fixed search_path | PUBLIC revoked | anon revoked | authenticated revoked |
|----------|-----------------:|------------------:|---------------:|-------------:|----------------------:|
| `referee_v5_commit_match_transition` | ✅ | ✅ `pg_catalog, public` | ✅ | ✅ | ✅ |
| `referee_v5_commit_match_finalization` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `referee_v5_get_match_state` | ✅ | ✅ `public` | ✅ | — | — (granted read) |
| `referee_v5_apply_match_command` | ✅ | ✅ | ✅ | ✅ | ✅ (revoked V5D1) |
| `referee_v5_current_user_has_assignment` | ✅ | ✅ | — | — | helper |
| `referee_v5_deny_match_events_mutation` | ✅ | ✅ | — | — | trigger fn |

Internal commit RPCs: **only `service_role` + `postgres` have EXECUTE** — verified via staging SQL.

---

## Legacy regression

| Legacy object | Status |
|---------------|--------|
| `tournament_match_live` | Unchanged (table exists) |
| `referee_get_match_by_token` | Unit tests 9/9 PASS |
| `referee_update_match_score` | Unit tests PASS |

---

## Hash note

Database stores `state_hash` / `state_before_hash` / `state_after_hash` from Edge-computed canonical JSON (sorted keys). DB validates structural invariants in commit RPC; does **not** recompute JS hash algorithm in PostgreSQL.

---

## Verdict

**Database objects: PASS**
