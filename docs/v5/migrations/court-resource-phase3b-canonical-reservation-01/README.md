# Court Resource Phase 3B — Canonical Reservation Authority 01

**AUTHORED LOCALLY ONLY. NOT APPLIED TO STAGING OR PRODUCTION.**

`STAGING_MUTATIONS=0`  
`PRODUCTION_MUTATIONS=0`  
`PRODUCTION_PHASE3B_GO=NO`  
`CANONICAL_RESERVATION_CUTOVER=false` (Staging and Production default)

Run order after explicit Owner GO Staging: `01_PRECHECK.sql`, `02_APPLY.sql`,
`03_VERIFY.sql`. `04_ROLLBACK.sql` drops Phase 3B objects and restores Daily Play
RPCs to the reviewed pre-APPLY baseline in `preapply-baseline/`; it does not
touch Phase 3A, pilot `court_reservations`, or Daily Play lease rows.

## Authority

Canonical durable capacity identity:

`tenant_id + physical_court_id + tstzrange(starts_at, ends_at, '[)')`

where `status = 'active'`, enforced by GiST `EXCLUDE` (`btree_gist`).

`clubId`, court label, court number, legacy `courtId`, `clusterId`, and
`courtCount` are not physical conflict identity.

Owner types: `booking`, `competition`, `daily_play`, `maintenance`, `operations`.

Lifecycle: `active` → `released` | `cancelled` | `expired`. Historical rows remain.
Release is `UPDATE`, not `DELETE`.

## RPC surface

| Capability | Function |
| ---------- | -------- |
| reserve | `public.court_resource_reserve` |
| release | `public.court_resource_release` |
| availability | `public.court_resource_get_availability` |

Writes go through `SECURITY DEFINER` RPCs. Tables have RLS enabled+forced and no
authenticated/anon DML grants. Idempotency ledger:
`public.court_resource_reservation_commands` unique on `(tenant_id, request_id)`.
Same request + same payload replays; same request + different payload returns
`IDEMPOTENCY_CONFLICT`. One command per multi-court request.

## Daily Play

`DAILY_PLAY_CAPACITY_AUTHORITY=CANONICAL_RESERVATION` after cutover.  
`DAILY_PLAY_LEASE_ROLE=LIVE_EXECUTION_PROJECTION`.

Cutover OFF (installation default): existing Staging Daily Play path is unchanged,
including `court_assert_available` before lease mutation, lease uniqueness, CAS,
and idempotency. Canonical acquire is not called and `CUTOVER_OFF` cannot bypass
those guards.

Cutover ON: `daily_play_assign_court` / `daily_play_change_court` acquire
canonical capacity (`owner_type=daily_play`) in the same database transaction as
the lease write. Lease uniqueness is not the cross-domain capacity authority.
Canonical failure fail-closes. No silent legacy fallback. Change acquires the
target reservation before releasing the old one.

Reviewed pre-APPLY baseline (not `origin/main` session-close bodies):

See `preapply-baseline/README.md`. Assign/change match Staging
`pg_get_functiondef` produced by
`official-open-canonical-court-reservation-01/02_APPLY_SCHEMA.sql`.

Court Engine does **not** insert canonical reservation rows.

## Cutover

`public.court_resource_reservation_cutover.enabled` defaults to **false**.
JS `CANONICAL_RESERVATION_CUTOVER` / `CANONICAL_RESERVATION_CUTOVER_DEFAULT`
default to **false**. Canonical enabled + failure → fail closed. No silent
legacy authority fallback.

JS and SQL are dual controls and must stay aligned:

- SQL `enabled` gates Daily Play acquire/release inside replaced Daily Play RPCs
  when cutover is ON. When OFF, Daily Play uses `court_assert_available`.
- JS cutover gates Booking/Competition/gateway use of canonical reserve/release/
  availability. Canonical RPC failure returns `ok=false`; it does not fall back
  to legacy booking blob authority.
- `court_resource_reserve` / `release` / `get_availability` themselves are not
  no-ops when SQL `enabled=false`; they exist so a later dual enable can turn
  traffic onto them. Daily Play does not acquire while SQL `enabled=false`.

Forbidden mismatch (do not operate traffic in either state):

- JS ON + SQL OFF → Booking/Competition would write canonical rows while Daily
  Play would skip acquire (`CUTOVER_OFF`) and keep lease-only projection.
- JS OFF + SQL ON → Daily Play would acquire canonical capacity while Booking
  would still use legacy blob authority.

## Later Staging enable procedure (DO NOT RUN IN THIS PASS)

Do not enable cutover now. `STAGING_CUTOVER_DEFAULT=false`. Separate Owner GO
required. Production remains `false` (`PRODUCTION_PHASE3B_GO=NO`).

1. Owner GO Staging Apply only: run `01_PRECHECK.sql`, `02_APPLY.sql`,
   `03_VERIFY.sql` on Staging. Leave SQL `enabled=false`. Leave JS cutover
   `false`. Do not apply Production.
2. Confirm VERIFY: cutover row exists and `enabled=false`. Confirm app build
   still has `CANONICAL_RESERVATION_CUTOVER_DEFAULT=false`.
