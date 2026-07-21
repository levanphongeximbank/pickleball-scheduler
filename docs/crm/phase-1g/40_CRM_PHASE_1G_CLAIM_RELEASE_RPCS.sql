-- =============================================================================
-- CRM Phase 1G — Claim and release-expired-claims RPCs
-- Purpose: Atomic pending-event claim (SKIP LOCKED) and expired-claim release.
-- Status: AUTHORED ONLY — do not apply in Phase 1G.
-- Security: SECURITY DEFINER hardened with explicit search_path, scope checks,
--           permission checks, parameter bounds. No PUBLIC execute.
-- Does NOT deliver events, call providers, or auto-acknowledge.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- crm_claim_pending_events
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_claim_pending_events(
  p_tenant_id text,
  p_venue_id text,
  p_worker_id text,
  p_claim_limit integer,
  p_now_at timestamptz,
  p_claim_ttl_seconds integer
)
RETURNS SETOF public.crm_pending_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_ttl integer;
  v_expires_at timestamptz;
BEGIN
  -- Fail closed: scope / worker / now required
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
    RAISE EXCEPTION 'crm_claim_pending_events: tenant_id required'
      USING ERRCODE = '22023';
  END IF;
  IF p_venue_id IS NULL OR length(trim(p_venue_id)) = 0 THEN
    RAISE EXCEPTION 'crm_claim_pending_events: venue_id required'
      USING ERRCODE = '22023';
  END IF;
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'crm_claim_pending_events: worker_id required'
      USING ERRCODE = '22023';
  END IF;
  IF p_now_at IS NULL THEN
    RAISE EXCEPTION 'crm_claim_pending_events: now_at required'
      USING ERRCODE = '22023';
  END IF;

  -- Scope gate (verified helpers only)
  IF NOT public.crm_phase1g_scope_allows(trim(p_tenant_id), trim(p_venue_id)) THEN
    RAISE EXCEPTION 'crm_claim_pending_events: scope denied'
      USING ERRCODE = '42501';
  END IF;

  -- Permission: audit / internal dispatch
  IF NOT (
    public.is_super_admin()
    OR public.user_has_permission('crm.audit.view')
  ) THEN
    RAISE EXCEPTION 'crm_claim_pending_events: permission denied'
      USING ERRCODE = '42501';
  END IF;

  -- Bound claim_limit: 1..100
  IF p_claim_limit IS NULL OR p_claim_limit < 1 OR p_claim_limit > 100 THEN
    RAISE EXCEPTION 'crm_claim_pending_events: claim_limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  v_limit := p_claim_limit;

  -- Bound TTL: 1..3600 seconds
  IF p_claim_ttl_seconds IS NULL OR p_claim_ttl_seconds < 1 OR p_claim_ttl_seconds > 3600 THEN
    RAISE EXCEPTION 'crm_claim_pending_events: claim_ttl_seconds must be between 1 and 3600'
      USING ERRCODE = '22023';
  END IF;
  v_ttl := p_claim_ttl_seconds;
  v_expires_at := p_now_at + make_interval(secs => v_ttl);

  RETURN QUERY
  WITH candidates AS (
    SELECT pe.pending_event_id
    FROM public.crm_pending_events pe
    WHERE pe.tenant_id = trim(p_tenant_id)
      AND pe.venue_id = trim(p_venue_id)
      AND pe.status = 'PENDING'
      AND pe.available_at <= p_now_at
    ORDER BY pe.available_at ASC, pe.created_at ASC, pe.pending_event_id ASC
    FOR UPDATE OF pe SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.crm_pending_events pe
    SET
      status = 'CLAIMED',
      claimed_by = trim(p_worker_id),
      claimed_at = p_now_at,
      claim_expires_at = v_expires_at,
      attempt_count = pe.attempt_count + 1,
      updated_at = p_now_at,
      acknowledged_at = NULL,
      failed_at = NULL,
      failure_reason = NULL
    FROM candidates c
    WHERE pe.pending_event_id = c.pending_event_id
    RETURNING pe.*
  )
  SELECT * FROM updated
  ORDER BY available_at ASC, created_at ASC, pending_event_id ASC;
END;
$$;

COMMENT ON FUNCTION public.crm_claim_pending_events(text, text, text, integer, timestamptz, integer) IS
  'CRM Phase 1G atomic claim of PENDING events with SKIP LOCKED. Does not deliver or acknowledge.';

-- -----------------------------------------------------------------------------
-- crm_release_expired_pending_event_claims
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_release_expired_pending_event_claims(
  p_tenant_id text,
  p_venue_id text,
  p_now_at timestamptz
)
RETURNS TABLE (
  pending_event_id text,
  event_id text,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
    RAISE EXCEPTION 'crm_release_expired_pending_event_claims: tenant_id required'
      USING ERRCODE = '22023';
  END IF;
  IF p_venue_id IS NULL OR length(trim(p_venue_id)) = 0 THEN
    RAISE EXCEPTION 'crm_release_expired_pending_event_claims: venue_id required'
      USING ERRCODE = '22023';
  END IF;
  IF p_now_at IS NULL THEN
    RAISE EXCEPTION 'crm_release_expired_pending_event_claims: now_at required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.crm_phase1g_scope_allows(trim(p_tenant_id), trim(p_venue_id)) THEN
    RAISE EXCEPTION 'crm_release_expired_pending_event_claims: scope denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.user_has_permission('crm.audit.view')
  ) THEN
    RAISE EXCEPTION 'crm_release_expired_pending_event_claims: permission denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT pe.pending_event_id
    FROM public.crm_pending_events pe
    WHERE pe.tenant_id = trim(p_tenant_id)
      AND pe.venue_id = trim(p_venue_id)
      AND pe.status = 'CLAIMED'
      AND pe.claim_expires_at IS NOT NULL
      AND pe.claim_expires_at <= p_now_at
    ORDER BY pe.claim_expires_at ASC, pe.created_at ASC, pe.pending_event_id ASC
    FOR UPDATE OF pe SKIP LOCKED
  ),
  updated AS (
    UPDATE public.crm_pending_events pe
    SET
      status = 'PENDING',
      claimed_by = NULL,
      claimed_at = NULL,
      claim_expires_at = NULL,
      updated_at = p_now_at
      -- attempt_count preserved intentionally
    FROM candidates c
    WHERE pe.pending_event_id = c.pending_event_id
    RETURNING pe.pending_event_id, pe.event_id, pe.attempt_count
  )
  SELECT u.pending_event_id, u.event_id, u.attempt_count
  FROM updated u
  ORDER BY u.pending_event_id ASC;
END;
$$;

COMMENT ON FUNCTION public.crm_release_expired_pending_event_claims(text, text, timestamptz) IS
  'CRM Phase 1G release of expired CLAIMED pending events back to PENDING. Preserves attempt_count. Does not acknowledge or fail.';
