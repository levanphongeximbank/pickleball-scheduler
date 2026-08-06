# 06 — RLS, Writer, and Authority Model

## Authority summary

| Action | `anon` | Normal user | Tenant owner / `user.manage` | SUPER_ADMIN RPC | Service-role operator |
|--------|--------|-------------|------------------------------|-----------------|------------------------|
| Set-based read of active quarantine | NO (default) | Via productized view/RPC only if granted | Venue-scoped optional later | YES | YES |
| `qa_quarantine_prepare` | NO | NO | NO | YES | YES via runner/RPC |
| Activate after Auth ban / preexisting | NO | NO | NO | YES | YES |
| Record compensated failure | NO | NO | NO | YES | YES |
| Release | NO | NO | NO | YES | YES |
| Direct table INSERT/UPDATE/DELETE | NO | NO | NO | NO | **Forbidden** except break-glass |
| Mutate immutable bind fields | NO | NO | NO | NO | **NO** (trigger deny) |
| Mutate `profiles.status` for QA | NO | NO | NO | NO | **NO** |
| Auth ban/unban | NO | NO | NO | Admin API patterns | YES (runner) |

## Controlled writers only

Canonical lifecycle changes occur **only** through:

1. `qa_quarantine_prepare`
2. `qa_quarantine_activate_after_auth_ban`
3. `qa_quarantine_activate_preexisting_ban`
4. `qa_quarantine_record_compensated_failure`
5. `qa_quarantine_release`

Each transition requires expected-state + `lifecycle_version` optimistic concurrency. Mismatch → fail closed. No uncontrolled direct DML.

## Immutable bind / audit fields

Database-level BEFORE UPDATE trigger (and DELETE deny for normal ops) must reject changes to:

- `profile_id`, `auth_user_id`, `venue_id`
- `batch_id`, `source_operation`
- `original_auth_banned`, `original_profile_status`
- `created_at`, `created_by`, `reason`
- artifact correlation (`allowlist_sha256`, `snapshot_sha256`)
- `expected_email`, `allowlist_label`, `id`

This enforcement **applies when service_role performs UPDATE**. RLS is not sufficient.

## Service-role behavior (Observation 3)

`service_role` bypasses RLS. Mitigations (all mandatory):

1. Database immutability trigger
2. Narrow controlled writer RPCs (preferred path even for service_role)
3. Runner authorization gates (project-ref, GO, batch, hashes, dry-run)
4. Audit events on every lifecycle transition
5. Prohibition of uncontrolled direct DML in ops policy
6. Explicit break-glass governance (Owner GO + evidence) for SQL editor emergencies
7. Tests proving service_role cannot rebind `profile_id`/`auth_user_id`/`batch_id` or overwrite snapshots through normal UPDATE paths

Forbidden: ad-hoc SQL setting `profiles.status` to `quarantined` or `suspended` for QA hygiene.

## Read authority / anti-N+1

Directory, roster, admin list, and bulk profile consumers must use set-based mechanisms (view join, query join, or batched profile-id lookup). Per-row quarantine queries/RPCs are prohibited for list surfaces (see doc 07).

## Write / release authority

- Validate exact profile/auth/email bind at runner layer before prepare
- Non-empty reason + batch_id required
- Release unban decision uses `auth_ban_state='applied' AND original_auth_banned=false` only

## Audit-read authority

- SUPER_ADMIN: full
- `user.manage`: only if productized and venue-scoped
- Emit prepare/activate/fail/release actions to `audit_logs` (masked client-visible metadata)

## SUPER_ADMIN / tenant / normal user

- SUPER_ADMIN may call RPCs when enabled; cannot substitute for Production Owner GO on bulk execute
- Tenant owners cannot apply/release QA quarantine; real suspension remains `profiles.status='suspended'`
- Normal users: no read/write; self-status changes still blocked by existing profile guards

## Self-write prohibition

Users cannot insert quarantine rows, fake quarantine via `privacy_settings`, or set illegal `profiles.status`.

## Tenant isolation

Immutable `venue_id` snapshot; authenticated reads must not cross tenants unless SUPER_ADMIN.

## SECURITY DEFINER expectations

- Fixed `search_path=public`
- Explicit AuthZ in body
- Expected-state / version guards
- Structured `{ ok, code }` errors
- Never UPDATE `public.profiles.status`
- Never mutate immutable columns

## Direct table write policy

| Role | Policy |
|------|--------|
| `anon` / `authenticated` | No direct DML |
| `service_role` | RPC-only for lifecycle; trigger blocks immutable tampering |
| SQL editor break-glass | Incident-only Owner GO + evidence |

## Grant model

1. REVOKE ALL on table from PUBLIC/anon/authenticated
2. GRANT EXECUTE on lifecycle + set-based read RPCs only as intended
3. No extra `profiles` UPDATE grants for quarantine

## Audit logging

Record actor, action (`prepare` / `activate_after_auth_ban` / `activate_preexisting_ban` / `compensated_failure` / `release`), resource ids, batch_id, `auth_ban_state`, `lifecycle_version`, success/failure codes. No secrets.

## Forbidden writer paths

1. `UPDATE profiles SET status='quarantined'`
2. Using `suspended` for QA quarantine
3. Client direct table writes
4. Privacy JSON as quarantine SSOT
5. Treating Auth ban alone as quarantine activation
6. Activating without Auth readback when originally unbanned
7. Uncontrolled UPDATE of bind/snapshot fields (including via service_role)
8. Reuse of retired GO/batch
9. Hard delete of authority rows in normal ops

## Relationship to existing identity writers

| Existing writer | Quarantine interaction |
|-----------------|------------------------|
| `identity_admin_update_user` | Real lifecycle statuses only — not QA quarantine |
| Player write repos | No quarantine SSOT |
| `profiles_guard_privileged_update` | Remains |
| B1A `updateProfileStatus` | Retired for quarantine |
| Auth Admin ban/unban | Complementary after prepare; activation records success |
