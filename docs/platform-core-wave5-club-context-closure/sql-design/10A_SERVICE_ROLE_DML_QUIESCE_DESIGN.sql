-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- PHASE_Q0A_SERVICE_ROLE_DIRECT_DML_QUIESCE
-- Q0A: establish control tables, create the single PREPARED batch, snapshot
-- exact service_role Club table DML (INSERT/UPDATE/DELETE/TRUNCATE), REVOKE
-- those privileges, verify effective DENIED, COMMIT.
--
-- Q0A_PRECEDES_Q1A=YES
-- Q0A_CREATES_PREPARED_BATCH=YES
-- Q1A_MUST_NOT_CREATE_BATCH=YES
-- ONE_ACTIVE_CUTOVER_BATCH=YES
-- SERVICE_ROLE_DIRECT_DML_GUARD_DESIGNED=YES
-- SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES
-- WAVE5_DEFAULT_ACL_MUTATION=NO
-- PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE
-- SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO
-- CUTOVER_METADATA_PUBLIC_ACCESS=DENIED
-- CUTOVER_METADATA_AUTHENTICATED_ACCESS=DENIED
-- CUTOVER_METADATA_ANON_ACCESS=DENIED
-- CONTROL_PLANE_EXISTING_SCHEMA_GUARD=YES
-- CONTROL_PLANE_DRIFT_ABORTS_Q0A=YES
--
-- Scope (exact):
--   grantee = service_role
--   tables  = clubs, club_members, club_governance_assignments,
--             club_membership_requests_v42
--   privs   = INSERT, UPDATE, DELETE, TRUNCATE
--
-- Does NOT:
--   - change rolbypassrls
--   - ALTER DEFAULT PRIVILEGES
--   - revoke RPC EXECUTE (that is Q1A)
--   - revoke SELECT/REFERENCES/TRIGGER
--
-- Operator MUST after COMMIT:
--   SET wave5.cutover_batch_id = '<batch_id from NOTICE>';
-- before running 07A (Q1A).

BEGIN;

-- CONTROL_PLANE_DRIFT_ABORTS_Q0A=YES
-- CREATE/INDEX/REVOKE below are the same transaction as the schema-guard DO.

CREATE TABLE IF NOT EXISTS public.wave5_club_cutover_batch (
  batch_id uuid PRIMARY KEY,
  cutover_kind text NOT NULL DEFAULT 'WAVE5_CLUB_TENANT',
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  q1_committed_at timestamptz,
  quiesce_visible_at timestamptz,
  drained_at timestamptz,
  apply_started_at timestamptz,
  apply_committed_at timestamptz,
  verified_at timestamptz,
  writes_restored_at timestamptz,
  aborted_at timestamptz,
  verify_evidence_fingerprint text,
  CONSTRAINT wave5_club_cutover_batch_kind_chk
    CHECK (cutover_kind = 'WAVE5_CLUB_TENANT'),
  CONSTRAINT wave5_club_cutover_batch_state_chk
    CHECK (state IN (
      'PREPARED',
      'QUIESCED',
      'DRAINED',
      'APPLYING',
      'APPLIED',
      'VERIFIED',
      'RESTORED',
      'ABORTED'
    ))
);

COMMENT ON COLUMN public.wave5_club_cutover_batch.q1_committed_at IS
  'COMPATIBILITY ONLY. Not drain authority. Drain uses quiesce_visible_at from Q1B post-commit seal.';
COMMENT ON COLUMN public.wave5_club_cutover_batch.quiesce_visible_at IS
  'Post-Q1-commit visibility barrier. Written only in 07A2 after Q1A REVOKE has committed.';
COMMENT ON COLUMN public.wave5_club_cutover_batch.apply_committed_at IS
  'In-transaction audit stamp when state becomes APPLIED. Not a cross-session visibility barrier.';
COMMENT ON COLUMN public.wave5_club_cutover_batch.verify_evidence_fingerprint IS
  'Optional compact non-PII verification fingerprint persisted by 03B.';

