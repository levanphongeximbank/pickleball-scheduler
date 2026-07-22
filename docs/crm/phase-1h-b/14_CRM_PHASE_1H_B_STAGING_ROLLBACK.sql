-- =============================================================================
-- CRM Phase 1H-B — Staging rollback SQL (ROLLBACK-ONLY recovery method)
-- Target: Supabase Staging project ref qyewbxjsiiyufanzcjcq ONLY
-- Covers reverse of approved forward migrations orders 7 → 1
-- Deferred / NOT covered: 20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql
--
-- Status: AUTHORED for Owner-controlled manual use. Do NOT auto-run.
-- Do NOT run against Production (expuvcohlcjzvrrauvud).
-- Do NOT enable durable runtime, workers, or provider delivery.
--
-- FAIL-CLOSED SESSION GUARD (required before any destructive statement):
--   In the Staging SQL session, run EXACTLY:
--     SELECT set_config(
--       'app.crm_phase_1h_b_allow_rollback',
--       'staging-qyewbxjsiiyufanzcjcq',
--       false
--     );
--   Then execute this file. Missing/mismatched setting aborts.
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
BEGIN
  IF current_setting('app.crm_phase_1h_b_allow_rollback', true)
       IS DISTINCT FROM 'staging-qyewbxjsiiyufanzcjcq' THEN
    RAISE EXCEPTION
      'CRM_PHASE_1H_B_ROLLBACK_REFUSED: session guard missing. Set app.crm_phase_1h_b_allow_rollback=staging-qyewbxjsiiyufanzcjcq on Staging only.'
      USING ERRCODE = '42501';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP R7 (undo order 7) — CRM permission catalog seed rows only
-- Exact ids from docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql
-- Refuse if any are still referenced by role_permissions (matrix must stay deferred /
-- unexpected grants must be cleared by Owner separately — this file does not
-- DELETE from role_permissions).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_blocked integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO v_blocked
  FROM public.permissions p
  INNER JOIN public.role_permissions rp ON rp.permission_id = p.id
  WHERE p.id IN (
    'crm.lead.view',
    'crm.lead.create',
    'crm.lead.update',
    'crm.lead.assign',
    'crm.opportunity.view',
    'crm.opportunity.create',
    'crm.opportunity.update',
    'crm.pipeline.manage',
    'crm.interaction.view',
    'crm.interaction.create',
    'crm.task.view',
    'crm.task.create',
    'crm.task.update',
    'crm.task.assign',
    'crm.tag.create',
    'crm.tag.view',
    'crm.tag.update',
    'crm.tag.assign',
    'crm.consent.create',
    'crm.consent.view',
    'crm.consent.revoke',
    'crm.campaign.view',
    'crm.campaign.manage',
    'crm.audit.view'
  );

  IF v_blocked > 0 THEN
    RAISE EXCEPTION
      'CRM_PHASE_1H_B_ROLLBACK_REFUSED: % CRM permission seed id(s) still referenced by role_permissions. Clear unexpected CRM role grants manually before seed rollback.',
      v_blocked
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.permissions p
  WHERE p.id IN (
    'crm.lead.view',
    'crm.lead.create',
    'crm.lead.update',
    'crm.lead.assign',
    'crm.opportunity.view',
    'crm.opportunity.create',
    'crm.opportunity.update',
    'crm.pipeline.manage',
    'crm.interaction.view',
    'crm.interaction.create',
    'crm.task.view',
    'crm.task.create',
    'crm.task.update',
    'crm.task.assign',
    'crm.tag.create',
    'crm.tag.view',
    'crm.tag.update',
    'crm.tag.assign',
    'crm.consent.create',
    'crm.consent.view',
    'crm.consent.revoke',
    'crm.campaign.view',
    'crm.campaign.manage',
    'crm.audit.view'
  );
END $$;

-- -----------------------------------------------------------------------------
-- STEP R6 (undo order 6) — consent immutability trigger + guard function
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS crm_consent_records_immutable_trg ON public.crm_consent_records;
DROP FUNCTION IF EXISTS public.crm_consent_records_immutable_guard();

-- -----------------------------------------------------------------------------
-- STEP R5 (undo order 5) — revoke authenticated grants introduced for CRM objects
-- Does NOT GRANT PUBLIC/anon. Does NOT touch unrelated tables.
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.crm_tags FROM authenticated;
REVOKE ALL ON TABLE public.crm_tag_assignments FROM authenticated;
REVOKE ALL ON TABLE public.crm_consent_records FROM authenticated;
REVOKE ALL ON TABLE public.crm_pending_events FROM authenticated;

REVOKE ALL ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  FROM authenticated;

