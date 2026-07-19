-- =============================================================================
-- Phase 1C — Profile guard auth bypass hotfix (SECURITY DEFINER)
-- Branch: fix/player-phase-1c-profile-guard-auth-bypass
--
-- DEFECT: `current_user = 'postgres'` inside SECURITY DEFINER always matches the
-- function owner, so PostgREST JWT updates bypass all privileged-field checks.
--
-- APPLY: Staging only after Owner approval. Do NOT apply to Production here.
-- Rollback: docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_ROLLBACK.sql
-- Verify:   docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_VERIFY.sql
--
-- Unchanged: RLS, policies, trigger name, columns, constraints, indexes.
-- =============================================================================

begin;

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

  -- Explicit service_role bypass (intentional system operations).
  if v_auth_role = 'service_role' then
    return new;
  end if;

  -- Direct DB maintenance without an end-user JWT principal.
  -- Never bypass by matching the SECURITY DEFINER owner via current_user.
  -- session_user alone is unreliable on postgres-pooled connections.
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
  'Phase 1C hotfix: privileged profile update guard. SECURITY DEFINER with search_path=public. Bypasses only service_role or non-JWT maintenance (auth.uid() null and role not authenticated/anon). Never bypasses via SECURITY DEFINER owner current_user.';

-- Trigger attachment unchanged (reaffirm only; no RLS/policy/column changes).
drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();

commit;
