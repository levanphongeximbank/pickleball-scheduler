-- =============================================================================
-- Phase 1D — Player Profile Migration (Staging-ready canonical package)
-- Branch: feature/player-phase-1d-profile-migration-staging
--
-- Reuses Phase 1C approved additive design:
--   docs/player-management/phase-1c-migration-design/05_RECOMMENDED_SCHEMA_DESIGN.md
--   docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql (historical)
-- Guard body matches Phase 1C auth hotfix (never PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX.sql)
--
-- Field map (app camelCase → DB):
--   birthDate     → birth_date
--   birthYear     → birth_year (EXISTING — retained; not invented from birth_date)
--   handedness    → handedness
--   activityRegion→ activity_region
--   privacySettings → privacy_settings
--   verificationStatus → identity_verification_status
--
-- Properties: additive, idempotent-aware, schema-qualified, non-destructive.
-- Does NOT invent birth_date from birth_year.
-- Does NOT modify Competition / Club / Venue / Rating / Ranking schemas.
-- Does NOT alter RLS policies (trigger guard only).
-- APPLY: Staging only after Owner approval — never Production from this wave.
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

-- birth_year already exists on public.profiles — do not recreate / invent values.

-- ─── 2. Comments ─────────────────────────────────────────────────────────────

comment on column public.profiles.birth_date is
  'Phase 1D Player Management: full DOB (YYYY-MM-DD). Never invent from birth_year. Private by default.';

comment on column public.profiles.handedness is
  'Phase 1D Player Management: right | left | ambidextrous | unknown.';

comment on column public.profiles.activity_region is
  'Phase 1D Player Management: jsonb {countryCode, provinceCode, provinceName, city, district}.';

comment on column public.profiles.privacy_settings is
  'Phase 1D Player Management: fail-closed privacy jsonb (publicProfileEnabled, showPhone, ...).';

comment on column public.profiles.identity_verification_status is
  'Phase 1D Player Management identity verification: unverified | pending | verified | rejected. NOT rating verification. Self cannot modify.';

comment on column public.profiles.birth_year is
  'Năm sinh VĐV — retained. Prefer derive from birth_date on read when birth_date present.';

-- ─── 3. Backfill privacy defaults (fail-closed; preserve existing non-null) ───

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
-- identity_verification_status NOT NULL DEFAULT 'unverified' for new rows;
-- backfill any legacy nulls safely:
update public.profiles
set identity_verification_status = 'unverified'
where identity_verification_status is null;

-- ─── 4. CHECK constraints (idempotent via pg_constraint) ─────────────────────
-- birth_date vs birth_year consistency remains APP-OWNED (legacy-safe).

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

-- ─── 6. Field-level guard (HOTFIXED — never current_user=postgres bypass) ────
-- Self cannot change identity_verification_status.
-- user.manage (same venue) / SUPER_ADMIN may change verification on others.
-- Demographics remain self-updatable via existing profiles_self_update RLS.
-- RLS policies themselves are unchanged.

create or replace function public.profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_manage boolean;
  v_auth_role text;
begin
  v_auth_role := auth.role();

  -- Explicit service_role bypass (intentional system operations only).
  if v_auth_role = 'service_role' then
    return new;
  end if;

  -- Direct DB maintenance without an end-user JWT principal.
  -- Never bypass by matching the SECURITY DEFINER owner via current_user.
  if auth.uid() is null
     and v_auth_role is distinct from 'authenticated'
     and v_auth_role is distinct from 'anon' then
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

  -- Other-user updates: require user.manage + same venue — include verification
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

comment on function public.profiles_guard_privileged_update() is
  'Phase 1D: privileged profile update guard. SECURITY DEFINER search_path=public. Bypasses only service_role or non-JWT maintenance. Never bypasses via SECURITY DEFINER owner current_user. Blocks self identity_verification_status writes.';

drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();

-- RLS policies: unchanged.

commit;
