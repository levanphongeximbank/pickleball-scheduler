-- STAGING ONLY / PREPARED ONLY. Requires a separate exact Owner GO to apply.
begin;

create schema if not exists phase6_internal;
revoke all on schema phase6_internal from public, anon, authenticated;

create table if not exists phase6_internal.security_definer_acl_snapshot_01 (
  function_signature text primary key,
  had_pseudo_public_execute boolean not null,
  had_anon_execute boolean not null,
  captured_at timestamptz not null default now()
);
revoke all on table phase6_internal.security_definer_acl_snapshot_01 from public, anon, authenticated;
truncate table phase6_internal.security_definer_acl_snapshot_01;

insert into phase6_internal.security_definer_acl_snapshot_01 (
  function_signature, had_pseudo_public_execute, had_anon_execute
)
select
  p.oid::regprocedure::text,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = (select oid from pg_roles where rolname = 'anon')
      and a.privilege_type = 'EXECUTE'
  )
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;

-- New postgres-owned functions must be explicitly granted to anon.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

do $phase6$
declare
  fn record;
  allowlist regprocedure[] := array[
    'public.news_public_content_query_public(timestamp with time zone,text,text,integer)'::regprocedure,
    'public.public_catalog_list_clubs(integer,integer,text)'::regprocedure,
    'public.public_catalog_list_courts(integer,integer,text,text)'::regprocedure,
    'public.public_catalog_list_rankings(integer,integer,text,text)'::regprocedure,
    'public.public_catalog_list_tournaments(integer,integer,text)'::regprocedure,
    'public.referee_get_match_by_token(text)'::regprocedure,
    'public.referee_update_match_score(text,jsonb)'::regprocedure
  ];
begin
  for fn in
    select p.oid, p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
    if fn.oid = any (allowlist) then
      execute format('grant execute on function %s to anon', fn.signature);
    end if;
  end loop;
end
$phase6$;

commit;

