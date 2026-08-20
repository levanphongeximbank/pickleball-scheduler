-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- PHASE_Q1A_REVOKE_COMMIT
-- Q1A: establish/certify control tables, create PREPARED batch, snapshot
-- exact mutation ACL (including service_role if present), REVOKE mutation
-- caller roles, verify revoke inside this transaction, COMMIT.
--
-- Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES
-- This transaction does NOT set quiesce_visible_at and does NOT mark QUIESCED.
-- Post-commit seal is 07A2_QUIESCE_SEAL_DESIGN.sql.
-- q1_committed_at is compatibility-only and is NOT written here.
-- q1_committed_at is NOT drain authority.
--
-- CANONICAL_MUTATION_RPC_COUNT=14
-- LEGACY_COMPAT_MUTATION_RPC_COUNT=1
-- TOTAL_QUIESCE_TARGET_COUNT=15
-- ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=YES
-- UNKNOWN_MUTATION_RPC_OVERLOAD=ABORT
-- MUTATION_RPC_OVERLOAD_INVENTORY_COMPLETE=YES
-- PUBLIC_MUTATION_EXECUTE_AFTER_Q1=0
-- ANON_MUTATION_EXECUTE_AFTER_Q1=0
-- AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=0
-- SERVICE_ROLE_MUTATION_ENTRYPOINT_POLICY=QUIESCE_IF_PRESENT
-- SERVICE_ROLE_INTERNAL_HELPER_EXECUTE=PRESERVE
-- ALL_MUTATION_CALLER_ROLES_QUIESCED=YES
-- ONE_ACTIVE_CUTOVER_BATCH=YES
-- CUTOVER_STATE_MACHINE=YES
-- CUTOVER_METADATA_PUBLIC_ACCESS=DENIED
-- CUTOVER_METADATA_AUTHENTICATED_ACCESS=DENIED
-- CUTOVER_METADATA_ANON_ACCESS=DENIED
-- CONTROL_PLANE_EXISTING_SCHEMA_GUARD=YES
-- CONTROL_PLANE_BATCH_PK_EXACT=YES
-- CONTROL_PLANE_SNAPSHOT_PK_EXACT=YES
-- CONTROL_PLANE_SNAPSHOT_FK_EXACT=YES
-- CONTROL_PLANE_ONE_ACTIVE_INDEX_EXACT=YES
-- CANONICAL_MUTATION_SURFACE_REF=09_CANONICAL_MUTATION_SURFACE.sql
-- MUTATION_RPC_PRE_PRIVILEGES_CAPTURED=YES
--
-- Does NOT revoke:
--   - read RPCs
--   - Wave 5 internal helpers (service_role EXECUTE preserved)
--   - service_role globally
--
-- Legacy club_leave_my_membership():
--   CANONICAL_COMMAND_SURFACE=NO
--   QUIESCE_REQUIRED=YES if present
--   POST_CANONICAL_RESTORE=NO

BEGIN;

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

