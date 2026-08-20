# Wave 5 — RPC predecessor / target fingerprint certification

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
APPROVED_FINGERPRINT_SOURCE=AUTHORITATIVE_REPOSITORY_FUNCTION_BODY
LIVE_HASH_IS_AUTHORITY=NO
LIVE_HASH_IS_CANONICAL_AUTHORITY=NO
REPO_CANONICAL_SOURCE_IS_AUTHORITY=YES
LIVE_SOURCE_CAPTURE_IS_CANONICAL_AUTHORITY=NO
STATIC_PROSRC_EXTRACTION=DETERMINISTIC_LOCAL_EXTRACTOR
HASH_METHOD=md5(convert_to(pg_proc.prosrc, 'UTF8'))_EQUIVALENT
PREDECESSOR_AND_TARGET_FINGERPRINTS_DISTINCTLY_NAMED=YES
PRE_APPLY_GUARD=PREDECESSOR
PRE_APPLY_GUARD_USES_PREDECESSOR=YES
POST_APPLY_VERIFY=TARGET
POST_APPLY_VERIFY_USES_TARGET=YES
OWNER_ACCEPTANCE_DOES_NOT_DISABLE_DRIFT_GUARD=YES
OWNER_ACCEPTANCE_IS_PREDECESSOR_ACCEPTANCE_ONLY=YES
CANONICAL_TARGET_AUTHORITY_CHANGED=NO
STAGING_PROJECT=qyewbxjsiiyufanzcjcq
STAGING_READ_ONLY_FINGERPRINT_RECHECK=PASS_UNCHANGED
RPC_EXISTING_REQUIRED_COUNT=10
RPC_EXISTING_CERTIFIED_MATCH_COUNT=8
RPC_HISTORICAL_SOURCE_CERTIFIED_COUNT=8
RPC_EXISTING_OWNER_ACCEPTANCE_REQUIRED_COUNT=0
RPC_OWNER_ACCEPTED_CAPTURED_LIVE_COUNT=2
RPC_PREDECESSOR_EXECUTION_CERTIFIED_COUNT=10
RPC_UNCERTIFIED_COUNT=0
RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=0
RPC_NEW_EXPECTED_ABSENT_COUNT=3
RPC_NEW_LIVE_PRESENT_COUNT=0
EXPECTED_ABSENT=PASS
WAVE5_APPLY_READINESS_ALL_10_CERTIFIED_MATCH=NO
STAGING_CUTOVER_DESIGN_READY=YES
STAGING_CUTOVER_EXECUTION_AUTHORIZED=NO
STAGING_CUTOVER_EXECUTION_READY=NO_PENDING_OWNER_STAGING_CUTOVER_EXECUTION_GO
HISTORICAL_SOURCE_NOT_FOUND=YES
OWNER_ACCEPTANCE_REQUIRED=NO
OWNER_ACCEPTED=YES
Q0_EXECUTED=NO
Q1_EXECUTED=NO
TENANT_CUTOVER_APPLY_EXECUTED=NO
STAGING_QUERIED_IN_THIS_PHASE=NO
STAGING_MUTATED_IN_THIS_PHASE=NO
```

Predecessor classification for each function is exactly one of:

`CERTIFIED_HISTORICAL_SOURCE_MATCH` |
`CERTIFIED_DEPLOYMENT_ARTIFACT_MATCH` |
`OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR` |
`OWNER_ACCEPTANCE_REQUIRED_CAPTURED_LIVE_EQUIVALENT` |
`BLOCKED_SEMANTIC_DIFFERENCE` |
`BLOCKED_SECURITY_DIFFERENCE` |
`BLOCKED_DATA_INTEGRITY_DIFFERENCE` |
`BLOCKED_UNKNOWN_PROVENANCE`

Do not invent another vague status. The two live-only RPCs are `OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR`. That is predecessor-acceptance only — not canonical-source authority.

## Two-state model

```
CURRENT_CERTIFIED_PREDECESSOR
        |
        | guarded CREATE OR REPLACE
        v
