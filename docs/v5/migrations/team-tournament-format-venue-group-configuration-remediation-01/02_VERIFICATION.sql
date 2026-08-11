-- Verification queries — DO NOT APPLY migration from this file.
-- Run after Owner GO apply of 01_UPDATE_SETUP_CONFIG_RPC.sql

-- 1) Function exists
select proname
from pg_proc
where proname = 'team_tournament_update_setup_config';

-- 2) Whitelist includes tournament.update_setup_config
select pg_get_constraintdef(oid)
from pg_constraint
where conname = 'team_tournament_setup_snapshots_command_name_chk';

-- 3) Smoke: settings keys round-trip shape (replace :tid)
-- select settings->'formatPreset', settings->'groupCount', settings->'selectedCourtIds'
-- from public.team_tournaments where id = :tid;
