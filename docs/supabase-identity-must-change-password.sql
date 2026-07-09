-- Pickleball Scheduler Pro — Admin temp password / force change on first login
-- Apply on Production BEFORE deploying app code that uses must_change_password.
--
-- Usage (Supabase Dashboard → SQL Editor → Production project):
--   1. Paste and run this file
--   2. Verify: select column_name from information_schema.columns
--              where table_schema = 'public' and table_name = 'profiles'
--                and column_name = 'must_change_password';

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'True when admin created user with auto-generated temp password; user must change password on first login.';
