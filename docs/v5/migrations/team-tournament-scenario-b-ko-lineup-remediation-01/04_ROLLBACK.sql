-- team-tournament-scenario-b-ko-lineup-remediation-01 / 04_ROLLBACK
-- Emergency only. Restores replace_matchups as thin apply_domain delegate
-- (reintroduces UNKNOWN_TEAM on empty KO placeholders + delete-all CASCADE wipe).

create or replace function public.team_tournament_replace_matchups(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language sql
security definer
set search_path = public
as $$
  select public.team_tournament_apply_domain_setup_mutation(
    $1, $2, 'matchups.replace', $3, $4
  );
$$;

revoke all on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  to authenticated;

do $$
begin
  raise notice 'ROLLBACK_NOTE: replace_matchups again delegates to apply_domain matchups.replace (B3/B2 defects return).';
end $$;
