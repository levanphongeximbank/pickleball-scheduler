-- Wave 5 Staging remediation — 03_VERIFY_CLUB_TRUNCATE.sql
-- READ ONLY. Fail-closed. Do not mutate.
-- TARGET=STAGING PROJECT_REF=qyewbxjsiiyufanzcjcq
-- VERIFY_READ_ONLY=YES
-- Required: CLUB_TRUNCATE_REMEDIATION_VERIFY=PASS
-- service_role matrix must equal pre-APPLY audited state (I/U/D/TRUNCATE PRESENT).

DO $$
DECLARE
  tables text[] := ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ];
  t text;
  v_rls boolean;
  v_forced boolean;
  v_anon_ins boolean;
  v_anon_upd boolean;
  v_anon_del boolean;
  v_anon_tr boolean;
  v_auth_ins boolean;
  v_auth_upd boolean;
  v_auth_del boolean;
  v_auth_tr boolean;
  v_pub_dml int;
  v_writer_pol int;
  v_select_pol int;
  v_svc_ins boolean;
  v_svc_upd boolean;
  v_svc_del boolean;
  v_svc_tr boolean;
  v_svc_bypass boolean;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL missing table public.%', t;
    END IF;

    SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_rls, v_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t;

    IF v_rls IS NOT TRUE THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL RLS not enabled on public.%', t;
    END IF;
    IF v_forced IS TRUE THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL RLS forced on public.%', t;
    END IF;

    v_anon_ins := has_table_privilege('anon', format('public.%I', t), 'INSERT');
    v_anon_upd := has_table_privilege('anon', format('public.%I', t), 'UPDATE');
    v_anon_del := has_table_privilege('anon', format('public.%I', t), 'DELETE');
    v_anon_tr := has_table_privilege('anon', format('public.%I', t), 'TRUNCATE');
    v_auth_ins := has_table_privilege('authenticated', format('public.%I', t), 'INSERT');
    v_auth_upd := has_table_privilege('authenticated', format('public.%I', t), 'UPDATE');
    v_auth_del := has_table_privilege('authenticated', format('public.%I', t), 'DELETE');
    v_auth_tr := has_table_privilege('authenticated', format('public.%I', t), 'TRUNCATE');

    IF v_anon_ins OR v_anon_upd OR v_anon_del OR v_anon_tr THEN
      RAISE EXCEPTION
        'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL anon I/U/D/TRUNCATE must be DENIED on public.% ins=% upd=% del=% tr=%',
        t, v_anon_ins, v_anon_upd, v_anon_del, v_anon_tr;
    END IF;
    IF v_auth_ins OR v_auth_upd OR v_auth_del OR v_auth_tr THEN
      RAISE EXCEPTION
        'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL authenticated I/U/D/TRUNCATE must be DENIED on public.% ins=% upd=% del=% tr=%',
        t, v_auth_ins, v_auth_upd, v_auth_del, v_auth_tr;
    END IF;

    SELECT count(*) INTO v_pub_dml
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, '{}'::aclitem[])) acl
    WHERE n.nspname = 'public'
      AND c.relname = t
      AND acl.grantee = 0
      AND acl.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
    IF v_pub_dml > 0 THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL PUBLIC DML present on public.% count=%', t, v_pub_dml;
    END IF;

    SELECT count(*) INTO v_writer_pol
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = t
      AND pol.polcmd IN ('a', 'w', 'd', '*');
    IF v_writer_pol > 0 THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL writer policy present on public.% count=%', t, v_writer_pol;
    END IF;

    SELECT count(*) INTO v_select_pol
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = t
      AND pol.polcmd = 'r';
    IF v_select_pol < 1 THEN
      RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL SELECT policy inventory missing on public.%', t;
    END IF;

    v_svc_ins := has_table_privilege('service_role', format('public.%I', t), 'INSERT');
    v_svc_upd := has_table_privilege('service_role', format('public.%I', t), 'UPDATE');
    v_svc_del := has_table_privilege('service_role', format('public.%I', t), 'DELETE');
    v_svc_tr := has_table_privilege('service_role', format('public.%I', t), 'TRUNCATE');
    IF NOT (v_svc_ins AND v_svc_upd AND v_svc_del AND v_svc_tr) THEN
      RAISE EXCEPTION
        'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL service_role privilege matrix changed on public.% ins=% upd=% del=% tr=%',
        t, v_svc_ins, v_svc_upd, v_svc_del, v_svc_tr;
    END IF;
  END LOOP;

  SELECT rolbypassrls INTO v_svc_bypass FROM pg_roles WHERE rolname = 'service_role';
  IF v_svc_bypass IS NOT TRUE THEN
    RAISE EXCEPTION 'CLUB_TRUNCATE_REMEDIATION_VERIFY=FAIL service_role rolbypassrls changed';
  END IF;

  RAISE NOTICE 'CLUB_TRUNCATE_REMEDIATION_VERIFY=PASS';
END $$;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relacl AS raw_relacl,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  )
ORDER BY c.relname;

SELECT
  t.table_name,
  r.rolname,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'SELECT') AS select_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'INSERT') AS insert_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'UPDATE') AS update_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'DELETE') AS delete_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'TRUNCATE') AS truncate_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'REFERENCES') AS references_priv,
  has_table_privilege(r.rolname, format('public.%I', t.table_name), 'TRIGGER') AS trigger_priv
FROM (
  VALUES
    ('clubs'),
    ('club_members'),
    ('club_governance_assignments'),
    ('club_membership_requests_v42')
) AS t(table_name)
CROSS JOIN (
  VALUES ('anon'), ('authenticated'), ('service_role')
) AS r(rolname)
ORDER BY t.table_name, r.rolname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pol.polname,
  pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  )
ORDER BY c.relname, pol.polname;

SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname = 'service_role';
