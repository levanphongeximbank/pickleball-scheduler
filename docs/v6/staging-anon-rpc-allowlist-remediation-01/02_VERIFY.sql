-- Expected: anon_callable=7, pseudo_public_callable=0, snapshot_count=298,
-- default_anon_execute=false.
with f as (
  select p.oid, p.proowner, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
)
select
  count(*) filter (where has_function_privilege('anon', oid, 'execute')) as anon_callable,
  count(*) filter (where exists (
    select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  )) as pseudo_public_callable,
  (select count(*) from phase6_internal.security_definer_acl_snapshot_01) as snapshot_count,
  exists (
    select 1 from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
      and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'f'
      and a.grantee = (select oid from pg_roles where rolname = 'anon')
      and a.privilege_type = 'EXECUTE'
  ) as default_anon_execute
from f;

select p.oid::regprocedure::text as anon_callable_signature
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by 1;

