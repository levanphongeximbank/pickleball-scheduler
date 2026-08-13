-- team-tournament-owner-browser-acceptance-remediation-01 / 04_ROLLBACK
-- LOCAL ONLY. Emergency rollback after Owner GO apply.
-- Does NOT re-run lifecycle-01 02_APPLY.

drop function if exists public.team_tournament_referee_competition_athlete_directory(text);

do $$
begin
  raise notice 'ROLLBACK_NOTE: team_tournament_referee_competition_athlete_directory dropped.';
  raise notice 'ROLLBACK_NOTE: To remove scoringMode/scoringSystem whitelist from update_setup_config, reinstall the setup_config body from team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql (setup_config segment only). Do not re-apply the full lifecycle package.';
end $$;
