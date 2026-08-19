-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Durable APPLIED → VERIFIED after read-only 03_VERIFY PASS.
-- Rechecks canonical Club tenant FK + quiesced mutation surface.
-- 03_VERIFY itself remains read-only.

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  v_state text;
  v_fk text;
  v_updated int := 0;
  v_sig text;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: explicit cutover_batch_id required';
  END IF;

  SELECT b.state INTO v_state
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
    AND b.cutover_kind = 'WAVE5_CLUB_TENANT'
  FOR UPDATE;

  IF v_state IS DISTINCT FROM 'APPLIED' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: invalid transition % → VERIFIED',
      coalesce(v_state, '<missing>');
  END IF;

  SELECT ccu.table_name INTO v_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;
  IF v_fk IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: clubs.tenant_id FK is %, expected platform_tenants',
      coalesce(v_fk, '<null>');
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.club_create(uuid,text,text,text,text,text)',
    'public.club_add_member(uuid,text,uuid,text,integer)',
    'public.club_review_membership_request(uuid,uuid,text,text,integer)'
  ]
  LOOP
    IF has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: still executable while awaiting 07D: %', v_sig;
    END IF;
  END LOOP;

  UPDATE public.wave5_club_cutover_batch
  SET state = 'VERIFIED',
      verified_at = clock_timestamp()
  WHERE batch_id = v_batch
    AND state = 'APPLIED';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_VERIFY_MARK_ABORT: APPLIED → VERIFIED failed';
  END IF;

  RAISE NOTICE 'WAVE5_VERIFIED batch=%', v_batch;
END $$;

COMMIT;
