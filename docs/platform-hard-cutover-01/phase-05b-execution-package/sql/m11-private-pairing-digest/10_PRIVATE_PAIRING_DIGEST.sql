-- M11 — Private Pairing digest patch (STAGING_CATALOG_DERIVED)
-- NOT the original private_pairing_pr4_digest_patch SQL (never found in git history).
-- Derived from Staging canonical pg_get_functiondef for
-- public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid).
-- Staging def_md5 = Production def_md5 = 0be77671f95c52b1d5e00496bee2adf1
-- (live catalog already equivalent; apply is idempotent / verify-focused).
-- Preserves RC1 archive behavior; does not weaken tenant isolation.

CREATE OR REPLACE FUNCTION public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_payload text;
begin
  select coalesce(string_agg(chunk, '|' order by chunk), '')
    into v_payload
  from (
    select
      r.id::text || ':' || r.constraint_type || ':' || r.severity || ':' ||
      coalesce(r.primary_player_id, '') || ':' || coalesce(r.relation_mode, '') || ':' ||
      coalesce(r.weight::text, '') || ':' || coalesce(r.visibility, '') || ':' ||
      coalesce((
        select string_agg(t.target_player_id, ',' order by t.target_player_id)
        from public.private_pairing_rule_targets t
        where t.rule_id = r.id
      ), '') as chunk
    from public.private_pairing_rules r
    where r.rule_set_id = p_rule_set_id
      and r.deleted_at is null
      and r.active = true
  ) s;

  return encode(extensions.digest(v_payload, 'sha256'::text), 'hex');
end;
$function$;

REVOKE ALL ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) TO service_role;
