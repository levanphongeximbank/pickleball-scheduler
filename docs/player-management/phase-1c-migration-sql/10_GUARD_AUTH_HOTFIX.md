# Phase 1C — Profile Guard Auth Bypass Hotfix

## Defect

`public.profiles_guard_privileged_update()` is `SECURITY DEFINER` owned by `postgres`.
The bypass `current_user = 'postgres'` always matches the function owner, so PostgREST JWT updates skip all privileged-field checks.

Staging observation: non–super-admin self-update of `identity_verification_status` succeeded (`unverified` → `pending`). Value was restored after the test.

## Identity probe summary (Staging)

| Context | current_user | session_user | auth.uid | auth.role |
|---------|--------------|--------------|----------|-----------|
| Direct DB as postgres | postgres | postgres | null | null |
| Inside SECURITY DEFINER | postgres | postgres | (JWT if set) | (JWT if set) |
| SET ROLE authenticated from postgres conn | outer: authenticated / DEFINER: postgres | postgres | set | authenticated |

`session_user = 'postgres'` is **not** a reliable PostgREST discriminator when connecting through the postgres pool role.

## Chosen bypass model

1. Allow `auth.role() = 'service_role'`
2. Allow maintenance when `auth.uid() is null` and role is not `authenticated`/`anon`
3. **Never** bypass via `current_user = 'postgres'`

## Files

- Forward: `docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX.sql`
- Verify: `docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_VERIFY.sql`
- Rollback: `docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_ROLLBACK.sql` (restores pre-hotfix defective body)

## Unchanged

RLS, policies, columns, constraints, indexes. Trigger reaffirmed only.

## Protected fields (unchanged set)

- `role`, `status`, `venue_id`, `club_id`
- `identity_verification_status` (self-block; admin via `user.manage` + same venue)
- other-user: also `display_name`, `phone`, `avatar_url` under `user.manage`

## Next Owner action

Authorize Staging-only apply of the forward hotfix, then re-run auth-path JWT validation.
