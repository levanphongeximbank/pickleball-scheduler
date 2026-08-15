-- Disposable local PostgreSQL bootstrap for Court Resource Phase 3B.
-- Never point this at Staging (qyewbxjsiiyufanzcjcq) or Production (expuvcohlcjzvrrauvud).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS public.venues (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'venue'
);
CREATE TABLE IF NOT EXISTS public.clubs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.venues(id),
  name text NOT NULL DEFAULT 'club'
);
CREATE TABLE IF NOT EXISTS public.court_clusters (
  id text PRIMARY KEY,
  venue_id text NOT NULL REFERENCES public.venues(id),
  name text NOT NULL DEFAULT 'cluster'
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'PLAYER',
  venue_id text,
  club_id text,
  status text NOT NULL DEFAULT 'active'
);

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN' AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_venue_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.venue_id FROM public.profiles p
  WHERE p.id = auth.uid() AND p.status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_cluster(p_cluster_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.court_clusters c
    WHERE c.id = p_cluster_id AND c.venue_id = public.user_venue_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.phase42_has_gov_role(p_club_id text, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
      AND p.club_id = p_club_id
  );
$$;

CREATE TABLE IF NOT EXISTS public.canonical_tournaments (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  mode text NOT NULL DEFAULT 'daily_play',
  status text NOT NULL DEFAULT 'active',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_play_court_leases (
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  tournament_id uuid NOT NULL,
  match_id text NOT NULL,
  court_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  leased_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_play_court_leases_one_active_court_uidx
  ON public.daily_play_court_leases (tenant_id, club_id, court_id)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.daily_play_assign_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'stub', true); $$;

CREATE OR REPLACE FUNCTION public.daily_play_change_court(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_court_id text, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'stub', true); $$;

CREATE OR REPLACE FUNCTION public.daily_play_submit_score(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_score_a integer, p_score_b integer, p_expected_version integer, p_idempotency_key text
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'stub', true); $$;

CREATE OR REPLACE FUNCTION public.daily_play_cancel_match(
  p_tenant_id text, p_club_id text, p_tournament_id uuid, p_match_id text,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'stub', true); $$;

CREATE OR REPLACE FUNCTION public.daily_play_close_session(
  p_tenant_id text, p_club_id text, p_tournament_id uuid,
  p_expected_version integer, p_idempotency_key text
) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'stub', true); $$;

CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_tenant(p_tenant_id text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;
CREATE OR REPLACE FUNCTION public.canonical_tournament_assert_permission(p_perm text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;
CREATE OR REPLACE FUNCTION public.daily_play_begin_command(text,uuid,text,text)
RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true, 'replay', false); $$;
CREATE OR REPLACE FUNCTION public.daily_play_finish_command(text,uuid,text,text,jsonb)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;
CREATE OR REPLACE FUNCTION public.daily_play_session_write_denied(text)
RETURNS jsonb LANGUAGE sql AS $$ SELECT NULL::jsonb; $$;
CREATE OR REPLACE FUNCTION public.daily_play_version_conflict(integer,integer)
RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT'); $$;
CREATE OR REPLACE FUNCTION public.daily_play_match_player_ids(jsonb)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '[]'::jsonb; $$;
CREATE OR REPLACE FUNCTION public.daily_play_athlete_eligible_for_club(text,text,text)
RETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;
CREATE OR REPLACE FUNCTION public.daily_play_read_courts(text,jsonb)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '[]'::jsonb; $$;
CREATE OR REPLACE FUNCTION public.daily_play_replace_match(jsonb,text,jsonb)
RETURNS jsonb LANGUAGE sql AS $$ SELECT $3; $$;
CREATE OR REPLACE FUNCTION public.daily_play_write_state(uuid,integer,jsonb)
RETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;
