# 04 — Forward Migration Plan (Planning Only)

**Executable SQL in this task:** FORBIDDEN  
**First apply environment:** Staging only  
**Production apply:** Requires a **separate future Owner GO** after Staging gates pass

## Goal

Introduce dedicated QA quarantine authority (`public.qa_identity_quarantines` + controlled lifecycle writers) without modifying `profiles.status` lifecycle semantics or `profiles_status_check`.

## Future migration sequence

| Step | Object / action | Notes |
|------|-----------------|-------|
| M0 | Preflight inventory | Staging backup; snapshot `profiles_status_check`; assert `quarantined` absent |
| M1 | Create table `public.qa_identity_quarantines` | Columns per `02_CANONICAL_QA_QUARANTINE_DATA_MODEL.md` including `auth_ban_state`, `lifecycle_state`, `lifecycle_version` |
| M2 | Add CHECK constraints | lifecycle, auth_ban_state, identity bind, active-success invariant, pending/auth consistency, release consistency, original_status |
| M3 | Add FK constraints | `profile_id` → profiles; `auth_user_id` → auth.users |
| M4 | Create indexes | unique partial active-by-profile/auth; batch/lifecycle; **set-based read** support on active `profile_id` |
| M5 | Immutable-field enforcement | BEFORE UPDATE trigger (applies to service_role) rejecting immutable bind/audit field changes; deny hard DELETE in normal ops |
| M6 | Enable RLS | Default deny for `authenticated` / `anon` |
| M7 | Grants | REVOKE direct DML from ordinary roles; no reliance on RLS alone for service_role |
| M8 | Controlled writer RPCs | `qa_quarantine_prepare`, `qa_quarantine_activate_after_auth_ban`, `qa_quarantine_activate_preexisting_ban`, `qa_quarantine_record_compensated_failure`, `qa_quarantine_release` |
| M9 | Set-based read interface | Canonical view and/or batched read RPC for active quarantines (anti-N+1) |
| M10 | Audit integration | audit_logs from SECURITY DEFINER writers |
| M11 | Verify | Constraints/indexes/RLS/RPC/immutability/trigger tests — no Production |
| M12 | Staging rehearsal | Per doc 10 — **Auth-ban rehearsal mandatory, non-waivable** |
| M13 | Production apply (future) | Separate Owner GO; never authorized by this planning package |

## Object creation order

1. Extensions if needed (`gen_random_uuid` expected)
2. Table
3. CHECK then FK constraints
4. Indexes (including set-based active profile_id)
5. Immutability + delete-deny triggers
6. Comments
7. RLS enable + policies
8. Revoke/grant
9. SECURITY DEFINER lifecycle RPCs + execute grants
10. Canonical active view / batched read RPC

## Constraints and indexes

Must implement all constraints and indexes in the data model, especially:

- Active success invariant: active ⇒ `auth_ban_state in ('applied','not_required_preexisting')`
- Partial unique active quarantine per profile and per auth user
- Indexes supporting **one set-based join or one batched `IN` lookup per page**

## RLS activation

- Enable RLS; deny broad authenticated INSERT/UPDATE/DELETE
- Writes **only** via controlled SECURITY DEFINER RPCs with expected-state / `lifecycle_version` guards
- Note explicitly: `service_role` bypasses RLS → immutability trigger + RPC-only policy remain mandatory

## Grants

- `REVOKE ALL ON TABLE … FROM PUBLIC, anon, authenticated`
- Grant `SELECT` only via deliberate set-based view/RPC if productized
- `GRANT EXECUTE` on lifecycle RPCs only to intended callers

## Writer RPC / controlled service interface

### `qa_quarantine_prepare`

Creates `lifecycle_state='pending'`, `auth_ban_state='pending'` after gates. Snapshots immutable originals. **No Auth ban. No active quarantine.**

### `qa_quarantine_activate_after_auth_ban`

Requires proven Auth ban readback. Atomically `pending→active`, `pending→applied`, sets `activated_at`, increments `lifecycle_version`.

### `qa_quarantine_activate_preexisting_ban`

Only when `original_auth_banned=true`. Atomically `pending→active`, `pending→not_required_preexisting`. Does not claim B1B applied the ban.

### `qa_quarantine_record_compensated_failure`

Records Boundary 2/3 failure dispositions (`failed` / `reverted`), including Auth-ban-success / activation-failure compensation outcomes.

### `qa_quarantine_release`

`active→released` with release fields. Returns flags so runner unbans **only if** `auth_ban_state='applied'` AND `original_auth_banned=false`.

### Set-based read (mandatory for lists)

Provide at least one of:

- `qa_identity_quarantine_active_v` view joining/filtering `lifecycle_state='active'`
- `qa_quarantine_list_active(profile_ids uuid[])` batched RPC
- directory/profile query with **one** left join to active authority

Single-row `qa_quarantine_is_active(profile_id)` may exist for ops tooling but **must not** be used per-row in list rendering.

## Dual-write and Boundary 3 (explicit)

Migration/RPC design must support the runner sequence A→E and all five failure boundaries in doc 02, including:

**Auth ban succeeds + activation fails:**

- unban compensation when originally unbanned
- verified Auth restore
- authority recorded as `reverted`/`failed` (not active)
- GO/batch consumed after Auth mutation
- no silent retry on the same pending authority without new governance

## Compatibility views or projectors

| Artifact | Purpose |
|----------|---------|
| Active quarantine view / batched RPC | Anti-N+1 directory/roster reads |
| App projector `qaQuarantined=true` | Only for fully activated rows |
| Forbidden DB write of `status='quarantined'` | Never |

## No-data-loss / retention properties

- Additive relative to `profiles`
- No rewrite of existing profile rows
- Indefinite append-only retention of released/failed/reverted rows (see data model retention policy)
- No automatic purge in B1B

## Idempotency

- Migration objects re-runnable with existence guards
- Prepare/activate idempotent under expected-state rules
- Reapply after release requires new prepare under authorization rules

## Migration verification (future)

1. Table/columns/`auth_ban_state` present; **no** `auth_ban_applied` boolean
2. Active-success CHECK present
3. Immutability trigger blocks service_role UPDATE of `profile_id`/`batch_id`/snapshots
4. Direct authenticated DML denied
5. `profiles_status_check` unchanged
6. Staging prepare→ban→activate→release round-trip
7. Fault-injection Boundary 3 path available to tests

## Staging-only first application

```text
STAGING_FIRST=YES
PRODUCTION_APPLY_IN_THIS_PLAN=NO
PRODUCTION_GO=NO
STAGING_AUTH_BAN_REHEARSAL_MANDATORY=YES
STAGING_AUTH_BAN_WAIVER_ALLOWED=NO
```

## Explicit non-actions

- No executable Production SQL in this planning package
- Do not alter `profiles_status_check`
- Do not backfill illegal profile statuses
- Do not reuse retired B1 GO/batch
