-- Daily Play Production prerequisite: install ONLY the gender-key normalizer.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Compatibility extraction for Daily Play #424.
-- Does not apply Team Tournament lineup/gender business SQL.
-- No tables, indexes, or DML.

BEGIN;

CREATE OR REPLACE FUNCTION public.team_tournament_normalize_gender_key(p_gender text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  select case
    when lower(trim(coalesce(p_gender, ''))) in ('nam', 'male', 'm') then 'male'
    when lower(trim(coalesce(p_gender, ''))) in ('nữ', 'nu', 'female', 'f', 'n') then 'female'
    when lower(trim(coalesce(p_gender, ''))) in ('other', 'khac', 'khác') then 'other'
    else 'unknown'
  end;
$$;

-- Preserve established helper EXECUTE contract (Staging grants PUBLIC/anon/authenticated/service_role).
-- Do not narrow grants: Team SQL and Daily SECURITY DEFINER callers may invoke this helper.
GRANT EXECUTE ON FUNCTION public.team_tournament_normalize_gender_key(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_tournament_normalize_gender_key(text) TO anon;
GRANT EXECUTE ON FUNCTION public.team_tournament_normalize_gender_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_tournament_normalize_gender_key(text) TO service_role;

COMMIT;
