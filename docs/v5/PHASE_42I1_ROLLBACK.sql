-- Phase 42I.1 rollback — restore 42I behavior (NOT recommended after audit constraint fix)
-- Prefer re-apply PHASE_42I1 if hotfix needs adjustment.

\i docs/v5/PHASE_42I_MEMBERSHIP_REVIEW.sql

-- Restore swallowed-audit writer (42C legacy)
create or replace function public.phase42_write_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_tenant_id text,
  p_club_id text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (
    actor_id, actor_email, action, resource_type, resource_id, venue_id, club_id, metadata
  ) values (
    auth.uid(), v_email, p_action, p_resource_type, p_resource_id, p_tenant_id, p_club_id, coalesce(p_metadata, '{}'::jsonb)
  );
exception when others then
  null;
end;
$$;

drop function if exists public.phase42_is_platform_admin();
drop function if exists public.phase42_is_tenant_staff_member(text);
