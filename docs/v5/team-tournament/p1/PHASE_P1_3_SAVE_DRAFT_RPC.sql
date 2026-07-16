-- Phase P1.3 — Team Tournament V6 "Lưu giải" real draft mutation
-- Owner-locked command: tournament.save_draft → RPC team_tournament_save_draft
-- Staging-only apply. Production: DO NOT APPLY.
--
-- Persists canonical draft/workflow state in the normalized team_tournaments.settings
-- JSON (settings->'draftState'). Domain rows (teams/members/disciplines/groups/matchups/
-- schedule) are NOT touched and NOT duplicated into a blob. Reuses the shared P1.3
-- prepare/bump/finalize helpers so it increments version once and writes exactly one
-- setup snapshot with full idempotency + optimistic-concurrency semantics.

-- 1) Allow the new command name in the setup snapshot command whitelist.
alter table public.team_tournament_setup_snapshots
  drop constraint if exists team_tournament_setup_snapshots_command_name_chk;
alter table public.team_tournament_setup_snapshots
  add constraint team_tournament_setup_snapshots_command_name_chk
  check (command_name = any (array[
    'discipline.save','discipline.remove','discipline.reorder',
    'groups.replace','groups.clear','matchups.replace',
    'schedule.update','schedule.batch','schedule.publish','schedule.lock',
    'deputies.set','dreambreaker.order_submit','dreambreaker.order_lock',
    'dreambreaker.point','dreambreaker.sync',
    'awards.update','awards.assign','awards.auto_assign',
    'tournament.save_draft','tournament.close','snapshot.restore'
  ]));

-- 2) Real draft mutation.
create or replace function public.team_tournament_save_draft(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prepare json;
  v_header public.team_tournaments;
  v_envelope jsonb;
  v_payload jsonb;
  v_draft jsonb;
  v_draft_state jsonb;
  v_new_version integer;
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.save_draft', p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := v_envelope->'payload';
  v_draft := coalesce(v_payload->'draftState', '{}'::jsonb);

  -- Server-authoritative draft-state marker. Client-derivable fields are trusted only
  -- as hints; savedAt/savedBy/lastSavedVersion are stamped by the server.
  v_draft_state := jsonb_strip_nulls(jsonb_build_object(
    'draftStatus', nullif(v_draft->>'draftStatus',''),
    'workflowStage', nullif(v_draft->>'workflowStage',''),
    'lastCompletedStage', nullif(v_draft->>'lastCompletedStage',''),
    'nextRequiredStage', nullif(v_draft->>'nextRequiredStage',''),
    'nextActionId', nullif(v_draft->>'nextActionId',''),
    'nextActionLabel', nullif(v_draft->>'nextActionLabel',''),
    'engineVersion', nullif(v_envelope->>'engineVersion',''),
    'rulesVersion', nullif(v_envelope->>'rulesVersion','')
  )) || jsonb_build_object(
    'savedAt', to_jsonb(now()),
    'savedBy', to_jsonb(auth.uid()),
    'lastSavedVersion', v_header.version + 1
  );

  update public.team_tournaments
     set settings = coalesce(settings, '{}'::jsonb)
                    || jsonb_build_object('draftState', v_draft_state),
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_header.id;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

revoke all on function public.team_tournament_save_draft(text, jsonb, integer, text) from public, anon;
grant execute on function public.team_tournament_save_draft(text, jsonb, integer, text) to authenticated;