TARGET_CANONICAL_SOURCE
```

`CERTIFIED_PREDECESSOR` is **not** required to equal `TARGET_CANONICAL_SOURCE`.

| Name | Meaning | Used when |
|---|---|---|
| `APPROVED_PREDECESSOR_PROSRC_MD5` | Exact live Staging `md5(convert_to(pg_proc.prosrc,'UTF8'))` that APPLY must observe **before** overwrite | PRE-APPLY guard |
| `APPROVED_TARGET_PROSRC_MD5` | Newline-canonical LF MD5 of the Wave5 `02_APPLY_DESIGN.sql` CREATE body | POST-APPLY verify |
| Lineage 42G/42C source MD5 | Last repository CREATE that the live body semantically follows | Predecessor comparison only |

Never write `APPROVED_CANONICAL_MD5=<live predecessor md5>` unless the Wave5 APPLY body independently hashes to that value. It does not, for any of the 10 existing RPCs.

Extractor: `scripts/wave5-rpc-prosrc-fingerprint.mjs`.

Git blobs are LF. Eight historically certified functions store CRLF on Staging. The two live-only predecessors store LF (`cr_count=0`). Predecessor guards compare **exact stored bytes**. Target verify newline-canonicalizes `\r\n`/`\r` → `\n` then MD5.

## Certification set (exactly 10) — predecessor vs target

| APPROVED_SIGNATURE | PREDECESSOR_AUTHORITY | APPROVED_PREDECESSOR_PROSRC_MD5 | TARGET_SOURCE | APPROVED_TARGET_PROSRC_MD5 | PRE_APPLY_GUARD | POST_APPLY_VERIFY | STATUS |
|---|---|---|---|---|---|---|---|
| `public.phase42_club_canonical(text)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `871ff5136397a42f5c5718179b65aed9` | `02_APPLY_DESIGN.sql` | `1dccf73c5ee25b96376371e1f89a9dac` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.club_create(uuid,text,text,text,text,text)` | OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR | `cb9669f04a35e9b60242a5d3b18a5b27` | `02_APPLY_DESIGN.sql` | `e847c5d23e51370fe4ef1360efbaa10a` | PREDECESSOR | TARGET | EXECUTION_CERTIFIED |
| `public.club_list_registry(text,boolean)` | OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR | `214cb6e88de6f2d9d0e55e1f33c6e582` | `02_APPLY_DESIGN.sql` | `202fef07f6859107971329412b8beb3b` | PREDECESSOR | TARGET | EXECUTION_CERTIFIED |
| `public.club_list_members(text)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `3089518678635910041656a1ae30cacd` | `02_APPLY_DESIGN.sql` | `a497610e6d2d905fe02b7aa2b67724ea` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.phase42_can_update_club(text)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `24f9f7e47c2dc0a166c6385811f6c43d` | `02_APPLY_DESIGN.sql` | `969ce4b24e48632045ae75f4e8b9ca14` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.phase42_can_assign_club_owner(text)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `509ea5949fa8389edd1c4827e1bf5779` | `02_APPLY_DESIGN.sql` | `17491a5d3df2b96da44f5bececdb257e` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.phase42_can_transfer_president(text)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `24f9f7e47c2dc0a166c6385811f6c43d` | `02_APPLY_DESIGN.sql` | `61dd0458b9240d5407394f6f8d492bf0` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.club_add_member(uuid,text,uuid,text,integer)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `922df1b5d672f70150ae4010bb97bed0` | `02_APPLY_DESIGN.sql` | `484c609b937c029f03be7cb37fb03005` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.club_restore_member(uuid,text,uuid,integer)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `d24dbfa3f21e674f31ad509c655a7ef6` | `02_APPLY_DESIGN.sql` | `8391e0fbafc57917bdfcbd9401242c86` | PREDECESSOR | TARGET | CERTIFIED_MATCH |
| `public.club_review_membership_request(uuid,uuid,text,text,integer)` | CERTIFIED_HISTORICAL_SOURCE_MATCH | `0b8ee11ef23090f8cd6e364ad2e6eb60` | `02_APPLY_DESIGN.sql` | `2ef9e0d87071bba93814ab20344539c1` | PREDECESSOR | TARGET | CERTIFIED_MATCH |

