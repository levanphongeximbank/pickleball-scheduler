# 01 — Defaults, nullability, RLS review (Phase 1D)

## Defaults / nullability

| Column | Null | Default | Rationale |
|--------|------|---------|-----------|
| `birth_date` | YES | NULL | Do not invent from `birth_year` |
| `birth_year` | YES (existing) | unchanged | Legacy retained |
| `handedness` | YES | NULL | Unknown until athlete sets |
| `activity_region` | YES | NULL | No invent |
| `privacy_settings` | YES* | fail-closed jsonb object | Backfill nulls to defaults |
| `identity_verification_status` | NO | `'unverified'` | Explicit identity status; not rating |

\* Column allows NULL at DDL for additive safety; migration backfills nulls to fail-closed object.

## Constraints

- `birth_date <= current_date` (or null)
- `handedness in (right, left, ambidextrous, unknown)` or null
- `identity_verification_status in (unverified, pending, verified, rejected)`
- `privacy_settings` / `activity_region` must be jsonb objects when present
- Privacy boolean keys typed as boolean when present

## RLS / grants

| Object | Phase 1D change |
|--------|-----------------|
| RLS enablement on `profiles` | **Unchanged** |
| Policies (`profiles_self_update`, etc.) | **Unchanged** |
| Grants | **Unchanged** |
| Trigger `profiles_guard_privileged_update_trg` | Reaffirmed |
| Function `profiles_guard_privileged_update` | Replaced with **hotfix-safe** body |

Demographics (`birth_date`, `handedness`, `activity_region`, `privacy_settings`, plus existing self-editable columns) remain writable under existing self-update RLS subject to the guard.

## Protected-field enforcement

| Layer | Rule |
|-------|------|
| App write patch | Forbidden: `verificationStatus`, `identityVerificationStatus`, `identity_verification_status` |
| DB trigger | Self cannot change `identity_verification_status` |
| DB trigger | Other-user verification change requires `user.manage` + same venue (or SUPER_ADMIN) |
| Browser | No `service_role` client |

## Compatibility with write paths

- Runtime bootstrap (PR #69): `updateSelfProfile` → `updateAuthenticatedSelfPlayerProfile` → durable repo → `updateProfileRowById` under session JWT  
- Guard remains in front of all UPDATE paths including PostgREST