CREATE TABLE IF NOT EXISTS public.wave5_cutover_rpc_privilege_snapshot (
  batch_id uuid NOT NULL REFERENCES public.wave5_club_cutover_batch (batch_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT now(),
  nspname name NOT NULL,
  proname name NOT NULL,
  identity_args text NOT NULL,
  grantee_name text NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL,
  PRIMARY KEY (batch_id, nspname, proname, identity_args, grantee_name, privilege_type)
);

COMMENT ON TABLE public.wave5_club_cutover_batch IS
  'WAVE5_SQL_DESIGN_ONLY cutover control plane. Not an application table.';
COMMENT ON TABLE public.wave5_cutover_rpc_privilege_snapshot IS
  'WAVE5_SQL_DESIGN_ONLY capture of exact function EXECUTE ACLs before Q1 REVOKE. Restore via 07C with explicit batch_id only.';

REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_club_cutover_batch FROM anon, authenticated;
REVOKE ALL ON TABLE public.wave5_cutover_rpc_privilege_snapshot FROM PUBLIC;
REVOKE ALL ON TABLE public.wave5_cutover_rpc_privilege_snapshot FROM anon, authenticated;
ALTER TABLE public.wave5_club_cutover_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave5_cutover_rpc_privilege_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_cols text;
  v_pred text;
  v_idx_unique boolean;
  v_idx_key text;
  v_idx_tokens text;
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
  v_chk_tokens text;
  v_kind_tokens text;
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
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD wrong same-named batch object relkind=%',
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
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch columns=%',
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
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch PK missing CONTROL_PLANE_BATCH_PK_EXACT=NO pk=% count=%',
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
  SELECT string_agg(m[1], ',' ORDER BY m[1]) INTO v_kind_tokens
  FROM regexp_matches(coalesce(v_chk, ''), '''([A-Z0-9_]+)''', 'g') AS m;
  IF v_chk IS NULL
     OR position('cutover_kind' in v_chk) = 0
     OR v_kind_tokens IS DISTINCT FROM 'WAVE5_CLUB_TENANT' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD cutover_kind CHECK drift %',
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
  SELECT string_agg(m[1], ',' ORDER BY m[1]) INTO v_chk_tokens
  FROM regexp_matches(coalesce(v_chk, ''), '''([A-Z0-9_]+)''', 'g') AS m;
  IF v_chk IS NULL
     OR v_chk_tokens IS DISTINCT FROM 'ABORTED,APPLIED,APPLYING,DRAINED,PREPARED,QUIESCED,RESTORED,VERIFIED' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD state CHECK drift %',
      coalesce(v_chk, '<missing>');
  END IF;

  SELECT i.indisunique,
         (
           SELECT a.attname
           FROM pg_catalog.pg_attribute a
           WHERE a.attrelid = i.indrelid
             AND a.attnum = i.indkey[1]
         ),
         pg_get_expr(i.indpred, i.indrelid)
    INTO v_idx_unique, v_idx_key, v_pred
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
  WHERE n.nspname = 'public'
    AND idx.relname = 'wave5_club_cutover_batch_one_active';
  IF v_idx_unique IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD one-active unique index missing';
  END IF;
  IF v_idx_unique IS NOT TRUE OR v_idx_key IS DISTINCT FROM 'cutover_kind' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_ONE_ACTIVE_INDEX_EXACT=NO unique=% key=%',
      v_idx_unique, coalesce(v_idx_key, '<missing>');
  END IF;
  SELECT string_agg(m[1], ',' ORDER BY m[1]) INTO v_idx_tokens
  FROM regexp_matches(coalesce(v_pred, ''), '''([A-Z0-9_]+)''', 'g') AS m;
  IF v_pred IS NULL
     OR position('state' in v_pred) = 0
     OR (
       position('NOT' in upper(v_pred)) = 0
       AND position('<>' in v_pred) = 0
     )
     OR v_idx_tokens IS DISTINCT FROM 'ABORTED,RESTORED' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD one-active index predicate drift %',
      coalesce(v_pred, '<missing>');
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_club_cutover_batch';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD batch RLS not enabled';
  END IF;

  SELECT c.relkind INTO v_relkind
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_cutover_rpc_privilege_snapshot';
  IF v_relkind IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD wrong same-named snapshot object relkind=%',
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
    AND c.relname = 'wave5_cutover_rpc_privilege_snapshot'
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF v_cols IS DISTINCT FROM 'batch_id:uuid:NOTNULL,captured_at:timestamp with time zone:NOTNULL,nspname:name:NOTNULL,proname:name:NOTNULL,identity_args:text:NOTNULL,grantee_name:text:NOTNULL,privilege_type:text:NOTNULL,is_grantable:boolean:NOTNULL' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD snapshot columns=%',
      coalesce(v_cols, '<missing>');
  END IF;

  SELECT count(*) INTO v_pk_n
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_rpc_privilege_snapshot'
    AND con.contype = 'p';
  SELECT string_agg(a.attname, ',' ORDER BY x.ord)
    INTO v_pk
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
  JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.attnum
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_rpc_privilege_snapshot'
    AND con.contype = 'p';
  IF v_pk_n <> 1 OR v_pk IS DISTINCT FROM 'batch_id,nspname,proname,identity_args,grantee_name,privilege_type' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_SNAPSHOT_PK_EXACT=NO pk=% count=%',
      coalesce(v_pk, '<missing>'), v_pk_n;
  END IF;

  SELECT count(*) INTO v_fk_n
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'wave5_cutover_rpc_privilege_snapshot'
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
    AND c.relname = 'wave5_cutover_rpc_privilege_snapshot'
    AND con.contype = 'f';
  IF v_fk IS NULL THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD snapshot FK missing';
  END IF;
  IF v_fk_n <> 1
     OR v_fk_ftable IS DISTINCT FROM 'public.wave5_club_cutover_batch'
     OR v_fk_lcols IS DISTINCT FROM 'batch_id'
     OR v_fk_fcols IS DISTINCT FROM 'batch_id'
     OR v_fk_del IS DISTINCT FROM 'r'
     OR v_fk_upd IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD CONTROL_PLANE_SNAPSHOT_FK_EXACT=NO n=% target=% local=% foreign=% del=% upd=%',
      v_fk_n, coalesce(v_fk_ftable, '<missing>'), coalesce(v_fk_lcols, '<missing>'),
      coalesce(v_fk_fcols, '<missing>'), coalesce(v_fk_del::text, '<missing>'),
      coalesce(v_fk_upd::text, '<missing>');
  END IF;

  SELECT c.relrowsecurity INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'wave5_cutover_rpc_privilege_snapshot';
  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD snapshot RLS not enabled';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY[
    'wave5_club_cutover_batch',
    'wave5_cutover_rpc_privilege_snapshot'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    LOOP
      IF has_table_privilege('anon', format('public.%I', v_tbl), v_priv)
         OR has_table_privilege('authenticated', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD application-role table access not denied';
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
      RAISE EXCEPTION 'WAVE5_Q1_ABORT: CONTROL_PLANE_EXISTING_SCHEMA_GUARD PUBLIC table access not denied on %',
        v_tbl;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_batch uuid := gen_random_uuid();
  v_oid regprocedure;
  v_canonical_present int := 0;
  v_legacy_present int := 0;
  v_revoked int := 0;
  v_public_exec int := 0;
  v_anon_exec int := 0;
  v_auth_exec int := 0;
  v_service_exec int := 0;
  v_unknown int := 0;
  r record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.wave5_club_cutover_batch b
    WHERE b.cutover_kind = 'WAVE5_CLUB_TENANT'
      AND b.state NOT IN ('RESTORED', 'ABORTED')
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: ONE_ACTIVE_CUTOVER_BATCH violated — active Wave5 Club batch already exists';
  END IF;

  FOR r IN
    SELECT * FROM (
      -- WAVE5_CANONICAL_MUTATION_SURFACE_VALUES_BEGIN
      VALUES
        ('public.club_create(uuid,text,text,text,text,text)'::text, true),
        ('public.club_update(uuid,text,integer,text,text,text,text,text)', true),
        ('public.club_assign_owner(uuid,text,uuid,integer)', true),
        ('public.club_clear_owner(uuid,text,integer)', true),
        ('public.club_transfer_president(uuid,text,uuid,integer)', true),
        ('public.club_assign_vice_president(uuid,text,uuid,integer)', true),
        ('public.club_clear_vice_president(uuid,text,integer,uuid)', true),
        ('public.club_add_member(uuid,text,uuid,text,integer)', true),
        ('public.club_remove_member(uuid,text,uuid,integer)', true),
        ('public.club_restore_member(uuid,text,uuid,integer)', true),
        ('public.club_leave_membership(uuid,text)', true),
        ('public.club_submit_membership_request(uuid,text,text)', true),
        ('public.club_cancel_membership_request(uuid,uuid,integer)', true),
        ('public.club_review_membership_request(uuid,uuid,text,text,integer)', true),
        ('public.club_leave_my_membership()', false)
      -- WAVE5_CANONICAL_MUTATION_SURFACE_VALUES_END
    ) AS t(sig text, is_canonical boolean)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF r.is_canonical THEN
      IF v_oid IS NULL THEN
        RAISE EXCEPTION 'WAVE5_Q1_ABORT: ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=NO missing %',
          r.sig;
      END IF;
      v_canonical_present := v_canonical_present + 1;
    ELSIF v_oid IS NOT NULL THEN
      v_legacy_present := v_legacy_present + 1;
    END IF;
  END LOOP;

  IF v_canonical_present <> 14 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: CANONICAL_MUTATION_RPC_COUNT expected 14, present=% — legacy alias cannot satisfy canonical required count',
      v_canonical_present;
  END IF;

  SELECT count(*) INTO v_unknown
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'club_create',
      'club_update',
      'club_assign_owner',
      'club_clear_owner',
      'club_transfer_president',
      'club_assign_vice_president',
      'club_clear_vice_president',
      'club_add_member',
      'club_remove_member',
      'club_restore_member',
      'club_leave_membership',
      'club_submit_membership_request',
      'club_cancel_membership_request',
      'club_review_membership_request',
      'club_leave_my_membership'
    )
    AND format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
      NOT IN (
        'public.club_create(uuid,text,text,text,text,text)',
        'public.club_update(uuid,text,integer,text,text,text,text,text)',
        'public.club_assign_owner(uuid,text,uuid,integer)',
        'public.club_clear_owner(uuid,text,integer)',
        'public.club_transfer_president(uuid,text,uuid,integer)',
        'public.club_assign_vice_president(uuid,text,uuid,integer)',
        'public.club_clear_vice_president(uuid,text,integer,uuid)',
        'public.club_add_member(uuid,text,uuid,text,integer)',
        'public.club_remove_member(uuid,text,uuid,integer)',
        'public.club_restore_member(uuid,text,uuid,integer)',
        'public.club_leave_membership(uuid,text)',
        'public.club_submit_membership_request(uuid,text,text)',
        'public.club_cancel_membership_request(uuid,uuid,integer)',
        'public.club_review_membership_request(uuid,uuid,text,text,integer)',
        'public.club_leave_my_membership()'
      );

  IF v_unknown > 0 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: UNKNOWN_MUTATION_RPC_OVERLOAD count=% MUTATION_RPC_OVERLOAD_INVENTORY_COMPLETE=NO',
      v_unknown;
  END IF;

  INSERT INTO public.wave5_club_cutover_batch (
    batch_id, cutover_kind, state, created_at
  ) VALUES (
    v_batch, 'WAVE5_CLUB_TENANT', 'PREPARED', now()
  );

  RAISE NOTICE 'WAVE5_Q1A_CAPTURE_BATCH=% CANONICAL_MUTATION_RPC_COUNT=14 LEGACY_COMPAT_MUTATION_RPC_COUNT=% TOTAL_QUIESCE_TARGET_COUNT=15 Q1_REVOKE_COMMIT_PRECEDES_QUIESCED_SEAL=YES',
    v_batch, v_legacy_present;

  INSERT INTO public.wave5_cutover_rpc_privilege_snapshot (
    batch_id, nspname, proname, identity_args, grantee_name, privilege_type, is_grantable
  )
  SELECT
    v_batch,
    n.nspname,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
    acl.privilege_type,
    acl.is_grantable
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid))
      IN (
        'public.club_create(uuid,text,text,text,text,text)',
        'public.club_update(uuid,text,integer,text,text,text,text,text)',
        'public.club_assign_owner(uuid,text,uuid,integer)',
        'public.club_clear_owner(uuid,text,integer)',
        'public.club_transfer_president(uuid,text,uuid,integer)',
        'public.club_assign_vice_president(uuid,text,uuid,integer)',
        'public.club_clear_vice_president(uuid,text,integer,uuid)',
        'public.club_add_member(uuid,text,uuid,text,integer)',
        'public.club_remove_member(uuid,text,uuid,integer)',
        'public.club_restore_member(uuid,text,uuid,integer)',
        'public.club_leave_membership(uuid,text)',
        'public.club_submit_membership_request(uuid,text,text)',
        'public.club_cancel_membership_request(uuid,uuid,integer)',
        'public.club_review_membership_request(uuid,uuid,text,text,integer)',
        'public.club_leave_my_membership()'
      )
    AND acl.privilege_type = 'EXECUTE';

  IF NOT EXISTS (
    SELECT 1
    FROM public.wave5_cutover_rpc_privilege_snapshot s
    WHERE s.batch_id = v_batch
  ) THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: privilege snapshot empty — refusing REVOKE without capture';
  END IF;

  FOR r IN
    SELECT * FROM (
      -- WAVE5_CANONICAL_MUTATION_SURFACE_VALUES_BEGIN
      VALUES
        ('public.club_create(uuid,text,text,text,text,text)'::text, true),
        ('public.club_update(uuid,text,integer,text,text,text,text,text)', true),
        ('public.club_assign_owner(uuid,text,uuid,integer)', true),
        ('public.club_clear_owner(uuid,text,integer)', true),
        ('public.club_transfer_president(uuid,text,uuid,integer)', true),
        ('public.club_assign_vice_president(uuid,text,uuid,integer)', true),
        ('public.club_clear_vice_president(uuid,text,integer,uuid)', true),
        ('public.club_add_member(uuid,text,uuid,text,integer)', true),
        ('public.club_remove_member(uuid,text,uuid,integer)', true),
        ('public.club_restore_member(uuid,text,uuid,integer)', true),
        ('public.club_leave_membership(uuid,text)', true),
        ('public.club_submit_membership_request(uuid,text,text)', true),
        ('public.club_cancel_membership_request(uuid,uuid,integer)', true),
        ('public.club_review_membership_request(uuid,uuid,text,text,integer)', true),
        ('public.club_leave_my_membership()', false)
      -- WAVE5_CANONICAL_MUTATION_SURFACE_VALUES_END
    ) AS t(sig text, is_canonical boolean)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      IF r.is_canonical THEN
        RAISE EXCEPTION 'WAVE5_Q1_ABORT: canonical signature missing before REVOKE %', r.sig;
      END IF;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_oid);
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM service_role', v_oid);
    END IF;
    v_revoked := v_revoked + 1;
  END LOOP;

  IF v_revoked < 14 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: expected to REVOKE 14 canonical mutation signatures, revoked=%',
      v_revoked;
  END IF;

  FOR r IN
    SELECT * FROM (
      -- WAVE5_QUIESCE_15_ARRAY_BEGIN
      VALUES
        ('public.club_create(uuid,text,text,text,text,text)'::text),
        ('public.club_update(uuid,text,integer,text,text,text,text,text)'),
        ('public.club_assign_owner(uuid,text,uuid,integer)'),
        ('public.club_clear_owner(uuid,text,integer)'),
        ('public.club_transfer_president(uuid,text,uuid,integer)'),
        ('public.club_assign_vice_president(uuid,text,uuid,integer)'),
        ('public.club_clear_vice_president(uuid,text,integer,uuid)'),
        ('public.club_add_member(uuid,text,uuid,text,integer)'),
        ('public.club_remove_member(uuid,text,uuid,integer)'),
        ('public.club_restore_member(uuid,text,uuid,integer)'),
        ('public.club_leave_membership(uuid,text)'),
        ('public.club_submit_membership_request(uuid,text,text)'),
        ('public.club_cancel_membership_request(uuid,uuid,integer)'),
        ('public.club_review_membership_request(uuid,uuid,text,text,integer)'),
        ('public.club_leave_my_membership()')
      -- WAVE5_QUIESCE_15_ARRAY_END
    ) AS t(sig text)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE p.oid = v_oid
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee = 0
    ) THEN
      v_public_exec := v_public_exec + 1;
    END IF;
    IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      v_anon_exec := v_anon_exec + 1;
    END IF;
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      v_auth_exec := v_auth_exec + 1;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      v_service_exec := v_service_exec + 1;
    END IF;
  END LOOP;

  IF v_public_exec <> 0 OR v_anon_exec <> 0 OR v_auth_exec <> 0 OR v_service_exec <> 0 THEN
    RAISE EXCEPTION 'WAVE5_Q1_ABORT: ALL_MUTATION_CALLER_ROLES_QUIESCED=NO PUBLIC=% ANON=% AUTHENTICATED=% SERVICE_ROLE=%',
      v_public_exec, v_anon_exec, v_auth_exec, v_service_exec;
  END IF;

  -- SERVICE_ROLE_INTERNAL_HELPER_EXECUTE=PRESERVE: Q1 never REVOKEs
  -- wave5_ensure_athlete_for_club_member / wave5_resolve_club_facility_venue_id.

  RAISE NOTICE 'WAVE5_Q1A_REVOKE_READY revoked_present_signatures=% batch=% PUBLIC_MUTATION_EXECUTE_AFTER_Q1=0 ANON_MUTATION_EXECUTE_AFTER_Q1=0 AUTHENTICATED_MUTATION_EXECUTE_AFTER_Q1=0 SERVICE_ROLE_MUTATION_ENTRYPOINT_POLICY=QUIESCE_IF_PRESENT next=07A2_QUIESCE_SEAL_DESIGN',
    v_revoked, v_batch;
END $$;

COMMIT;
