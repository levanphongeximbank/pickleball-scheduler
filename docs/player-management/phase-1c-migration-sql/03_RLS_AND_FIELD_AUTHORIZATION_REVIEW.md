# 03 — RLS and Field Authorization Review

## Audit (current baseline)

Existing Identity Phase C patterns (see `docs/supabase-identity-v40-phaseC.sql`):

- `profiles_guard_privileged_update` — blocks self from changing `venue_id` / `club_id` / `status` / `role`; allows `user.manage` same-venue updates for limited fields
- RLS policies on `public.profiles` remain Identity-owned (self select/update, admin paths)
- No anonymous raw SELECT of full profiles PII is introduced by this package

## Changes in this migration

| Area | Change |
|------|--------|
| RLS policies | **None** (no weaken, no new anon access) |
| Trigger guard | **Extended** — self cannot set `identity_verification_status`; other-user change requires super_admin or `user.manage` + same venue |
| Demographics columns | Self-updatable under existing `profiles` self-update RLS (when present) |

## Field-level authorization behavior

| Field | Self update | Admin (`user.manage` / super_admin) | Anon |
|-------|-------------|--------------------------------------|------|
| `birth_date` | Allowed by RLS (app still privacy-gated on read) | Via existing admin update paths | No |
| `handedness` | Allowed | Via existing paths | No |
| `activity_region` | Allowed | Via existing paths | No |
| `privacy_settings` | Allowed | Via existing paths | No |
| `identity_verification_status` | **Blocked by trigger** | Allowed on other users (guard path) | No |

## Gap — AUTHORIZATION WIRING REQUIRED

Row-level RLS alone does not hide columns on SELECT. Public / directory projectors must continue fail-closed privacy filtering in app (or future column-safe RPC).

Dedicated Player Management durable write repository / RPC for `updatePlayerProfile` is **not** in this SQL package.

Admin UI/RPC specifically for verification workflow may still need Product wiring even though the DB guard allows `user.manage` updates.

## Verdict contribution

**PASS WITH AUTHORIZATION WIRING REQUIRED** — do not treat SQL apply as complete Player write path.
