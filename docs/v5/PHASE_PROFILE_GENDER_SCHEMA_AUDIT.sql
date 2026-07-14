-- Audit: public.profiles.gender (+ birth_year) — read-only evidence
-- Run on Staging then Production. Do NOT add column if it already exists.

-- 1) Columns
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('gender', 'birth_year', 'display_name', 'phone', 'avatar_url')
order by ordinal_position;

-- 2) Constraints mentioning gender / birth_year
select
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'profiles'
  and (
    pg_get_constraintdef(c.oid) ilike '%gender%'
    or pg_get_constraintdef(c.oid) ilike '%birth_year%'
    or c.conname ilike '%gender%'
  );

-- 3) Column comments
select
  a.attname,
  col_description('public.profiles'::regclass, a.attnum) as comment
from pg_attribute a
where a.attrelid = 'public.profiles'::regclass
  and a.attname in ('gender', 'birth_year')
  and not a.attisdropped;

-- 4) Distribution (no PII)
select gender, count(*)::int as n
from public.profiles
group by gender
order by n desc
limit 20;

-- 5) Triggers on profiles
select tgname, pg_get_triggerdef(oid) as def
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal;