-- Keep PUBLIC/anon revoked (fail-closed hardening retained)
REVOKE ALL ON TABLE public.crm_tags FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_tags FROM anon;
REVOKE ALL ON TABLE public.crm_tag_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_tag_assignments FROM anon;
REVOKE ALL ON TABLE public.crm_consent_records FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_consent_records FROM anon;
REVOKE ALL ON TABLE public.crm_pending_events FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_pending_events FROM anon;

REVOKE ALL ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer)
  FROM anon;
REVOKE ALL ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz)
  FROM anon;

-- -----------------------------------------------------------------------------
-- STEP R4 (undo order 4) — claim / release RPCs
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer);
DROP FUNCTION IF EXISTS public.crm_release_expired_pending_event_claims(text, text, timestamptz);

-- -----------------------------------------------------------------------------
-- STEP R3 (undo order 3) — CRM Phase 1G policies + scope helper
-- Keep RLS ENABLED on tables until DROP TABLE (never weaken by DISABLE RLS).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_tags_select ON public.crm_tags;
DROP POLICY IF EXISTS crm_tags_insert ON public.crm_tags;
DROP POLICY IF EXISTS crm_tags_update ON public.crm_tags;

DROP POLICY IF EXISTS crm_tag_assignments_select ON public.crm_tag_assignments;
DROP POLICY IF EXISTS crm_tag_assignments_insert ON public.crm_tag_assignments;
DROP POLICY IF EXISTS crm_tag_assignments_delete ON public.crm_tag_assignments;

DROP POLICY IF EXISTS crm_consent_records_select ON public.crm_consent_records;
DROP POLICY IF EXISTS crm_consent_records_insert ON public.crm_consent_records;

DROP POLICY IF EXISTS crm_pending_events_select ON public.crm_pending_events;
DROP POLICY IF EXISTS crm_pending_events_insert ON public.crm_pending_events;
DROP POLICY IF EXISTS crm_pending_events_update ON public.crm_pending_events;

REVOKE ALL ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM anon;
DROP FUNCTION IF EXISTS public.crm_phase1g_scope_allows(text, text);

-- -----------------------------------------------------------------------------
-- STEP R2 (undo order 2) — Phase 1G indexes
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.crm_tags_tenant_venue_normalized_code_idx;
DROP INDEX IF EXISTS public.crm_tags_tenant_venue_active_idx;
DROP INDEX IF EXISTS public.crm_tags_tenant_venue_normalized_name_tag_id_idx;

DROP INDEX IF EXISTS public.crm_tag_assignments_tenant_venue_target_idx;
DROP INDEX IF EXISTS public.crm_tag_assignments_tenant_venue_tag_id_idx;

DROP INDEX IF EXISTS public.crm_consent_tenant_venue_contact_channel_purpose_idx;
DROP INDEX IF EXISTS public.crm_consent_effective_at_desc_idx;
DROP INDEX IF EXISTS public.crm_consent_created_at_desc_idx;
DROP INDEX IF EXISTS public.crm_consent_consent_id_idx;

DROP INDEX IF EXISTS public.crm_pending_events_claim_queue_idx;
DROP INDEX IF EXISTS public.crm_pending_events_claim_expires_at_idx;

-- -----------------------------------------------------------------------------
-- STEP R1 (undo order 1) — Phase 1G tables
-- Fail closed if any table has rows (data loss refusal).
-- Drop order respects FK: assignments before tags.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tags integer := 0;
  v_assign integer := 0;
  v_consent integer := 0;
  v_pending integer := 0;
BEGIN
  IF to_regclass('public.crm_tags') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.crm_tags' INTO v_tags;
  END IF;
  IF to_regclass('public.crm_tag_assignments') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.crm_tag_assignments' INTO v_assign;
  END IF;
  IF to_regclass('public.crm_consent_records') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.crm_consent_records' INTO v_consent;
  END IF;
  IF to_regclass('public.crm_pending_events') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.crm_pending_events' INTO v_pending;
  END IF;

  IF (v_tags + v_assign + v_consent + v_pending) > 0 THEN
    RAISE EXCEPTION
      'CRM_PHASE_1H_B_ROLLBACK_REFUSED: CRM Phase 1G tables are not empty (tags=%, assignments=%, consent=%, pending=%). Empty tables required for DROP, or Owner must approve destructive data loss separately.',
      v_tags, v_assign, v_consent, v_pending
      USING ERRCODE = '42501';
  END IF;
END $$;

DROP TABLE IF EXISTS public.crm_tag_assignments;
DROP TABLE IF EXISTS public.crm_pending_events;
DROP TABLE IF EXISTS public.crm_consent_records;
DROP TABLE IF EXISTS public.crm_tags;

-- =============================================================================
-- END rollback. Role matrix SQL was never in scope — not touched.
-- Unrelated Identity / Finance / Notification / Production objects — not touched.
-- =============================================================================