Security attributes for all 10 live Staging functions (read-only recheck, project `qyewbxjsiiyufanzcjcq`):

- `overload_count=1`
- `owner=postgres`
- `prosecdef=true`
- `proconfig` contains `search_path=public`
- language / volatility as previously certified (`club_create` / `club_list_registry`: plpgsql / `v` default)
- Wave5-new functions remain ABSENT
- No `ALTER OWNER` authorized

## Source lineage (predecessor historical vs Wave5 target)

| APPROVED_SIGNATURE | PREDECESSOR_HISTORICAL_PATH | WAVE5_TARGET_PATH | AUTHORITY_RATIONALE |
|---|---|---|---|
| `phase42_club_canonical` | `docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live; APPLY body is distinct canonical target |
| `club_create` | none (live-only) | `02_APPLY_DESIGN.sql` | Live MD5 not in any git SQL CREATE. Semantic equivalent to `PHASE_42G_CLUB_CREATE_OWNER.sql` except ASCII-folded human messages + stripped comments. Lineage CRLF MD5 `a99c4c6f5021d29142229aeba4c49315` is **not** the Wave5 target. |
| `club_list_registry` | none (live-only) | `02_APPLY_DESIGN.sql` | Live MD5 not in any git SQL CREATE. Structural-normalize equal to `PHASE_42C_RLS_RPC.sql` (`REGISTRY_LIVE_DIFF=FORMATTING_ONLY`). Lineage CRLF MD5 `b8dc3e51123e4205c1f61ad19ffda555` is **not** the Wave5 target. |
| `club_list_members` | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `phase42_can_update_club` | `docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `phase42_can_assign_club_owner` | `docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `phase42_can_transfer_president` | `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `club_add_member` | `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `club_restore_member` | `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |
| `club_review_membership_request` | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `02_APPLY_DESIGN.sql` | Historical source MD5 == live |

Do **not** copy live predecessor bodies into git as canonical target source.

## Historical search (complete unshallowed repository)

Searched `git log --all`, pickaxe (`-S`), `git grep` across all refs, and hashed every historical `CREATE OR REPLACE` body for both names.

Unique repository `club_create` bodies: Phase 42C ancestor, Phase 42G, Wave5 APPLY. **None** hash to `cb9669f04a35e9b60242a5d3b18a5b27` (LF or CRLF).

Unique repository `club_list_registry` bodies: Phase 38 (different overload), Phase 42C, Wave5 APPLY. **None** hash to `214cb6e88de6f2d9d0e55e1f33c6e582`.

Deployment docs (`PHASE_42G_CLUB_CREATE_OWNER.md`, `PHASE_42K_*`) describe applying Phase SQL; they do not contain a deterministically generated live body. QA scripts are not body authority.

