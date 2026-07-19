-- =============================================================================
-- Phase 1C — Player Profile Foundation ROLLBACK
-- Reverses ONLY objects introduced by PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql
--
-- DO NOT EXECUTE without Owner approval.
-- DATA LOSS RISK: dropping columns discards birth_date, handedness,
-- activity_region, privacy_settings, identity_verification_status values.
-- Export / backup profiles rows for these columns before DROP.
-- Does NOT touch birth_year, gender, player_id, or account/RBAC columns.
-- =============================================================================

begin;

-- Restore Phase C privileged-update guard (without identity_verification_status)
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

  if auth.uid() = old.id and not public.is_super_admin() then
    if new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.status is distinct from old.status
       or new.role is distinct from old.role then
      raise exception 'Cannot modify protected profile fields';
    end if;
  end if;

  if auth.uid() is distinct from old.id
     and not public.is_super_admin()
     and (
       new.status is distinct from old.status
       or new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.display_name is distinct from old.display_name
       or coalesce(new.phone, '') is distinct from coalesce(old.phone, '')
       or coalesce(new.avatar_url, '') is distinct from coalesce(old.avatar_url, '')
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

drop index if exists public.profiles_identity_verification_status_partial_idx;

alter table public.profiles
  drop constraint if exists profiles_birth_date_not_future_check;

alter table public.profiles
  drop constraint if exists profiles_handedness_check;

alter table public.profiles
  drop constraint if exists profiles_identity_verification_status_check;

alter table public.profiles
  drop constraint if exists profiles_privacy_settings_object_check;

alter table public.profiles
  drop constraint if exists profiles_privacy_settings_booleans_check;

alter table public.profiles
  drop constraint if exists profiles_activity_region_object_check;

-- WARNING: irreversible data loss for these five columns
alter table public.profiles drop column if exists birth_date;
alter table public.profiles drop column if exists handedness;
alter table public.profiles drop column if exists activity_region;
alter table public.profiles drop column if exists privacy_settings;
alter table public.profiles drop column if exists identity_verification_status;

commit;
