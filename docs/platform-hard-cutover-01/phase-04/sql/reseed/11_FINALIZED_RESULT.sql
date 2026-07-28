-- PLATFORM-HARD-CUTOVER-01 reseed step 11 — Finalized result
-- NOT EXECUTED.
-- SINGLE WRITER ONLY: public.competition_ssot_finalize_match_result(...)
-- FORBIDDEN: direct INSERT into competition_ssot_finalized_results from SPA or ad-hoc SQL.

DO $$
DECLARE
  v_tenant text := current_setting('app.reseed_tenant_id', true);
  v_match uuid;
  v_idem text;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'RESEED_11_FINALIZE: app.reseed_tenant_id required';
  END IF;

  SELECT m.id INTO v_match
  FROM public.competition_ssot_matches m
  JOIN public.competition_ssot_competitions c ON c.id = m.competition_id
  WHERE c.tenant_id = v_tenant
    AND m.match_key = 'hard-cutover-seed::match::m1'
  LIMIT 1;

  IF v_match IS NULL THEN
    RAISE EXCEPTION 'RESEED_11_FINALIZE: seed match missing — run 10_MATCH.sql first';
  END IF;

  v_idem := 'hard-cutover-seed::' || v_tenant || '::finalize::m1';

  -- Operator executes under authenticated session:
  -- SELECT public.competition_ssot_finalize_match_result(
  --   p_tenant_id := v_tenant,
  --   p_match_id := v_match,
  --   p_result_payload := '{"winner_side":"A","sets":[]}'::jsonb,
  --   p_idempotency_key := v_idem,
  --   ...
  -- );
  RAISE NOTICE 'RESEED_11_FINALIZE: call competition_ssot_finalize_match_result match=% idem=%', v_match, v_idem;
END $$;

-- VERIFY: exactly one finalized row per match; no direct table invent.
-- SELECT match_id, idempotency_key, source FROM public.competition_ssot_finalized_results;