```
CLUB_CREATE_HISTORICAL_EXACT_BODY_FOUND=NO
CLUB_CREATE_PREDECESSOR_PROVENANCE=LIVE_CAPTURE_NO_HISTORICAL_EXACT_SOURCE
CLUB_CREATE_OWNER_ACCEPTED=YES
CLUB_CREATE_PREDECESSOR_MD5=cb9669f04a35e9b60242a5d3b18a5b27
CLUB_CREATE_TARGET_MD5=e847c5d23e51370fe4ef1360efbaa10a
CLUB_LIST_REGISTRY_HISTORICAL_EXACT_BODY_FOUND=NO
CLUB_LIST_REGISTRY_PREDECESSOR_PROVENANCE=LIVE_CAPTURE_NO_HISTORICAL_EXACT_SOURCE
CLUB_LIST_REGISTRY_OWNER_ACCEPTED=YES
CLUB_LIST_REGISTRY_PREDECESSOR_MD5=214cb6e88de6f2d9d0e55e1f33c6e582
CLUB_LIST_REGISTRY_TARGET_MD5=202fef07f6859107971329412b8beb3b
OWNER_ACCEPTANCE_IS_PREDECESSOR_ACCEPTANCE_ONLY=YES
CANONICAL_TARGET_AUTHORITY_CHANGED=NO
LIVE_ONLY_NO_HISTORICAL_SOURCE=YES
```

## Live Staging capture (read-only)

| Field | club_create | club_list_registry |
|---|---|---|
| OID | 19774 | 19776 |
| identity | `p_request_id uuid, p_tenant_id text, p_name text, p_code text, p_description text, p_registered_cluster_id text` | `p_tenant_id text, p_include_inactive boolean` |
| owner | postgres | postgres |
| prosecdef | true | true |
| proconfig | `search_path=public` | `search_path=public` |
| provolatile | v | v |
| language | plpgsql | plpgsql |
| prosrc_md5 | `cb9669f04a35e9b60242a5d3b18a5b27` | `214cb6e88de6f2d9d0e55e1f33c6e582` |
| cr/lf | 0 / 136 | 0 / 12 |
| overload_count | 1 | 1 |

RPCs were **not** invoked. Catalog only.

## `club_create` predecessor notes

`PREDECESSOR_CLASSIFICATION=OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR`

`PREDECESSOR_PROVENANCE=LIVE_CAPTURE_NO_HISTORICAL_EXACT_SOURCE`

`OWNER_ACCEPTED=YES`

`PREDECESSOR_MD5=cb9669f04a35e9b60242a5d3b18a5b27`

`TARGET_MD5=e847c5d23e51370fe4ef1360efbaa10a`

Versus Phase 42G lineage: same control flow, same error **codes**, same inserts, same SA skip, no `profiles.role` / `profiles.club_id` writes. Differences: SQL comments omitted (`COMMENT_ONLY`); Vietnamese `phase42_err` **messages** ASCII-folded (`ERROR_MESSAGE_TEXT_ONLY`). Codes / branches / return envelope unchanged.

`ASCII_FOLDED_RUNTIME_LITERAL_IMPACT=HUMAN_MESSAGE_ONLY`

Versus Wave5 APPLY target: intended cutover (Platform Tenant existence, registered-cluster validation, audit `scope_semantics`). Predecessor ≠ target is valid.

APPLY must **not** overwrite unless this exact captured live predecessor still matches, including owner / SECURITY DEFINER / search_path / volatility / language / overload. If live MD5 changes, abort (`LIVE_RPC_CHANGED_SINCE_OWNER_EVIDENCE`). Owner acceptance does not treat the live hash as canonical target authority.

## `club_list_registry` predecessor notes

`PREDECESSOR_CLASSIFICATION=OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR`

`PREDECESSOR_PROVENANCE=LIVE_CAPTURE_NO_HISTORICAL_EXACT_SOURCE`

`OWNER_ACCEPTED=YES`

`PREDECESSOR_MD5=214cb6e88de6f2d9d0e55e1f33c6e582`

`TARGET_MD5=202fef07f6859107971329412b8beb3b`

`REGISTRY_LIVE_DIFF=FORMATTING_ONLY` versus `PHASE_42C_RLS_RPC.sql` after structural SQL normalization (predicates, joins, WHERE, ORDER BY inside `jsonb_agg`, authorization calls, result envelope).

Versus Wave5 APPLY target: `phase42_is_tenant_member` → `platform_is_canonical_tenant_entitled` is an **intended** entitlement cutover (`SEMANTIC_BEHAVIOR_DIFFERENCE` / security-relevant, CUTOVER_SAFETY=INTENDED_TRANSITION).

