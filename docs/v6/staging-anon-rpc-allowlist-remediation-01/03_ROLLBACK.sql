-- STAGING ONLY. Restores the exact pseudo-PUBLIC/anon ACL snapshot.
begin;

do $phase6$
declare
  fn record;
begin
  for fn in
    select function_signature, had_pseudo_public_execute, had_anon_execute
    from phase6_internal.security_definer_acl_snapshot_01
  loop
    if to_regprocedure(fn.function_signature) is null then
      raise exception 'Cannot restore missing function: %', fn.function_signature;
    end if;
    execute format('revoke execute on function %s from public, anon', fn.function_signature);
    if fn.had_pseudo_public_execute then
      execute format('grant execute on function %s to public', fn.function_signature);
    end if;
    if fn.had_anon_execute then
      execute format('grant execute on function %s to anon', fn.function_signature);
    end if;
  end loop;
end
$phase6$;

alter default privileges for role postgres in schema public
  grant execute on functions to anon;

commit;

