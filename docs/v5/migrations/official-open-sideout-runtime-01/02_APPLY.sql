-- official-open-sideout-runtime-01 / 02_APPLY.sql
-- DO NOT RUN without explicit Owner GO.
-- Extends Official live execution model for true Side-out service state.
-- Keeps tournament_match_live as execution/read model; canonical results stay elsewhere.

begin;

-- Structured service / scoring method fields (idempotent)
alter table public.tournament_match_live
  add column if not exists scoring_method text not null default 'rally';

alter table public.tournament_match_live
  add column if not exists serving_side text null;

alter table public.tournament_match_live
  add column if not exists server_number smallint null;

alter table public.tournament_match_live
  add column if not exists service_state jsonb not null default '{}'::jsonb;

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_scoring_method_chk;

alter table public.tournament_match_live
  add constraint tournament_match_live_scoring_method_chk
  check (scoring_method in ('rally', 'side_out'));

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_serving_side_chk;

alter table public.tournament_match_live
  add constraint tournament_match_live_serving_side_chk
  check (serving_side is null or serving_side in ('A', 'B'));

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_server_number_chk;

alter table public.tournament_match_live
  add constraint tournament_match_live_server_number_chk
  check (server_number is null or server_number in (1, 2));

comment on column public.tournament_match_live.scoring_method is
  'Official live scoring method: rally | side_out';
comment on column public.tournament_match_live.serving_side is
  'Current serving side A/B for side_out; null for rally-only rows';
comment on column public.tournament_match_live.server_number is
  'Doubles side-out server number 1|2';
comment on column public.tournament_match_live.service_state is
  'Optional structured service bag; live remains execution model only';

-- NOTE (Owner follow-up after GO):
-- Replace/extend public.referee_update_match_score to accept Side-out rally outcomes
-- (winning side + token scope) and apply serving transition atomically.
-- This APPLY ships schema foundations first; RPC body hardening must land in the
-- same Owner-approved apply window before app sets SIDEOUT_OPERATIONAL=true.

commit;
