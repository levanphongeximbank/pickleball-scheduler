-- team-tournament-court-resource-integration-01 / 04_ROLLBACK
-- DANGEROUS, FAIL-CLOSED rollback.
--
-- This rollback refuses to run when ANY canonical court-resource value has
-- been persisted. Clearing those values merely to pass this guard can destroy
-- scheduling authority and must never be done without a separately reviewed
-- data migration and outage plan.

begin;

do $$
declare
  v_court_id_rows bigint;
  v_cluster_id_rows bigint;
  v_scheduled_end_rows bigint;
  v_signature text;
begin
  select
    count(*) filter (where court_id is not null),
    count(*) filter (where cluster_id is not null),
    count(*) filter (where scheduled_end is not null)
  into v_court_id_rows, v_cluster_id_rows, v_scheduled_end_rows
  from public.team_tournament_matchups;

  if v_court_id_rows <> 0
     or v_cluster_id_rows <> 0
     or v_scheduled_end_rows <> 0 then
    raise exception
      'ROLLBACK_REFUSED: canonical data exists (court_id=%, cluster_id=%, scheduled_end=%). Data-destructive rollback requires a separate approved migration.',
      v_court_id_rows, v_cluster_id_rows, v_scheduled_end_rows;
  end if;

  foreach v_signature in array array[
    'public.team_tournament_cri01_prior_setup_norm_projection(uuid,text,integer)',
    'public.team_tournament_cri01_prior_replace_matchups(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_update_matchup_schedule(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_apply_schedule_batch(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_update_setup_config(text,jsonb,integer,text)',
    'public.team_tournament_cri01_prior_get_setup(text,text,integer,boolean)',
    'public.team_tournament_cri01_prior_get_dashboard(text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'ROLLBACK_REFUSED: exact prior body is unavailable: %', v_signature;
    end if;
  end loop;
end
$$;

-- Restore exact prior definitions in-place so public function OIDs and every
-- existing dependency remain stable.
do $restore$
declare
  v_item record;
  v_definition text;
begin
  for v_item in
    select * from (values
      ('team_tournament_cri01_prior_setup_norm_projection', 'team_tournament_setup_norm_projection',
        'public.team_tournament_cri01_prior_setup_norm_projection(uuid,text,integer)'),
      ('team_tournament_cri01_prior_replace_matchups', 'team_tournament_replace_matchups',
        'public.team_tournament_cri01_prior_replace_matchups(text,jsonb,integer,text)'),
      ('team_tournament_cri01_prior_update_matchup_schedule', 'team_tournament_update_matchup_schedule',
        'public.team_tournament_cri01_prior_update_matchup_schedule(text,jsonb,integer,text)'),
      ('team_tournament_cri01_prior_apply_schedule_batch', 'team_tournament_apply_schedule_batch',
        'public.team_tournament_cri01_prior_apply_schedule_batch(text,jsonb,integer,text)'),
      ('team_tournament_cri01_prior_update_setup_config', 'team_tournament_update_setup_config',
        'public.team_tournament_cri01_prior_update_setup_config(text,jsonb,integer,text)'),
      ('team_tournament_cri01_prior_get_setup', 'team_tournament_get_setup',
        'public.team_tournament_cri01_prior_get_setup(text,text,integer,boolean)'),
      ('team_tournament_cri01_prior_get_dashboard', 'team_tournament_get_dashboard',
        'public.team_tournament_cri01_prior_get_dashboard(text)')
    ) x(prior_name, target_name, signature)
  loop
    v_definition := pg_get_functiondef(to_regprocedure(v_item.signature));
    v_definition := replace(
      v_definition,
      'FUNCTION public.' || v_item.prior_name,
      'FUNCTION public.' || v_item.target_name
    );
    execute v_definition;
  end loop;
end
$restore$;

drop function public.team_tournament_cri01_apply_schedule(text, jsonb, text, integer, text);
drop function public.team_tournament_cri01_validate_setup_payload(jsonb);
drop function public.team_tournament_cri01_prior_setup_norm_projection(uuid, text, integer);
drop function public.team_tournament_cri01_prior_replace_matchups(text, jsonb, integer, text);
drop function public.team_tournament_cri01_prior_update_matchup_schedule(text, jsonb, integer, text);
drop function public.team_tournament_cri01_prior_apply_schedule_batch(text, jsonb, integer, text);
drop function public.team_tournament_cri01_prior_update_setup_config(text, jsonb, integer, text);
drop function public.team_tournament_cri01_prior_get_setup(text, text, integer, boolean);
drop function public.team_tournament_cri01_prior_get_dashboard(text);

-- Restore the prechecked public API ACL contract.
revoke all on function public.team_tournament_replace_matchups(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_update_matchup_schedule(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_apply_schedule_batch(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_update_setup_config(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_get_setup(text, text, integer, boolean) from public, anon;
revoke all on function public.team_tournament_get_dashboard(text) from public, anon;

grant execute on function public.team_tournament_replace_matchups(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_update_matchup_schedule(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_apply_schedule_batch(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_update_setup_config(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_get_setup(text, text, integer, boolean) to authenticated;
grant execute on function public.team_tournament_get_dashboard(text) to authenticated;

alter table public.team_tournament_matchups
  drop constraint team_tournament_matchups_scheduled_interval_chk;

alter table public.team_tournament_matchups
  drop column scheduled_end,
  drop column cluster_id,
  drop column court_id;

commit;
