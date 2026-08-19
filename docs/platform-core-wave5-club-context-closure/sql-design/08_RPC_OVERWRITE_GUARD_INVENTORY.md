# Wave 5 — CREATE OR REPLACE overwrite guard inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
```

`pg_get_functiondef` is **validation only**. Exact `md5(pg_get_functiondef(...))` is **not** the primary gate: pretty-print is not guaranteed stable across PostgreSQL minor versions. Gate = exact signature + overload_count=1 + certified semantic markers. Unknown/newer body → `WAVE5_APPLY_ABORT_RPC_BODY_DRIFT` (no overwrite).

`APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT=13`

| FUNCTION | EXACT_SIGNATURE | CLASS | IF_ABSENT | IF_PRESENT_UNKNOWN_BODY | CERTIFIED_MARKERS |
|---|---|---|---|---|---|
| `platform_is_canonical_tenant_entitled` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | `tenant_members`, `phase42_is_platform_super_admin` |
| `wave5_resolve_club_facility_venue_id` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | `registered_cluster_id`, `REGISTERED_CLUSTER_TENANT_MISMATCH` |
| `wave5_ensure_athlete_for_club_member` | `(uuid, text, text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | `ATHLETE_FACILITY_VENUE_REQUIRED`, `wave5_resolve_club_facility_venue_id` |
| `phase42_club_canonical` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT signature | ABORT body | `clubs`, `tenant_id` |
| `club_create` | `(uuid, text, text, text, text, text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `phase42_idempotency`, `clubs`, `p_tenant_id` |
| `club_list_registry` | `(text, boolean)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `phase42_club_canonical`, `clubs` |
| `club_list_members` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `club_members` |
| `phase42_can_update_club` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `clubs` |
| `phase42_can_assign_club_owner` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `clubs` |
| `phase42_can_transfer_president` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `clubs` |
| `club_add_member` | `(uuid, text, uuid, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `phase42_can_review_membership`, `club_members`, `phase42_idempotency` + athlete ensure (`wave5_ensure_athlete_for_club_member` OR `phase42n_ensure_athlete_for_user`) |
| `club_restore_member` | `(uuid, text, uuid, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `phase42_can_review_membership`, `club_members` |
| `club_review_membership_request` | `(uuid, uuid, text, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | `club_membership_requests_v42`, `VERSION_CONFLICT` |

`EXISTING_FUNCTION_SIGNATURE_ONLY_NOT_ENOUGH=YES` — `to_regprocedure` alone does not authorize overwrite.

`EXISTING_RPC_OVERWRITE_GUARD_COUNT=10`  
`NEW_WAVE5_FUNCTION_GUARD_COUNT=3`
