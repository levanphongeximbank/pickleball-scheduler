-- ============================================================================
-- PRODUCTION PLAYER DATA REMEDIATION — GENDER NORMALIZATION
-- Target: public.profiles.gender  (project expuvcohlcjzvrrauvud)
-- Canonical contract: male | female | other | null
--
-- SAFETY: DO NOT APPLY until owner GO. This file is tracked for review only.
-- Expected affected rows (audit baseline 2026-08-05): 4  (Nam -> male)
-- Idempotent: repeated runs update 0 rows after first success.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 00_PRECHECK.sql (run first; SELECT only)
-- ---------------------------------------------------------------------------
-- select
--   case
--     when gender is null then '__NULL__'
--     when btrim(gender::text) = '' then '__BLANK__'
--     else gender::text
--   end as gender,
--   count(*)::int as n
-- from public.profiles
-- group by 1
-- order by n desc;
--
-- select count(*)::int as nam_rows
-- from public.profiles
-- where gender = 'Nam';
-- Expected: nam_rows = 4

-- ---------------------------------------------------------------------------
-- 10_FORWARD.sql
-- ---------------------------------------------------------------------------
begin;

-- Guard: only remap exact legacy label 'Nam' (case-sensitive per audit).
update public.profiles
set
  gender = 'male',
  updated_at = coalesce(updated_at, now())
where gender = 'Nam';

-- Optional soft CHECK (nullable + allow only canonical values).
-- Skipped automatically if an incompatible gender CHECK already exists.
do $$
declare
  has_gender_check boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%gender%'
  ) into has_gender_check;

  if not has_gender_check then
    alter table public.profiles
      add constraint profiles_gender_canonical_chk
      check (
        gender is null
        or gender in ('male', 'female', 'other')
      )
      not valid;
    -- Validate separately so existing null/male/female/other pass; fails if dirty remain.
    alter table public.profiles
      validate constraint profiles_gender_canonical_chk;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 20_POSTCHECK.sql (SELECT only)
-- ---------------------------------------------------------------------------
-- select count(*)::int as remaining_nam
-- from public.profiles
-- where gender = 'Nam';
-- Expected: 0
--
-- select count(*)::int as non_canonical
-- from public.profiles
-- where gender is not null
--   and btrim(gender::text) <> ''
--   and lower(btrim(gender::text)) not in ('male', 'female', 'other');
-- Expected: 0

-- ---------------------------------------------------------------------------
-- 90_ROLLBACK.sql
-- ---------------------------------------------------------------------------
-- begin;
-- -- Restore only rows that were 'Nam' before forward (from backup ledger).
-- -- Preferred: restore from pre-apply snapshot / point-in-time backup.
-- -- Example ledger restore (populate before apply):
-- -- update public.profiles p
-- -- set gender = 'Nam'
-- -- from public._remediation_gender_nam_backup b
-- -- where p.id = b.id;
--
-- alter table public.profiles
--   drop constraint if exists profiles_gender_canonical_chk;
-- commit;
