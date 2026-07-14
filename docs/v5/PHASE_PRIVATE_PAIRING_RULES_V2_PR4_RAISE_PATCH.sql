-- ============================================================================
-- PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql
-- STAGING ONLY — fix duplicate RAISE MESSAGE options (42601)
-- ============================================================================

create or replace function public.private_pairing_block_hard_delete_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'HARD_DELETE_FORBIDDEN'
    using errcode = 'P0001';
end;
$$;

create or replace function public.private_pairing_block_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'AUDIT_APPEND_ONLY'
    using errcode = 'P0001';
end;
$$;

create or replace function public.private_pairing_validate_target_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_primary text;
begin
  select r.primary_player_id into v_primary
  from public.private_pairing_rules r
  where r.id = new.rule_id;

  if v_primary is not null and v_primary = new.target_player_id then
    raise exception 'SELF_TARGET_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  if new.tenant_id is distinct from (
    select r.tenant_id from public.private_pairing_rules r where r.id = new.rule_id
  ) then
    raise exception 'CROSS_TENANT_ACCESS'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
