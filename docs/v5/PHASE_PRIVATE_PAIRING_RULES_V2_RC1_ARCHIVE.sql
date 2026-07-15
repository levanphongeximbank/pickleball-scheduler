-- ─────────────────────────────────────────────────────────────────────
-- Private Pairing Rules V2 — RC-1 enhancement: manual ARCHIVE (soft-hide)
-- Owner-approved (phương án 1). Additive RPC only:
--   * No schema/table change.
--   * No hard delete (keeps the "no hard delete" audit principle).
--   * Reversible: archived rule sets stay in DB; still visible via status filter.
-- Depends on PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql (helpers + audit + tables).
-- Apply on STAGING only for RC-1. Production apply deferred (flags OFF in prod).
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.private_pairing_archive_rule_set(
  p_rule_set_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set public.private_pairing_rule_sets%rowtype;
  v_before jsonb;
begin
  if auth.uid() is null or not public.private_pairing_can('pairing.private_rules.manage') then
    return public.private_pairing_err('PERMISSION_DENIED');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return public.private_pairing_err('REASON_TEXT_REQUIRED');
  end if;

  select * into v_set
  from public.private_pairing_rule_sets
  where id = p_rule_set_id
  for update;

  if not found then
    return public.private_pairing_err('NOT_FOUND');
  end if;
  if not public.private_pairing_tenant_visible(v_set.tenant_id) then
    return public.private_pairing_err('CROSS_TENANT_ACCESS');
  end if;

  -- Idempotent: already archived → return current row.
  if v_set.status = 'archived' then
    return public.private_pairing_ok(jsonb_build_object('rule_set', to_jsonb(v_set)));
  end if;

  v_before := to_jsonb(v_set);

  update public.private_pairing_rule_sets
  set status = 'archived',
      archived_at = now(),
      updated_by = auth.uid()
  where id = v_set.id
  returning * into v_set;

  perform public.private_pairing_write_audit(
    v_set.tenant_id, 'ARCHIVE_RULE_SET', v_set.id, null,
    v_set.scope_type, v_set.scope_id,
    p_reason, v_before, to_jsonb(v_set), p_request_id
  );

  return public.private_pairing_ok(jsonb_build_object('rule_set', to_jsonb(v_set)));
end;
$$;

revoke all on function public.private_pairing_archive_rule_set(uuid, text, uuid) from public, anon;
grant execute on function public.private_pairing_archive_rule_set(uuid, text, uuid) to authenticated;

comment on function public.private_pairing_archive_rule_set(uuid, text, uuid) is
  'RC-1: soft-archive a private pairing rule set (status=archived). SUPER_ADMIN + manage perm. Writes ARCHIVE_RULE_SET audit. No hard delete.';