CREATE UNIQUE INDEX IF NOT EXISTS wave5_club_cutover_batch_one_active
  ON public.wave5_club_cutover_batch (cutover_kind)
  WHERE state NOT IN ('RESTORED', 'ABORTED');

CREATE TABLE IF NOT EXISTS public.wave5_cutover_table_privilege_snapshot (
  batch_id uuid NOT NULL REFERENCES public.wave5_club_cutover_batch (batch_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT now(),
  schema_name name NOT NULL,
  table_name name NOT NULL,
  grantee_name text NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL,
  PRIMARY KEY (batch_id, schema_name, table_name, grantee_name, privilege_type)
);

COMMENT ON TABLE public.wave5_club_cutover_batch IS
  'WAVE5_SQL_DESIGN_ONLY cutover control plane. Not an application table.';
COMMENT ON TABLE public.wave5_cutover_table_privilege_snapshot IS
  'WAVE5_SQL_DESIGN_ONLY capture of exact service_role Club table DML before Q0A REVOKE. Restore via 07C/07D with explicit batch_id only.';

REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM anon, authenticated;
REVOKE ALL ON TABLE public.wave5_cutover_table_privilege_snapshot FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_cutover_table_privilege_snapshot FROM anon, authenticated;
ALTER TABLE public.wave5_club_cutover_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave5_cutover_table_privilege_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_cols text;
  v_pred text;
  v_idx_unique boolean;
  v_idx_key text;
  v_idx_nkey int;
  v_idx_natts int;
  v_idx_expr pg_node_tree;
  v_pk text;
  v_pk_n int;
  v_fk text;
  v_fk_n int;
  v_fk_del char;
  v_fk_upd char;
  v_fk_ftable text;
  v_fk_fcols text;
  v_fk_lcols text;
  v_chk text;
  v_chk_norm text;
  v_pred_norm text;
  v_rls boolean;
  v_relkind char;
  v_tbl text;
  v_priv text;
  v_public_acl int;
BEGIN
  SELECT c.relkind INTO v_relkind
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_club_cutover_batch';
  IF v_relkind IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD wrong same-named batch object relkind=%',
      coalesce(v_relkind::text, '<missing>');
  END IF;

  SELECT string_agg(
           format('%s:%s:%s', a.attname, format_type(a.atttypid, a.atttypmod),
                  CASE WHEN a.attnotnull THEN 'NOTNULL' ELSE 'NULL' END),
           ',' ORDER BY a.attnum
         )
    INTO v_cols
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_club_cutover_batch'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF v_cols IS DISTINCT FROM 'batch_id:uuid:NOTNULL,cutover_kind:text:NOTNULL,state:text:NOTNULL,created_at:timestamp with time zone:NOTNULL,q1_committed_at:timestamp with time zone:NULL,quiesce_visible_at:timestamp with time zone:NULL,drained_at:timestamp with time zone:NULL,apply_started_at:timestamp with time zone:NULL,apply_committed_at:timestamp with time zone:NULL,verified_at:timestamp with time zone:NULL,writes_restored_at:timestamp with time zone:NULL,aborted_at:timestamp with time zone:NULL,verify_evidence_fingerprint:text:NULL' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch columns=%',
      coalesce(v_cols, '<missing>');
  END IF;

  SELECT count(*) INTO v_pk_n
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_club_cutover_batch'
    AND con.contype = 'p';
  SELECT string_agg(a.attname, ',' ORDER BY x.ord)
    INTO v_pk
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
  JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.attnum
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_club_cutover_batch'
    AND con.contype = 'p';
  IF v_pk_n <> 1 OR v_pk IS DISTINCT FROM 'batch_id' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch PK missing CONTROL_PLANE_BATCH_PK_EXACT=NO pk=% count=%',
      coalesce(v_pk, '<missing>'), v_pk_n;
  END IF;

  SELECT pg_get_constraintdef(con.oid) INTO v_chk
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_club_cutover_batch'
    AND con.contype = 'c'
    AND con.conname = 'wave5_club_cutover_batch_kind_chk';
  v_chk_norm := btrim(regexp_replace(coalesce(v_chk, ''), E'\\s+', ' ', 'g'));
  IF v_chk IS NULL
     OR v_chk ~ '<>'
     OR v_chk ~ '!='
     OR v_chk ~* '\mNOT\M'
     OR v_chk ~* '\mOR\M'
     OR v_chk ~* '\mIN\M'
     OR v_chk_norm IS DISTINCT FROM $$CHECK ((cutover_kind = 'WAVE5_CLUB_TENANT'::text))$$ THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_KIND_CHECK_EXACT=NO CONTROL_PLANE_EXISTING_SCHEMA_GUARD cutover_kind CHECK drift %',
      coalesce(v_chk, '<missing>');
  END IF;

  SELECT pg_get_constraintdef(con.oid) INTO v_chk
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_club_cutover_batch'
    AND con.contype = 'c'
    AND con.conname = 'wave5_club_cutover_batch_state_chk';
  v_chk_norm := btrim(regexp_replace(coalesce(v_chk, ''), E'\\s+', ' ', 'g'));
  IF v_chk IS NULL
     OR v_chk ~* 'NOT\s+IN'
     OR v_chk ~ '<>'
     OR v_chk ~* '\mOR\M'
     OR v_chk_norm IS DISTINCT FROM $$CHECK ((state = ANY (ARRAY['PREPARED'::text, 'QUIESCED'::text, 'DRAINED'::text, 'APPLYING'::text, 'APPLIED'::text, 'VERIFIED'::text, 'RESTORED'::text, 'ABORTED'::text])))$$ THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_STATE_CHECK_EXACT=NO CONTROL_PLANE_EXISTING_SCHEMA_GUARD state CHECK drift %',
      coalesce(v_chk, '<missing>');
  END IF;

  SELECT i.indisunique,
         i.indnkeyatts,
         i.indnatts,
         i.indexprs,
         (
           SELECT a.attname
           FROM pg_catalog.pg_attribute a
           WHERE a.attrelid = i.indrelid
             AND a.attnum = i.indkey[1]
             AND i.indkey[1] > 0
         ),
         pg_get_expr(i.indpred, i.indrelid)
    INTO v_idx_unique, v_idx_nkey, v_idx_natts, v_idx_expr, v_idx_key, v_pred
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
  WHERE n.nspname = 'public'
    AND idx.relname = 'wave5_club_cutover_batch_one_active';
  IF v_idx_unique IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD one-active unique index missing';
  END IF;
  IF v_idx_unique IS NOT TRUE
     OR v_idx_nkey IS DISTINCT FROM 1
     OR v_idx_natts IS DISTINCT FROM 1
     OR v_idx_expr IS NOT NULL
     OR v_idx_key IS DISTINCT FROM 'cutover_kind' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_ONE_ACTIVE_INDEX_EXACT=NO unique=% nkey=% natts=% expr=% key=%',
      v_idx_unique, v_idx_nkey, v_idx_natts,
      CASE WHEN v_idx_expr IS NULL THEN 'NULL' ELSE 'PRESENT' END,
      coalesce(v_idx_key, '<missing>');
  END IF;
  v_pred_norm := btrim(regexp_replace(coalesce(v_pred, ''), E'\\s+', ' ', 'g'));
  IF v_pred IS NULL
     OR v_pred ~* '\mOR\M'
     OR v_pred_norm IS DISTINCT FROM $$(state <> ALL (ARRAY['RESTORED'::text, 'ABORTED'::text]))$$ THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_ONE_ACTIVE_INDEX_PREDICATE_EXACT=NO CONTROL_PLANE_EXISTING_SCHEMA_GUARD one-active index predicate drift %',
      coalesce(v_pred, '<missing>');
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_club_cutover_batch';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch RLS not enabled';
  END IF;

  SELECT c.relkind INTO v_relkind
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_cutover_table_privilege_snapshot';
  IF v_relkind IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD wrong same-named table-privilege snapshot object relkind=%',
      coalesce(v_relkind::text, '<missing>');
  END IF;

  SELECT string_agg(
           format('%s:%s:%s', a.attname, format_type(a.atttypid, a.atttypmod),
                  CASE WHEN a.attnotnull THEN 'NOTNULL' ELSE 'NULL' END),
           ',' ORDER BY a.attnum
         )
    INTO v_cols
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_table_privilege_snapshot'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF v_cols IS DISTINCT FROM 'batch_id:uuid:NOTNULL,captured_at:timestamp with time zone:NOTNULL,schema_name:name:NOTNULL,table_name:name:NOTNULL,grantee_name:text:NOTNULL,privilege_type:text:NOTNULL,is_grantable:boolean:NOTNULL' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD table privilege snapshot columns=%',
      coalesce(v_cols, '<missing>');
  END IF;

  SELECT count(*) INTO v_pk_n
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_table_privilege_snapshot'
    AND con.contype = 'p';
  SELECT string_agg(a.attname, ',' ORDER BY x.ord)
    INTO v_pk
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
  JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.attnum
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_table_privilege_snapshot'
    AND con.contype = 'p';
  IF v_pk_n <> 1 OR v_pk IS DISTINCT FROM 'batch_id,schema_name,table_name,grantee_name,privilege_type' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_TABLE_PRIV_SNAPSHOT_PK_EXACT=NO pk=% count=%',
      coalesce(v_pk, '<missing>'), v_pk_n;
  END IF;

  SELECT count(*) INTO v_fk_n
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_table_privilege_snapshot'
    AND con.contype = 'f';
  SELECT con.conname, con.confdeltype, con.confupdtype,
         fn.nspname || '.' || ft.relname,
         (
           SELECT string_agg(a.attname, ',' ORDER BY x.ord)
           FROM unnest(con.conkey) WITH ORDINALITY AS x(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.attnum
         ),
         (
           SELECT string_agg(a.attname, ',' ORDER BY x.ord)
           FROM unnest(con.confkey) WITH ORDINALITY AS x(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = x.attnum
         )
    INTO v_fk, v_fk_del, v_fk_upd, v_fk_ftable, v_fk_lcols, v_fk_fcols
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_class ft ON ft.oid = con.confrelid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = ft.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_table_privilege_snapshot'
    AND con.contype = 'f';
  IF v_fk IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD table privilege snapshot FK missing';
  END IF;
  IF v_fk_n <> 1
     OR v_fk_ftable IS DISTINCT FROM 'public.wave5_club_cutover_batch'
     OR v_fk_lcols IS DISTINCT FROM 'batch_id'
     OR v_fk_fcols IS DISTINCT FROM 'batch_id'
     OR v_fk_del IS DISTINCT FROM 'r'
     OR v_fk_upd IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_TABLE_PRIV_SNAPSHOT_FK_EXACT=NO n=% target=% local=% foreign=% del=% upd=%',
      v_fk_n, coalesce(v_fk_ftable, '<missing>'), coalesce(v_fk_lcols, '<missing>'),
      coalesce(v_fk_fcols, '<missing>'), coalesce(v_fk_del::text, '<missing>'),
      coalesce(v_fk_upd::text, '<missing>');
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_cutover_table_privilege_snapshot';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD table privilege snapshot RLS not enabled';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY[
    'wave5_club_cutover_batch',
    'wave5_cutover_table_privilege_snapshot'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    LOOP
      IF has_table_privilege('anon', format('public.%I', v_tbl), v_priv)
         OR has_table_privilege('authenticated', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD application-role table access not denied';
      END IF;
    END LOOP;
    SELECT count(*) INTO v_public_acl
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
    WHERE n.nspname = 'public'
      AND c.relname = v_tbl
      AND acl.grantee = 0
      AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
    IF v_public_acl > 0 THEN
      RAISE EXCEPTION 'WAVE5_Q0A_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD PUBLIC table access not denied on %',
        v_tbl;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_tbl text;
  v_priv text;
  v_snap_n int := 0;
  v_bypassrls boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: service_role role missing';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_tbl)) IS NULL THEN
      RAISE EXCEPTION 'WAVE5_Q0A_ABORT: required Club table missing public.%', v_tbl;
    END IF;
  END LOOP;

  -- Application roles must already be DENIED on Club table DML.
  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
    LOOP
      IF has_table_privilege('anon', format('public.%I', v_tbl), v_priv)
         OR has_table_privilege('authenticated', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_Q0A_ABORT: PUBLIC/anon/authenticated Club table DML must already be DENIED on %.%',
          v_tbl, v_priv;
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
      WHERE n.nspname = 'public'
        AND c.relname = v_tbl
        AND acl.grantee = 0
        AND acl.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) THEN
      RAISE EXCEPTION 'WAVE5_Q0A_ABORT: PUBLIC Club table DML must already be DENIED on %',
        v_tbl;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.wave5_club_cutover_batch b
    WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
      AND b.state NOT IN ('RESTORED', 'ABORTED')
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated — active Wave5 Club batch already exists';
  END IF;

  SELECT r.rolbypassrls INTO v_bypassrls
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = 'service_role';

  INSERT INTO public.wave5_club_cutover_batch (
    batch_id, cutover_kind, state, created_at
  ) VALUES (
    v_batch, 'WAVE5_CLUB_TENANT', 'PREPARED', now()
  );

  RAISE NOTICE 'WAVE5_Q0A_PREPARED_BATCH=% Q0A_CREATES_PREPARED_BATCH=YES SET wave5.cutover_batch_id BEFORE Q1A SERVICE_ROLE_BYPASSRLS_OBSERVED=%',
    v_batch, v_bypassrls;

  -- Snapshot ONLY service_role INSERT/UPDATE/DELETE/TRUNCATE on the four Club tables.
  -- Refuse unknown tables / privilege types (certified scope only).
  INSERT INTO public.wave5_cutover_table_privilege_snapshot (
    batch_id, schema_name, table_name, grantee_name, privilege_type, is_grantable
  )
  SELECT
    v_batch,
    n.nspname,
    c.relname,
    r.rolname,
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
  JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'clubs',
      'club_members',
      'club_governance_assignments',
      'club_membership_requests_v42'
    )
    AND r.rolname = 'service_role'
    AND acl.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  GET DIAGNOSTICS v_snap_n = ROW_COUNT;

  IF EXISTS (
    SELECT 1
    FROM public.wave5_cutover_table_privilege_snapshot s
    WHERE s.batch_id = v_batch
      AND (
        s.grantee_name IS DISTINCT FROM 'service_role'
        OR s.schema_name IS DISTINCT FROM 'public'
        OR s.table_name NOT IN (
          'clubs',
          'club_members',
          'club_governance_assignments',
          'club_membership_requests_v42'
        )
        OR s.privilege_type NOT IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      )
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: table privilege snapshot contains unknown table/privilege/grantee — refusing REVOKE';
  END IF;

  RAISE NOTICE 'WAVE5_Q0A_SNAPSHOT_ROWS=% (empty allowed when service_role had no capturable Club DML)',
    v_snap_n;

  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM service_role',
      v_tbl
    );
  END LOOP;

  -- Effective deny via has_table_privilege (covers PUBLIC / inheritance / ownership paths).
  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
    LOOP
      IF has_table_privilege('service_role', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_Q0A_ABORT: service_role still has % on public.% after REVOKE — privilege remains via PUBLIC/inheritance/ownership',
          v_priv, v_tbl;
      END IF;
    END LOOP;
  END LOOP;

  -- SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES — observe only; do not mutate.
  IF (
    SELECT r.rolbypassrls
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = 'service_role'
  ) IS DISTINCT FROM v_bypassrls THEN
    RAISE EXCEPTION 'WAVE5_Q0A_ABORT: service_role rolbypassrls changed unexpectedly';
  END IF;

  RAISE NOTICE 'WAVE5_Q0A_REVOKE_READY batch=% SERVICE_ROLE_DIRECT_DML=DENIED SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES next=SET wave5.cutover_batch_id THEN 07A_QUIESCE_WRITES_DESIGN',
    v_batch;
END $$;

COMMIT;
