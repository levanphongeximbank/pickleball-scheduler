# 06 — Static Verification SQL

**Non-apply authoring artifact.** Run these checks on Staging **after** forward migration apply (Owner-approved apply only). Do not connect from this authoring task.

Executable companion: `docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_VERIFY.sql`

## Purpose

Confirm columns, constraints, index, guard function, and backfill sanity without mutating production.

## Read-only checks

```sql
-- 1) Columns exist with expected types / nullability / defaults
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'birth_date',
    'handedness',
    'activity_region',
    'privacy_settings',
    'identity_verification_status',
    'birth_year',
    'gender',
    'player_id'
  )
order by column_name;

-- 2) Constraints present
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname in (
    'profiles_birth_date_not_future_check',
    'profiles_handedness_check',
    'profiles_identity_verification_status_check',
    'profiles_privacy_settings_object_check',
    'profiles_privacy_settings_booleans_check',
    'profiles_activity_region_object_check'
  )
order by conname;

-- 3) Partial index present
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'profiles'
  and indexname = 'profiles_identity_verification_status_partial_idx';

-- 4) Guard function mentions identity_verification_status
select
  proname,
  position('identity_verification_status' in pg_get_functiondef(oid)) > 0 as guards_verification
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'profiles_guard_privileged_update';

-- 5) Backfill sanity
select
  count(*) as total_profiles,
  count(*) filter (where privacy_settings is null) as privacy_null,
  count(*) filter (where identity_verification_status is null) as verification_null,
  count(*) filter (where birth_date is not null) as birth_date_populated,
  count(*) filter (where handedness is not null) as handedness_populated,
  count(*) filter (where activity_region is not null) as region_populated
from public.profiles;
```

## Expected after forward apply

| Check | Expected |
|-------|----------|
| `birth_date` | date, YES, no invent from birth_year |
| `handedness` | text, YES, NULL ok |
| `activity_region` | jsonb, YES |
| `privacy_settings` | jsonb; `privacy_null` = 0 after backfill |
| `identity_verification_status` | text, NO, default unverified |
| `birth_year` / `gender` / `player_id` | still present |
| Constraints | all six named CHECKs |
| Index | partial where status IS DISTINCT FROM 'unverified' |
| Guard | `guards_verification` = true |

## Negative probes (Staging only, expect FAIL)

```sql
-- update public.profiles set birth_date = (current_date + 1) where id = '<self>';
-- update public.profiles set handedness = 'both' where id = '<self>';
-- update public.profiles set identity_verification_status = 'bogus' where id = '<self>';
-- update public.profiles set privacy_settings = '[]'::jsonb where id = '<self>';
-- update public.profiles set activity_region = '"HN"'::jsonb where id = '<self>';
-- update public.profiles set identity_verification_status = 'verified' where id = auth.uid();
```
