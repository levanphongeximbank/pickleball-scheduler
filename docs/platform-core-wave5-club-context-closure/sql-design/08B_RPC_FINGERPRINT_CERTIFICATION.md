# Wave 5 — Live RPC fingerprint certification (source-derived)

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
APPROVED_FINGERPRINT_SOURCE=AUTHORITATIVE_REPOSITORY_FUNCTION_BODY
LIVE_HASH_IS_AUTHORITY=NO
REPO_CANONICAL_SOURCE_IS_AUTHORITY=YES
STATIC_PROSRC_EXTRACTION=DETERMINISTIC_LOCAL_EXTRACTOR
HASH_METHOD=md5(convert_to(pg_proc.prosrc, 'UTF8'))_EQUIVALENT
STAGING_PROSRC_NEWLINE_FORM=CRLF
GIT_SOURCE_NEWLINE_FORM=LF
NEWLINE_DEPLOY_TRANSFORM=LF_TO_CRLF_DETERMINISTIC
STAGING_PROJECT=qyewbxjsiiyufanzcjcq
STAGING_READ_ONLY_FINGERPRINT_RECHECK=PASS_UNCHANGED
RPC_EXISTING_REQUIRED_COUNT=10
RPC_EXISTING_CERTIFIED_MATCH_COUNT=8
RPC_EXISTING_BLOCKED_BODY_MISMATCH_COUNT=2
RPC_NEW_EXPECTED_ABSENT_COUNT=3
RPC_NEW_LIVE_PRESENT_COUNT=0
EXPECTED_ABSENT=PASS
WAVE5_APPLY_READINESS_ALL_10_CERTIFIED_MATCH=NO
```

## Authority rule

Do **not** certify a live body merely because its Staging hash was observed.
Authority is the authoritative repository `CREATE OR REPLACE` body → extract
`pg_proc.prosrc`-equivalent bytes → MD5 → compare to live Staging.

Extractor: `scripts/wave5-rpc-prosrc-fingerprint.mjs` (and tests that import it).
Hashes only the dollar-quoted function body; not CREATE header, RETURNS,
LANGUAGE, SECURITY DEFINER, `SET search_path`, or outer delimiters.

Git blobs are LF. Staging live `pg_proc.prosrc` for these RPCs stores CRLF
(observed: equal CR and LF counts; body starts with `\r\n`). Approved Staging
fingerprints are source-derived via deterministic `LF → CRLF` deploy-form
transform, then MD5 — not by copying live hashes as authority.

## Certification set (exactly 10)

| APPROVED_SIGNATURE | AUTHORITATIVE_SOURCE_PATH | APPROVED_SOURCE_PROSRC_MD5 | STAGING_LIVE_PROSRC_MD5 | BODY_MATCH | EXPECTED_LANG | EXPECTED_VOL | EXPECTED_OWNER | CERTIFICATION |
|---|---|---|---|---|---|---|---|---|
| `public.phase42_club_canonical(text)` | `docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql` | `871ff5136397a42f5c5718179b65aed9` | `871ff5136397a42f5c5718179b65aed9` | YES | plpgsql | s | postgres | CERTIFIED_MATCH |
| `public.club_create(uuid,text,text,text,text,text)` | `docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql` (intended) | `a99c4c6f5021d29142229aeba4c49315` (source) | `cb9669f04a35e9b60242a5d3b18a5b27` | NO | plpgsql | v (default) | postgres | BLOCKED_BODY_MISMATCH |
| `public.club_list_registry(text,boolean)` | `docs/v5/PHASE_42C_RLS_RPC.sql` (intended) | `b8dc3e51123e4205c1f61ad19ffda555` (source) | `214cb6e88de6f2d9d0e55e1f33c6e582` | NO | plpgsql | v (default) | postgres | BLOCKED_BODY_MISMATCH |
| `public.club_list_members(text)` | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `3089518678635910041656a1ae30cacd` | `3089518678635910041656a1ae30cacd` | YES | plpgsql | v (default) | postgres | CERTIFIED_MATCH |
| `public.phase42_can_update_club(text)` | `docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql` | `24f9f7e47c2dc0a166c6385811f6c43d` | `24f9f7e47c2dc0a166c6385811f6c43d` | YES | sql | s | postgres | CERTIFIED_MATCH |
| `public.phase42_can_assign_club_owner(text)` | `docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql` | `509ea5949fa8389edd1c4827e1bf5779` | `509ea5949fa8389edd1c4827e1bf5779` | YES | sql | s | postgres | CERTIFIED_MATCH |
| `public.phase42_can_transfer_president(text)` | `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` | `24f9f7e47c2dc0a166c6385811f6c43d` | `24f9f7e47c2dc0a166c6385811f6c43d` | YES | sql | s | postgres | CERTIFIED_MATCH |
| `public.club_add_member(uuid,text,uuid,text,integer)` | `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` | `922df1b5d672f70150ae4010bb97bed0` | `922df1b5d672f70150ae4010bb97bed0` | YES | plpgsql | v (default) | postgres | CERTIFIED_MATCH |
| `public.club_restore_member(uuid,text,uuid,integer)` | `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` | `d24dbfa3f21e674f31ad509c655a7ef6` | `d24dbfa3f21e674f31ad509c655a7ef6` | YES | plpgsql | v (default) | postgres | CERTIFIED_MATCH |
| `public.club_review_membership_request(uuid,uuid,text,text,integer)` | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `0b8ee11ef23090f8cd6e364ad2e6eb60` | `0b8ee11ef23090f8cd6e364ad2e6eb60` | YES | plpgsql | v (default) | postgres | CERTIFIED_MATCH |

Security attributes for all CERTIFIED_MATCH rows (source + live Staging recheck):

- `prosecdef=true`
- `proconfig` contains `search_path=public`
- `overload_count=1`
- trusted owner `postgres`
- No `ALTER OWNER` authorized

Volatility derivation: when the source omits `VOLATILE`/`STABLE`/`IMMUTABLE`, PostgreSQL default `VOLATILE` (`v`) is used and recorded as `(default)`.

## Source lineage

| APPROVED_SIGNATURE | ALL_DEFINITION_PATHS_FOUND | AUTHORITATIVE_SOURCE_PATH | SUPERSEDED_PATHS | AUTHORITY_RATIONALE |
|---|---|---|---|---|
| `public.phase42_club_canonical(text)` | `PHASE_42C_RLS_RPC.sql`; `phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql`; Wave5 `02_APPLY_DESIGN.sql` (future) | `docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql` | `PHASE_42C_RLS_RPC.sql`; Wave5 APPLY future body | Later Phase 1B command-completion body; source MD5 == live |
| `public.club_create(uuid,text,text,text,text,text)` | `PHASE_42G_CLUB_CREATE_OWNER.sql`; Wave5 `02_APPLY_DESIGN.sql` (future); `PHASE_42C` grant-only pointer | `docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql` (intended; **not certifiable**) | Wave5 APPLY future body | Intended Phase 42G body ≠ live Staging (ASCII-folded messages / comment drift). No repo body matches live MD5. **Do not copy live into git as authority.** |
| `public.club_list_registry(text,boolean)` | `PHASE_42C_RLS_RPC.sql`; `PHASE_38_CLUB_REGISTRY_CLOUD_SYNC.sql` (different overload); Wave5 APPLY future | `docs/v5/PHASE_42C_RLS_RPC.sql` (intended; **not certifiable**) | `PHASE_38` (wrong signature); Wave5 APPLY future | Intended 42C body ≠ live (compacted reformatting). No repo body matches live MD5. |
| `public.club_list_members(text)` | `PHASE_42C_RLS_RPC.sql`; `PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql`; Wave5 APPLY future | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `PHASE_42C_RLS_RPC.sql`; Wave5 APPLY future | Later 42N athlete membership body; source MD5 == live |
| `public.phase42_can_update_club(text)` | `phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql`; `phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql` (identical helper); Wave5 APPLY future | `docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql` | Wave5 APPLY future; 45A3C is identical duplicate helper copy | Deployed Phase 1B security-gate definition; body identical to 45A3C copy; source MD5 == live |
| `public.phase42_can_assign_club_owner(text)` | `phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql`; Wave5 APPLY future | `docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql` | Wave5 APPLY future | Sole deployed Phase 1C definition; source MD5 == live |
| `public.phase42_can_transfer_president(text)` | `phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql`; Wave5 APPLY future | `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` | Wave5 APPLY future | Sole deployed Phase 2D definition; source MD5 == live |
| `public.club_add_member(uuid,text,uuid,text,integer)` | `phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql`; Wave5 APPLY future | `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` | Wave5 APPLY future | Sole repository CREATE for this signature; source MD5 == live |
| `public.club_restore_member(uuid,text,uuid,integer)` | `phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql`; Wave5 APPLY future | `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` | Wave5 APPLY future | Sole repository CREATE for this signature; source MD5 == live |
| `public.club_review_membership_request(uuid,uuid,text,text,integer)` | `PHASE_31` (different overload); `PHASE_42I`; `PHASE_42I1`; `PHASE_42N`; Wave5 APPLY future | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | `PHASE_31`; `PHASE_42I`; `PHASE_42I1`; Wave5 APPLY future | Latest matching signature body in 42N; source MD5 == live |

## New Wave5 functions (exactly 3) — expected ABSENT pre-APPLY

| SIGNATURE | EXPECTED_PRE_APPLY_STATE | LIVE_STATE | PRE_APPLY_CLASSIFICATION |
|---|---|---|---|
| `public.platform_is_canonical_tenant_entitled(text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |
| `public.wave5_resolve_club_facility_venue_id(text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |
| `public.wave5_ensure_athlete_for_club_member(uuid,text,text)` | ABSENT | ABSENT | EXPECTED_ABSENT=PASS |

## BLOCKED_BODY_MISMATCH notes (Owner action required)

### `club_create`

Live Staging body matches Phase 42G **logic** but differs in byte-exact `prosrc` (notably ASCII-folded Vietnamese error strings vs Unicode in `PHASE_42G_CLUB_CREATE_OWNER.sql`, and comment differences). No repository file contains MD5 `cb9669f04a35e9b60242a5d3b18a5b27`.

### `club_list_registry`

Live Staging body is a compacted reformatting of the Phase 42C body. No repository file contains MD5 `214cb6e88de6f2d9d0e55e1f33c6e582`.

**Owner options (out of scope for this phase):** reconcile repository source to the exact live body via an Owner-authorized reconciliation artifact, or redeploy from repository source after an authorized maintenance window. Do **not** treat live hash as fingerprint authority.

## APPLY guard implications

- Eight CERTIFIED_MATCH functions: APPLY uses `APPROVED_SOURCE_PROSRC_MD5` + expected owner/volatility/language.
- Two BLOCKED functions remain `UNCERTIFIED` placeholders → APPLY continues to abort with `WAVE5_APPLY_ABORT_RPC_BODY_DRIFT` / `OWNER_REVIEW_REQUIRED` until certified.
- Wave5 `02_APPLY_DESIGN.sql` CREATE bodies are **future** overwrite candidates and are **not** the pre-APPLY certification authority.