## New Wave5 functions (exactly 3) — expected ABSENT pre-APPLY

| SIGNATURE | EXPECTED_PRE_APPLY_STATE | LIVE_STATE | PRE_APPLY_CLASSIFICATION |
|---|---|---|---|
| `public.platform_is_canonical_tenant_entitled(text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |
| `public.wave5_resolve_club_facility_venue_id(text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |
| `public.wave5_ensure_athlete_for_club_member(uuid,text,text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |

## APPLY / VERIFY implications

- PRE-APPLY: exact `APPROVED_PREDECESSOR_PROSRC_MD5` + owner/volatility/language/overload/prosecdef/search_path. `PRE_APPLY_GUARD_USES_PREDECESSOR=YES`.
- The two live-only functions are `OWNER_ACCEPTED_CAPTURED_LIVE_PREDECESSOR`. Matching predecessor fingerprint + security attributes authorizes CREATE OR REPLACE of the Wave5 target. Wrong live MD5, owner, SECURITY DEFINER, search_path, volatility, language, or overload still aborts. Owner acceptance does not disable the drift guard.
- POST-APPLY: newline-canonical LF `APPROVED_TARGET_PROSRC_MD5` from this APPLY file. `POST_APPLY_VERIFY_USES_TARGET=YES`. Predecessor mismatch must not be “fixed” by rewriting the target to the live hash.
- Eight CERTIFIED_HISTORICAL_SOURCE_MATCH predecessors remain unchanged.
- `UNCERTIFIED` remains a fail-closed sentinel if a row is left without a predecessor hash.
- `OWNER_ACCEPTANCE_IS_PREDECESSOR_ACCEPTANCE_ONLY=YES`
- `CANONICAL_TARGET_AUTHORITY_CHANGED=NO`
- This document does not execute Q0, Q1, or Tenant cutover APPLY.

## club_create semantic diff (predecessor vs Wave5 APPLY target)

| CONCERN | PREDECESSOR_BEHAVIOR | TARGET_BEHAVIOR | DIFFERENCE_CLASS | CUTOVER_SAFETY |
|---|---|---|---|---|
| authentication / auth.uid | `auth.uid()` null → `NOT_AUTHENTICATED` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| Tenant/scope resolution | `venues.id = v_tenant` | `platform_tenants.id = v_tenant` | SEMANTIC_BEHAVIOR_DIFFERENCE | INTENDED_TRANSITION |
| Tenant entitlement | `phase42_can_create_in_tenant` | same helper | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| club.create permission | non-SA requires `user_has_permission('club.create')` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| plan / limit enforcement | `phase42_check_club_plan_limit` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| request_id idempotency | `phase42_idempotency_get/put` on `club_create` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| duplicate club name | per-tenant `lower(name)` among non-deleted | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| duplicate club code | per-tenant `code` among non-deleted | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| registered_cluster validation | inserts `v_cluster` without topology check | `court_clusters` + venue tenant must match | DATA_INTEGRITY_DIFFERENCE | INTENDED_TRANSITION |
| Club INSERT fields | id, tenant_id, name, code, description, status, registered_cluster_id, created_by_user_id, version=1 | same columns | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| tenant_id semantics | copies request tenant (legacy Venue id) | copies Platform Tenant id | DATA_INTEGRITY_DIFFERENCE | INTENDED_TRANSITION |
| creator membership creation | non-SA insert `club_members` regular/active | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| club_owner governance creation | non-SA insert `club_owner` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| president governance creation | if `phase42_creator_gets_president()` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| Super Admin behavior | no member/owner/president | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| profiles.role preservation | reads role into audit; no UPDATE | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| profiles.club_id non-write | no write | no write | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| version/revision behavior | clubs.version=1; response version 1 | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| audit behavior | `phase42_write_audit` club.create | same plus `scope_semantics=canonical_platform_tenant` | SEMANTIC_BEHAVIOR_DIFFERENCE | INTENDED_TRANSITION |
| exception behavior | unique_violation / raise_exception / others → coded `phase42_err` | same codes; Unicode messages | ERROR_MESSAGE_TEXT_ONLY | SAFE |
| transaction atomicity | single SECURITY DEFINER function | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| security boundaries | DEFINER + search_path=public; venue existence | DEFINER + platform tenant existence | SECURITY_DIFFERENCE | INTENDED_TRANSITION |
| child-row creation | members + gov as above | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| return payload shape | `{ok, data: phase42_club_canonical, version}` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| comments | stripped on live | APPLY uses uppercase SQL; comments N/A in prosrc | COMMENT_ONLY | SAFE |
| ASCII-folded literals | human `phase42_err` messages ASCII-folded | Unicode Vietnamese in APPLY | ERROR_MESSAGE_TEXT_ONLY | SAFE |

`ASCII_FOLDED_RUNTIME_LITERAL_IMPACT=HUMAN_MESSAGE_ONLY` — error **codes**, branching, and structured `ok/code/error` envelope are unchanged vs 42G; only human-readable `error` text is folded.

Versus 42G lineage (not Wave5 target): no unknown security or data-integrity difference. Guarded replacement to Wave5 target uses the Owner-accepted live predecessor fingerprint, not the 42G lineage hash.

## club_list_registry semantic diff (predecessor vs Wave5 APPLY target)

| CONCERN | PREDECESSOR_BEHAVIOR | TARGET_BEHAVIOR | DIFFERENCE_CLASS | CUTOVER_SAFETY |
|---|---|---|---|---|
| input p_tenant_id semantics | null = no tenant filter; else `c.tenant_id = p_tenant_id` | same filter | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| p_include_inactive semantics | false → `c.status = 'active'` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| Super Admin global behavior | `phase42_is_platform_super_admin()` OR tenant helper | SA OR canonical entitlement | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE for SA path |
| non-SA Tenant authorization | `phase42_is_tenant_member(c.tenant_id)` (includes `profiles.venue_id` fallback inside helper) | `platform_is_canonical_tenant_entitled(c.tenant_id)` | SECURITY_DIFFERENCE | INTENDED_TRANSITION |
| phase42_is_tenant_member / canonical entitlement dependencies | live SQL calls `phase42_is_tenant_member` | live SQL calls `platform_is_canonical_tenant_entitled` | SEMANTIC_BEHAVIOR_DIFFERENCE | INTENDED_TRANSITION |
| tenant filter | SQL WHERE as above | same predicate shape | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| status filter | as `p_include_inactive` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| deleted_at handling | `c.deleted_at is null` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| phase42_club_canonical projection | `jsonb_agg(phase42_club_canonical(c.id) order by c.name)` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| ordering | `order by c.name` inside agg | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| result envelope | `json_build_object('ok', true, 'data', v_rows)` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| error/deny behavior | unauthenticated `NOT_AUTHENTICATED`; no rows if unauthorized | same envelope; entitlement swap may change which rows | SEMANTIC_BEHAVIOR_DIFFERENCE | INTENDED_TRANSITION |
| Tenant vs Venue semantics | helper may treat `profiles.venue_id` as tenant | canonical tenant entitlement only | SECURITY_DIFFERENCE | INTENDED_TRANSITION |
| no activeClubId fallback | none in SQL | none | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| no Venue-as-Tenant substitution in this RPC text | filter uses `c.tenant_id` | same | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |
| no hidden global fetch + UI-only filter | SQL applies tenant + entitlement | SQL applies tenant + canonical entitlement | SEMANTIC_EQUIVALENT_EXPRESSION | SAFE |

`REGISTRY_LIVE_DIFF=FORMATTING_ONLY` versus `PHASE_42C_RLS_RPC.sql` after `normalizeStructuralSql`.
