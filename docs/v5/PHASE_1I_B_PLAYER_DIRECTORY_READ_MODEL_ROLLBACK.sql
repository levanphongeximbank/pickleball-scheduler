-- =============================================================================
-- Phase 1I-B — Public Player Directory read model ROLLBACK
-- Pair: docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql
--
-- Safe to run after Staging/Production apply of 1I-B.
-- Drops RPCs + helpers + indexes only. No profile data deleted.
-- DO NOT run unless Owner authorizes rollback.
-- =============================================================================

begin;

drop function if exists public.player_directory_search(text, text, text, integer);
drop function if exists public.player_directory_get(text);
drop function if exists public.player_directory_project_row(text, text, text, jsonb, text, text, jsonb);
drop function if exists public.player_directory_decode_cursor(text);
drop function if exists public.player_directory_encode_cursor(text, text);
drop function if exists public.player_directory_format_activity_region(jsonb);

drop index if exists public.profiles_directory_eligible_name_id_idx;
drop index if exists public.profiles_directory_player_id_idx;

commit;