3. Later Owner GO Staging Enable (not this pass), in one coordinated window:
   a. Super-admin only: `court_resource_set_canonical_reservation_cutover(true)`
      on Staging.
   b. Same GO: ship a Staging app revision with JS
      `CANONICAL_RESERVATION_CUTOVER` / `CANONICAL_RESERVATION_CUTOVER_DEFAULT`
      set true. Do not enable JS without SQL, or SQL without JS.
   c. Prove fail-closed: canonical RPC failure must not restore legacy booking
      authority.
4. Production enable is out of scope until Production has Phase 3A and a
   separate Production GO.

## Complete ownership manifest

Package-owned tables:

- `court_resource_reservations`
- `court_resource_reservation_commands`
- `court_resource_reservation_cutover`

Package-owned functions (public RPCs):

- `court_resource_reserve`
- `court_resource_release`
- `court_resource_get_availability`
- `court_resource_set_canonical_reservation_cutover`
- `court_resource_canonical_reservation_cutover_enabled`

Package-owned internal helpers:

- `court_resource_digest_sha256`
- `court_resource_reserve_core`
- `court_resource_reservation_assert_access`
- `court_resource_resolve_physical_court_for_legacy`
- `court_resource_reservation_payload_fingerprint`
- `court_resource_reservation_normalize_court_ids`
- `court_resource_map_gateway_owner_type`
- `court_resource_daily_play_acquire`
- `court_resource_daily_play_release_match`
- `court_resource_daily_play_release_court`
- `court_resource_daily_play_release_tournament`

Package-owned policies:

- `court_resource_reservations_select`
- `court_resource_reservation_commands_select`
- `court_resource_reservation_cutover_select`

APPLY also replaces Daily Play RPCs `daily_play_assign_court`,
`daily_play_change_court`, `daily_play_submit_score`, `daily_play_cancel_match`,
`daily_play_close_session`. Rollback restores `preapply-baseline/` bodies
exactly (PREEXISTING_OBJECT count = 5). `court_assert_available` is a
dependency and is not replaced.

PRECHECK fingerprints live `pg_get_functiondef` of assign/change using
pgcrypto `digest(bytea,text)` discovered from
`pg_catalog.pg_extension.extnamespace` (not hard-coded `public` or
`extensions`) and invoked schema-qualified. Conceptual method:

```
encode(<pgcrypto_schema>.digest(convert_to(pg_get_functiondef(oid), 'UTF8'), 'sha256'), 'hex')
```

Expected Staging hashes (2026-08-15, read-only):

- assign `4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5`
- change `d1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59`

Mismatch raises `PREEXISTING_ROUTINE_DRIFT`. Missing pgcrypto raises
`PGCRYPTO_EXTENSION_MISSING`. Missing `digest(bytea,text)` in the discovered
schema raises `PGCRYPTO_DIGEST_MISSING`. Fingerprint verification is never
skipped.

Runtime SHA256 fingerprinting (reserve/release command ledger) uses the same
catalog authority through package-owned `court_resource_digest_sha256(bytea)`:
discover `pgcrypto` via `pg_catalog.pg_extension.extnamespace`, verify
`digest(bytea,text)` in that schema, then `EXECUTE format('SELECT %I.digest($1, %L)', schema, 'sha256')`.
The helper is `SECURITY DEFINER` with `search_path=pg_catalog, public` and does
not add `extensions` to `search_path`. It does not hard-code `public.digest` or
`extensions.digest`. Fail closed if pgcrypto or the digest signature is absent.
Reserve and release both call this helper. Rollback drops the helper and does
not `DROP`/`ALTER` the pgcrypto extension.

## Integrity hashes

Two hash concepts. Do not mix them.

### A. Execution manifest (executable SQL only)

`SQL_EXECUTION_HASH_MODE=EXACT_EXECUTED_BYTES`  
`HASH_SOURCE=DIRECT_DISK_COMPUTATION`

Covers ONLY:

- `01_PRECHECK.sql`
- `02_APPLY.sql`
- `03_VERIFY.sql`
- `04_ROLLBACK.sql`

SHA256 and byte counts are the exact on-disk bytes that will be sent to
PostgreSQL. No LF normalization. No README.

| File | SHA256 | bytes |
|------|--------|------:|
| `01_PRECHECK.sql` | `528a482cc77edea38dc35b9a5323e00b82c4c25894d06b15a27b1e422fe8b13c` | 9889 |
| `02_APPLY.sql` | `61418ababbb6b12cf1e956822573154d7588d59c14b9d9603a867c464a87b032` | 63122 |
| `03_VERIFY.sql` | `7766f80784ee0724626c7d7bf6c4eff5185d7f1cc59c42f0113dc25400c18934` | 11556 |
| `04_ROLLBACK.sql` | `43e39245d3698ed21565ae43c2322a64a474122e51730baaba7b9a5aac280898` | 24296 |

Do not retype SQL for Staging execution. Hash the exact file bytes.

### B. README / documentation integrity

README is not executable and is not part of the execution manifest.

`README_HASH_MODE=RAW_BYTES`

README SHA256/bytes are exact on-disk bytes, reported in certification only.
Self-embedding README's own hash in the execution-manifest table is circular
and is not done.

Do not compare a README hash (raw or LF-normalized) against the SQL execution
manifest. A README line-ending difference is not an execution-manifest mismatch.

## Safety

- No Staging/Production apply from this workstream
- Pilot `public.court_reservations` / `official_tournament_reserve_courts` not mutated
- Phase 3A physical identity/access/mappings not dropped
- Production currently lacks Phase 3A; `PRODUCTION_PHASE3B_GO=NO`
