# Wave 5 — CREATE OR REPLACE overwrite guard inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES
APPROVED_FINGERPRINT_SOURCE=AUTHORITATIVE_REPOSITORY_FUNCTION_BODY
LIVE_HASH_IS_AUTHORITY=NO
LIVE_HASH_IS_CANONICAL_AUTHORITY=NO
EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10
RPC_EXISTING_CERTIFIED_MATCH_COUNT=8
RPC_EXISTING_OWNER_ACCEPTANCE_REQUIRED_COUNT=0
RPC_OWNER_ACCEPTED_CAPTURED_LIVE_COUNT=2
RPC_PREDECESSOR_EXECUTION_CERTIFIED_COUNT=10
RPC_UNCERTIFIED_COUNT=0
RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=0
NEW_WAVE5_FUNCTION_STRONG_GUARD_COUNT=3
CERTIFICATION_EVIDENCE=08B_RPC_FINGERPRINT_CERTIFICATION.md
```

Gate for existing overwrite candidates (not pretty-print alone):

1. exact signature present
2. overload_count = 1
3. prosecdef
4. proconfig / search_path
5. provolatile
6. function language
7. trusted owner role (`proowner` / role name)
8. pre-APPLY predecessor fingerprint = `md5(convert_to(pg_proc.prosrc, 'UTF8'))` as **APPROVED_PREDECESSOR_PROSRC_MD5**
9. post-APPLY target fingerprint = newline-canonical LF MD5 as **APPROVED_TARGET_PROSRC_MD5**

Eight functions are **CERTIFIED_HISTORICAL_SOURCE_MATCH** (historical source MD5 == Staging live predecessor).
Two (`club_create`, `club_list_registry`) are **OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR** — Owner accepted those exact live predecessor MD5s as pre-cutover current-state evidence. PRE-APPLY still requires exact predecessor fingerprint + owner / SECURITY DEFINER / search_path / volatility / language / overload. POST-APPLY still requires canonical target MD5. Live hash is not canonical target authority. Unknown owner, `UNCERTIFIED` sentinel, predecessor mismatch, or target post-write mismatch → `WAVE5_APPLY_ABORT_RPC_BODY_DRIFT`. Do not `ALTER OWNER` in this package.

`pg_get_functiondef` remains supporting validation only.

`APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT=13`

| FUNCTION | EXACT_SIGNATURE | CLASS | IF_ABSENT | IF_PRESENT_UNKNOWN_BODY | STRONG_IDENTITY | CERTIFICATION |
|---|---|---|---|---|---|---|
| `platform_is_canonical_tenant_entitled` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | signature + overload + prosecdef + search_path + language sql + provolatile + owner + prosrc md5 + privilege state | EXPECTED_ABSENT |
| `wave5_resolve_club_facility_venue_id` | `(text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | same + application-role EXECUTE DENIED | EXPECTED_ABSENT |
| `wave5_ensure_athlete_for_club_member` | `(uuid, text, text)` | NEW_WAVE5_FUNCTION_EXPECTED_ABSENT_OR_CERTIFIED | create OK | ABORT | same + application-role EXECUTE DENIED | EXPECTED_ABSENT |
| `phase42_club_canonical` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT signature | ABORT body | PREDECESSOR=`871ff5136397a42f5c5718179b65aed9` TARGET=`1dccf73c5ee25b96376371e1f89a9dac` owner=`postgres` vol=`s` lang=`plpgsql` | CERTIFIED_MATCH |
| `club_create` | `(uuid, text, text, text, text, text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`cb9669f04a35e9b60242a5d3b18a5b27` TARGET=`e847c5d23e51370fe4ef1360efbaa10a` PRE_APPLY=PREDECESSOR POST_APPLY=TARGET | OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR |
| `club_list_registry` | `(text, boolean)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`214cb6e88de6f2d9d0e55e1f33c6e582` TARGET=`202fef07f6859107971329412b8beb3b` PRE_APPLY=PREDECESSOR POST_APPLY=TARGET | OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR |
| `club_list_members` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`3089518678635910041656a1ae30cacd` TARGET=`a497610e6d2d905fe02b7aa2b67724ea` owner=`postgres` vol=`v` lang=`plpgsql` | CERTIFIED_MATCH |
| `phase42_can_update_club` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`24f9f7e47c2dc0a166c6385811f6c43d` TARGET=`969ce4b24e48632045ae75f4e8b9ca14` owner=`postgres` vol=`s` lang=`sql` | CERTIFIED_MATCH |
| `phase42_can_assign_club_owner` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`509ea5949fa8389edd1c4827e1bf5779` TARGET=`17491a5d3df2b96da44f5bececdb257e` owner=`postgres` vol=`s` lang=`sql` | CERTIFIED_MATCH |
| `phase42_can_transfer_president` | `(text)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`24f9f7e47c2dc0a166c6385811f6c43d` TARGET=`61dd0458b9240d5407394f6f8d492bf0` owner=`postgres` vol=`s` lang=`sql` | CERTIFIED_MATCH |
| `club_add_member` | `(uuid, text, uuid, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`922df1b5d672f70150ae4010bb97bed0` TARGET=`484c609b937c029f03be7cb37fb03005` owner=`postgres` vol=`v` lang=`plpgsql` | CERTIFIED_MATCH |
| `club_restore_member` | `(uuid, text, uuid, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`d24dbfa3f21e674f31ad509c655a7ef6` TARGET=`8391e0fbafc57917bdfcbd9401242c86` owner=`postgres` vol=`v` lang=`plpgsql` | CERTIFIED_MATCH |
| `club_review_membership_request` | `(uuid, uuid, text, text, integer)` | EXISTING_FUNCTION_EXPECTED_CERTIFIED_BODY | ABORT | ABORT | PREDECESSOR=`0b8ee11ef23090f8cd6e364ad2e6eb60` TARGET=`2ef9e0d87071bba93814ab20344539c1` owner=`postgres` vol=`v` lang=`plpgsql` | CERTIFIED_MATCH |

`EXISTING_FUNCTION_SIGNATURE_ONLY_NOT_ENOUGH=YES` — `to_regprocedure` alone does not authorize overwrite.

`EXISTING_RPC_OVERWRITE_GUARD_COUNT=10`  
`NEW_WAVE5_FUNCTION_GUARD_COUNT=3`
