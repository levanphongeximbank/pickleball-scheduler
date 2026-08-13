-- official-open-sideout-runtime-01 / 04_ROLLBACK.sql
-- DO NOT RUN without explicit Owner GO.
-- Removes Side-out execution columns added by 02_APPLY.sql.

begin;

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_scoring_method_chk;

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_serving_side_chk;

alter table public.tournament_match_live
  drop constraint if exists tournament_match_live_server_number_chk;

alter table public.tournament_match_live
  drop column if exists scoring_method;

alter table public.tournament_match_live
  drop column if exists serving_side;

alter table public.tournament_match_live
  drop column if exists server_number;

alter table public.tournament_match_live
  drop column if exists service_state;

-- If a Side-out-aware RPC body was installed in a later apply, restore the
-- prior Rally-only referee_update_match_score definition from backup / git.

commit;
