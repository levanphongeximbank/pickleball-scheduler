-- Daily Play end-to-end canonical remediation rollback.
-- DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Drops only package-owned objects. Does not touch canonical_tournaments or
-- club_data_v3 schema/data and does not rewrite tournament payloads.

BEGIN;

DROP FUNCTION IF EXISTS public.daily_play_change_court(
  text,text,uuid,text,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_cancel_match(
  text,text,uuid,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_submit_score(
  text,text,uuid,text,integer,integer,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_start_match(
  text,text,uuid,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_assign_court(
  text,text,uuid,text,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_create_matches(
  text,text,uuid,jsonb,integer,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_check_out(
  text,text,uuid,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_check_in(
  text,text,uuid,text,integer,text
);
DROP FUNCTION IF EXISTS public.daily_play_get_state(text,text,uuid);

DROP FUNCTION IF EXISTS public.daily_play_snapshot(text,text,uuid);
DROP FUNCTION IF EXISTS public.daily_play_write_state(uuid,integer,jsonb);
DROP FUNCTION IF EXISTS public.daily_play_replace_match(jsonb,text,jsonb);
DROP FUNCTION IF EXISTS public.daily_play_read_courts(text,jsonb);
DROP FUNCTION IF EXISTS public.daily_play_athlete_eligible_for_club(text,text,text);
DROP FUNCTION IF EXISTS public.daily_play_match_player_ids(jsonb);
DROP FUNCTION IF EXISTS public.daily_play_finish_command(text,uuid,text,text,jsonb);
DROP FUNCTION IF EXISTS public.daily_play_begin_command(text,uuid,text,text);
DROP FUNCTION IF EXISTS public.daily_play_version_conflict(integer,integer);

DROP TABLE IF EXISTS public.daily_play_command_ledger;
DROP TABLE IF EXISTS public.daily_play_court_leases;

COMMIT;
