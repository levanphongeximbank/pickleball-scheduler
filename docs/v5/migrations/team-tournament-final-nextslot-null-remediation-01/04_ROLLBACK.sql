-- team-tournament-final-nextslot-null-remediation-01 / 04_ROLLBACK
-- Emergency only. Keeps NULL-safe resolver (restoring NOT IN reintroduces Owner B defect).
-- Drops reconcile helper. Leaves advance_knockout_winner on the fixed resolver.

drop function if exists public.team_tournament_reconcile_knockout_progression(uuid);

do $$
begin
  raise notice 'ROLLBACK_NOTE: reconcile helper dropped; canonical NULL-safe nextSlot resolver retained. Do not restore NOT IN.';
end $$;
