-- M9 rollback boundary (HONEST)
-- Scope: remove ONLY M9-owned NEW objects introduced by this package when safe.
-- CREATE OR REPLACE of pre-existing Production Team Tournament RPCs
-- (e.g. team_tournament_get_setup and related) CANNOT be restored from this file:
-- Production pre-apply definitions were not captured into an immutable rollback pack.
-- Classification: ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS
-- Recovery after those replaces: proven Production backup/PITR restore ONLY.
-- Do not touch identity/catalog protected rows.
-- Do not DROP P1/TT1B foundation tables.

BEGIN;

-- TT5/TT6 bridge objects owned by this package (IF EXISTS)
DROP FUNCTION IF EXISTS public.team_tournament_consume_referee_v5_outbox(uuid, text);
DROP FUNCTION IF EXISTS public.team_tournament_provision_referee_match(text, text, text, uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_provision_eligibility(team_tournaments, team_tournament_matchups, team_tournament_sub_matches, uuid);
DROP FUNCTION IF EXISTS public.team_tournament_get_active_referee_link(text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_referee_link_blocks_legacy(text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_sub_match_is_dreambreaker(text, text, text);

DROP TABLE IF EXISTS public.team_tournament_referee_correction_requests;
DROP TABLE IF EXISTS public.team_tournament_referee_event_inbox;
DROP TABLE IF EXISTS public.team_sub_match_referee_links;

-- NOTE: Do NOT DROP team_tournaments / lineup / standings / matchup foundation tables.
-- NOTE: Replaced get_setup / publish / forfeit RPCs are NOT restored here.

COMMIT;
