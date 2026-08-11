-- Rollback — DO NOT RUN unless Owner GO to undo Staging apply.
-- Leaves settings JSON keys in place (safe); drops RPC and restores whitelist without update_setup_config.

drop function if exists public.team_tournament_update_setup_config(text, jsonb, integer, text);

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
