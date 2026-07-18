-- =============================================================================
-- Phase 1C — Player Profile Foundation (additive columns on public.profiles)
-- Branch: feature/player-phase-1c-migration-sql
-- Design: docs/player-management/phase-1c-migration-design/05_RECOMMENDED_SCHEMA_DESIGN.md
--
-- APPLY: Staging only after Owner approval — DO NOT apply from this authoring task.
-- Rollback: docs/player-management/phase-1c-migration-sql/05_ROLLBACK_SQL.md
--           (executable copy: docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION_ROLLBACK.sql)
--
-- Properties: additive, idempotent-aware, schema-qualified, non-destructive.
-- Does NOT invent birth_date from birth_year.
-- Does NOT modify Competition / Club / Venue / Rating / Ranking schemas.
-- =============================================================================

begin;

-- ─── 1. Additive columns ─────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  add column if not exists handedness text;

alter table public.profiles
  add column if not exists activity_region jsonb;

alter table public.profiles
  add column if not exists privacy_settings jsonb
    default jsonb_build_object(
      'version', 1,
      'publicProfileEnabled', false,
      'showPhone', false,
      'showEmail', false,
      'showBirthDate', false,
      'showBirthYear', false,
      'showActivityRegion', false,
      'showClubMemberships', false,
      'showGender', true,
      'showHandedness', true
    );

alter table public.profiles
  add column if not exists identity_verification_status text
    not null
    default 'unverified';

-- ─── 2. Comments (Player Management foundation — not RBAC) ───────────────────

comment on column public.profiles.birth_date is
  'Phase 1C Player Management: full DOB (YYYY-MM-DD). Never invent from birth_year. Private by default.';

comment on column public.profiles.handedness is
  'Phase 1C Player Management: right | left | ambidextrous | unknown.';

comment on column public.profiles.activity_region is
  'Phase 1C Player Management: jsonb {countryCode, provinceCode, provinceName, city, district}.';

comment on column public.profiles.privacy_settings is
  'Phase 1C Player Management: fail-closed privacy jsonb (publicProfileEnabled, showPhone, ...).';

comment on column public.profiles.identity_verification_status is
  'Phase 1C Player Management identity verification: unverified | pending | verified | rejected. NOT rating verification.';

comment on column public.profiles.birth_year is
  'Năm sinh VĐV — retained. Prefer derive from birth_date on read when birth_date present.';

-- ─── 3. Backfill privacy defaults (explicit fail-closed; preserve birth_year) ─

update public.profiles
set privacy_settings = jsonb_build_object(
  'version', 1,
  'publicProfileEnabled', false,
  'showPhone', false,
  'showEmail', false,
  'showBirthDate', false,
  'showBirthYear', false,
  'showActivityRegion', false,
  'showClubMemberships', false,
  'showGender', true,
  'showHandedness', true
)
where privacy_settings is null;

-- birth_date / handedness / activity_region intentionally left NULL (no invent).
-- identity_verification_status already NOT NULL DEFAULT 'unverified'.

-- ─── 4. CHECK constraints (idempotent via pg_constraint) ─────────────────────
-- NOTE: birth_date vs birth_year consistency is APP-OWNED (legacy-safe).
--       Do not add a DB consistency CHECK in this wave.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_birth_date_not_future_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_birth_date_not_future_check
      check (birth_date is null or birth_date <= current_date);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_handedness_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_handedness_check
      check (
        handedness is null
        or handedness in ('right', 'left', 'ambidextrous', 'unknown')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_identity_verification_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_identity_verification_status_check
      check (
        identity_verification_status in ('unverified', 'pending', 'verified', 'rejected')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_privacy_settings_object_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_privacy_settings_object_check
      check (
        privacy_settings is null
        or jsonb_typeof(privacy_settings) = 'object'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_privacy_settings_booleans_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_privacy_settings_booleans_check
      check (
        privacy_settings is null
        or (
          (not (privacy_settings ? 'publicProfileEnabled')
            or jsonb_typeof(privacy_settings -> 'publicProfileEnabled') = 'boolean')
          and (not (privacy_settings ? 'showPhone')
            or jsonb_typeof(privacy_settings -> 'showPhone') = 'boolean')
          and (not (privacy_settings ? 'showEmail')
            or jsonb_typeof(privacy_settings -> 'showEmail') = 'boolean')
          and (not (privacy_settings ? 'showBirthDate')
            or jsonb_typeof(privacy_settings -> 'showBirthDate') = 'boolean')
          and (not (privacy_settings ? 'showBirthYear')
            or jsonb_typeof(privacy_settings -> 'showBirthYear') = 'boolean')
          and (not (privacy_settings ? 'showActivityRegion')
            or jsonb_typeof(privacy_settings -> 'showActivityRegion') = 'boolean')
          and (not (privacy_settings ? 'showClubMemberships')
            or jsonb_typeof(privacy_settings -> 'showClubMemberships') = 'boolean')
          and (not (privacy_settings ? 'showGender')
            or jsonb_typeof(privacy_settings -> 'showGender') = 'boolean')
          and (not (privacy_settings ? 'showHandedness')
            or jsonb_typeof(privacy_settings -> 'showHandedness') = 'boolean')
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_activity_region_object_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_activity_region_object_check
      check (
        activity_region is null
        or jsonb_typeof(activity_region) = 'object'
      );
  end if;
end
$$;

-- ─── 5. Index (admin verification queues) ────────────────────────────────────

create index if not exists profiles_identity_verification_status_partial_idx
  on public.profiles (identity_verification_status)
  where identity_verification_status is distinct from 'unverified';

-- No GIN on activity_region in this wave (no query evidence yet).

-- ─── 6. Field-level guard: identity_verification_status ───────────────────────
-- Extends existing profiles_guard_privileged_update (Phase C pattern).
-- - Self cannot change identity_verification_status
-- - Super admin / user.manage (same venue) may change it on others
-- - Demographics (birth_date, handedness, activity_region, privacy_settings)
--   remain self-updatable via existing profiles_self_update RLS
-- Full admin RPC / Player durable wiring remains a follow-up task.

create or replace function public.profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_manage boolean;
begin
  if current_user = 'postgres' or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_super_admin() and not public.user_has_permission('role.manage') then
      raise exception 'Only SUPER_ADMIN can change profile role';
    end if;
  end if;

  -- Self: cannot change account-privileged fields OR identity verification status
  if auth.uid() = old.id and not public.is_super_admin() then
    if new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.status is distinct from old.status
       or new.role is distinct from old.role then
      raise exception 'Cannot modify protected profile fields';
    end if;

    if new.identity_verification_status is distinct from old.identity_verification_status then
      raise exception 'Cannot self-modify identity_verification_status';
    end if;
  end if;

  -- Other-user updates: require user.manage + same venue (Phase C) — include verification
  if auth.uid() is distinct from old.id
     and not public.is_super_admin()
     and (
       new.status is distinct from old.status
       or new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.display_name is distinct from old.display_name
       or coalesce(new.phone, '') is distinct from coalesce(old.phone, '')
       or coalesce(new.avatar_url, '') is distinct from coalesce(old.avatar_url, '')
       or new.identity_verification_status is distinct from old.identity_verification_status
     ) then
    v_can_manage := public.user_has_permission('user.manage')
      and old.venue_id is not null
      and old.venue_id = public.user_venue_id();

    if not v_can_manage then
      raise exception 'Cannot modify another user profile';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();

-- RLS policies: unchanged (no anon raw PII expansion).
-- Column sensitivity for public reads remains application projector / future RPC.

commit;
