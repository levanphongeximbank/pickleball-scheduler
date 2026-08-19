# Wave 5 — CREATE OR REPLACE overwrite guard inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES
EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10
NEW_WAVE5_FUNCTION_STRONG_GUARD_COUNT=3
```

Gate for existing overwrite candidates (not pretty-print alone):

1. exact signature present
2. overload_count = 1
3. prosecdef
4. proconfig / search_path
5. provolatile
6. function language
7. trusted owner role (`proowner` / role name)
8. approved body fingerprint = `md5(convert_to(pg_proc.prosrc, 'UTF8'))`

Certified fingerprints, volatility, and owner in APPLY are **UNCERTIFIED** until Owner reviews live PRECHECK evidence. Live drift, unknown owner, or UNCERTIFIED → `WAVE5_APPLY_ABORT_RPC_BODY_DRIFT` + `OWNER_REVIEW_REQUIRED` (no overwrite). Do not invent live fingerprints in git. Do not `ALTER OWNER` in this package.

`pg_get_functiondef` remains supporting validation only.

`APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT=13`

| FUNCTION | EXACT_SIGNATURE | CLASS | IF_ABSENT | IF_PRESENT_UNKNOWN_BODY | STRONG_IDENTITY |
|---|---|---|---|---|---|
| `platform_is_canonical_tenant_entitled` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | signature + overload + prosecdef + search_path + language sql + provolatile + owner + prosrc md5 + privilege state |
| `wave5_resolve_club_facility_venue_id` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | same + application-role EXECUTE DENIED |
| `wave5_ensure_athlete_for_club_member` | `(uuid, text, text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | same + application-role EXECUTE DENIED |
| `phase42_club_canonical` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT signature | ABORT body | strong fingerprint required |
| `club_create` | `(uuid, text, text, text, text, text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `club_list_registry` | `(text, boolean)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `club_list_members` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `phase42_can_update_club` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `phase42_can_assign_club_owner` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `phase42_can_transfer_president` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `club_add_member` | `(uuid, text, uuid, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `club_restore_member` | `(uuid, text, uuid, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |
| `club_review_membership_request` | `(uuid, uuid, text, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | strong fingerprint required |

`EXISTING_FUNCTION_SIGNATURE_ONLY_NOT_ENOUGH=YES` — `to_regprocedure` alone does not authorize overwrite.

`EXISTING_RPC_OVERWRITE_GUARD_COUNT=10`  
`NEW_WAVE5_FUNCTION_GUARD_COUNT=3`
