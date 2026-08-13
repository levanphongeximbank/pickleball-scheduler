-- team-tournament-close-uuid-type-remediation-01 / 04_ROLLBACK
-- LOCAL ONLY. Emergency rollback after Owner GO apply.
-- Does NOT auto-rerun full lifecycle-01 or owner-browser-acceptance-01.

do $$
begin
  raise notice 'ROLLBACK_NOTE: team-tournament-close-uuid-type-remediation-01';
  raise notice 'ROLLBACK_NOTE: To restore prior close dual-write behavior, reinstall ONLY the team_tournament_close_tournament function body from team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql (close segment, lines ~239-376).';
  raise notice 'ROLLBACK_NOTE: That lifecycle close body uses bare uuid=text WHERE (id = v_header.tournament_id / id = p_tournament_id) and will reintroduce operator does not exist: uuid = text.';
  raise notice 'ROLLBACK_NOTE: Do NOT re-apply the full lifecycle-01 package. Do NOT re-run owner-browser-acceptance-01.';
  raise notice 'ROLLBACK_NOTE: assert_close_readiness / champion / CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO / auth grants are unchanged by this remediation package.';
end $$;
