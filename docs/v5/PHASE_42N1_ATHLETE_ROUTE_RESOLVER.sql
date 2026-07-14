-- ===========================================================================
-- PHASE 42N.1 — Athlete-route resolver (additive, safe)
-- ---------------------------------------------------------------------------
-- Purpose:
--   Fix PlayerProfile links of the form /players/profile/athlete-{athlete_id}.
--   Adds ONE additive SECURITY DEFINER RPC that maps athlete_id -> user_id on
--   the server, then delegates to the existing platform_resolve_athlete_profile
--   so authorization (FORBIDDEN) and payload shape stay identical.
--
-- Safety:
--   • No data mutation. No schema/table changes. No RLS weakening.
--   • Does NOT touch profiles.club_id, club_data_v3, Pick_VN ratings.
--   • Idempotent: create or replace + grant only.
--   • Depends on Phase 42N objects already deployed:
--       - public.platform_resolve_athlete_profile(uuid)
--       - public.phase42_err(text, text)
--       - public.athletes(id, user_id)
-- ===========================================================================

-- Preconditions (fail fast if Phase 42N is missing).
do $$
begin
  if to_regprocedure('public.platform_resolve_athlete_profile(uuid)') is null then
    raise exception 'phase42n.1: platform_resolve_athlete_profile(uuid) missing — apply Phase 42N first';
  end if;
  if to_regprocedure('public.phase42_err(text, text)') is null then
    raise exception 'phase42n.1: phase42_err(text, text) missing';
  end if;
  if to_regclass('public.athletes') is null then
    raise exception 'phase42n.1: public.athletes missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Resolve by athlete id.
--   auth.uid() null              -> NOT_AUTHENTICATED
--   p_athlete_id null            -> VALIDATION
--   athlete row missing          -> NOT_FOUND
--   athlete.user_id null         -> ATHLETE_NOT_LINKED
--   otherwise                    -> platform_resolve_athlete_profile(user_id)
--                                   (which enforces FORBIDDEN / returns data)
-- ---------------------------------------------------------------------------
create or replace function public.platform_resolve_athlete_by_id(p_athlete_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if p_athlete_id is null then
    return public.phase42_err('VALIDATION', 'Thiếu mã vận động viên.');
  end if;

  -- NOTE: rely on the FOUND special variable. `SELECT ..., true INTO ...`
  -- would set the flag to NULL (not false) on no-row, skipping NOT_FOUND.
  select a.user_id
    into v_user_id
  from public.athletes a
  where a.id = p_athlete_id;

  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy vận động viên.');
  end if;

  if v_user_id is null then
    return public.phase42_err(
      'ATHLETE_NOT_LINKED',
      'Hồ sơ vận động viên chưa được liên kết tài khoản.'
    );
  end if;

  -- Delegate: authorization + payload identical to the by-user resolver.
  return public.platform_resolve_athlete_profile(v_user_id);
end;
$$;

grant execute on function public.platform_resolve_athlete_by_id(uuid) to authenticated;

-- Refresh PostgREST schema cache so the new RPC is exposed immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verification (run after apply):
--   select to_regprocedure('public.platform_resolve_athlete_by_id(uuid)') is not null as rpc_exists;
--   -- As an authorized session (super admin / owner / club governor):
--   -- select public.platform_resolve_athlete_by_id('<athlete_id>');
-- ---------------------------------------------------------------------------
