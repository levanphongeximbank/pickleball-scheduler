-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- Emergency only. LOCAL PACKAGE ONLY. Do NOT apply without Owner GO.
-- SQL_EXECUTION_GO=NO until Owner GO.
--
-- Drops competition_* RPCs/helpers and NEW tables only if empty/safe.
-- NEVER drops public.referee_assignments.
-- Does NOT restore prior team_tournament_create_referee_assignment body.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_block text[] := '{}';
  v_audit_count bigint := 0;
  v_idem_count bigint := 0;
begin
  if to_regclass('public.competition_referee_assignment_audit') is not null then
    execute 'select count(*) from public.competition_referee_assignment_audit'
      into v_audit_count;
    if v_audit_count > 0 then
      v_block := array_append(v_block, format('competition_referee_assignment_audit=%s', v_audit_count));
    end if;
  end if;

  if to_regclass('public.competition_referee_assignment_idempotency') is not null then
    execute 'select count(*) from public.competition_referee_assignment_idempotency'
      into v_idem_count;
    if v_idem_count > 0 then
      v_block := array_append(v_block, format('competition_referee_assignment_idempotency=%s', v_idem_count));
    end if;
  end if;

  if array_length(v_block, 1) is not null then
    raise exception 'ROLLBACK_REFUSED non_empty=% — refuse drop; never drop referee_assignments',
      array_to_string(v_block, ',');
  end if;
end;
$$;

-- Drop RPCs first (public surface).
drop function if exists public.competition_assign_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, jsonb
);
drop function if exists public.competition_replace_referee(
  text, text, text, uuid, text, integer, text, uuid, text, text, boolean, jsonb
);
drop function if exists public.competition_unassign_referee(
  text, text, text, text, integer, text, uuid, text, text, jsonb
);

-- Drop internal helpers.
drop function if exists public.competition_assignment_assert_mutation_boundary(
  text, text, text, uuid, text, boolean
);
drop function if exists public.competition_assignment_remember_idempotency(
  text, text, text, text, text, uuid, integer
);
drop function if exists public.competition_assignment_write_audit(
  text, text, text, uuid, uuid, uuid, text, uuid, text, text, text, integer, integer, boolean, jsonb
);
drop function if exists public.competition_assignment_check_idempotency(text, text, text, text);
drop function if exists public.competition_assignment_payload_hash(jsonb);
drop function if exists public.competition_assignment_scope_version(text, text, text, text);
drop function if exists public.competition_assignment_normalize_role(text);

-- Drop new tables only (empty, per guard above).
drop table if exists public.competition_referee_assignment_idempotency;
drop table if exists public.competition_referee_assignment_audit;

-- Additive index from this package (safe to drop; does not remove rows).
drop index if exists public.competition_referee_assignments_active_match_role_uq;

-- NEVER: drop table public.referee_assignments;
-- NEVER: truncate public.referee_assignments;
-- NEVER: delete from public.referee_assignments;

select 'ROLLBACK_COMPLETE competition assignment runtime objects dropped; referee_assignments preserved' as status;
