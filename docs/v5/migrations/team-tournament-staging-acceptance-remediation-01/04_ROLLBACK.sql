-- team-tournament-staging-acceptance-remediation-01 / 04_ROLLBACK
-- Drops package-owned objects only. Does not backfill or touch live tournament rows.

drop trigger if exists trg_team_tournaments_sync_canonical_name on public.team_tournaments;
drop trigger if exists trg_canonical_tournaments_sync_team_header_name on public.canonical_tournaments;

drop function if exists public.team_tournament_form_pairing_opaque(text, jsonb, text, text, text, text, boolean);
drop function if exists public.private_pairing_load_active_rules_internal(text, text, text);
drop function if exists public.team_tournament_pp_sanitize_teams(jsonb);
drop function if exists public.team_tournament_pp_relation(text, jsonb, jsonb, text, boolean);
drop function if exists public.team_tournament_pp_share_team(jsonb, text, text);
drop function if exists public.team_tournament_rename(text, text);
drop function if exists public.team_tournament_trg_sync_name_from_header();
drop function if exists public.team_tournament_trg_sync_name_from_canonical();
