-- =============================================================================
-- CRM Phase 1H-B — Pre-apply object-state check (READ-ONLY)
-- Staging project ref expected: qyewbxjsiiyufanzcjcq
-- Purpose: Verify CRM Phase 1G durable objects are absent or empty, and report
--          permission / role-matrix seed state BEFORE forward apply.
--
-- SAFE: SELECT / catalog probes only. No INSERT/UPDATE/DELETE/DDL.
-- Do NOT run against Production.
-- Do NOT enable durable runtime.
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- A. Table presence + row estimates (catalog-safe; no FROM on maybe-missing tables)
-- Absence = no public pg_class row. Emptiness estimate = pg_stat_user_tables.n_live_tup.
-- ---------------------------------------------------------------------------
SELECT
  t.object_name,
  (c.oid IS NOT NULL) AS exists,
  s.n_live_tup AS row_count_estimate
FROM (
  VALUES
    ('crm_tags'),
    ('crm_tag_assignments'),
    ('crm_consent_records'),
    ('crm_pending_events')
) AS t(object_name)
LEFT JOIN (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
) c ON c.relname = t.object_name
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
ORDER BY t.object_name;

-- ---------------------------------------------------------------------------
-- B. Related indexes
-- ---------------------------------------------------------------------------
SELECT
  'index_state' AS check_group,
  i.indexname,
  true AS exists
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.indexname IN (
    'crm_tags_tenant_venue_normalized_code_idx',
    'crm_tags_tenant_venue_active_idx',
    'crm_tags_tenant_venue_normalized_name_tag_id_idx',
    'crm_tag_assignments_tenant_venue_target_idx',
    'crm_tag_assignments_tenant_venue_tag_id_idx',
    'crm_consent_tenant_venue_contact_channel_purpose_idx',
    'crm_consent_effective_at_desc_idx',
    'crm_consent_created_at_desc_idx',
    'crm_consent_consent_id_idx',
    'crm_pending_events_claim_queue_idx',
    'crm_pending_events_claim_expires_at_idx'
  )
ORDER BY i.indexname;

-- ---------------------------------------------------------------------------
-- C. RLS enabled / forced
-- ---------------------------------------------------------------------------
SELECT
  'rls_state' AS check_group,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'crm_tags',
    'crm_tag_assignments',
    'crm_consent_records',
    'crm_pending_events'
  )
ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- D. Related RLS policies
-- ---------------------------------------------------------------------------
SELECT
  'policy_state' AS check_group,
  pol.polname AS policy_name,
  cls.relname AS table_name
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname IN (
    'crm_tags',
    'crm_tag_assignments',
    'crm_consent_records',
    'crm_pending_events'
  )
ORDER BY cls.relname, pol.polname;

-- ---------------------------------------------------------------------------
-- E. Claim / release RPCs + scope / consent guard functions
-- ---------------------------------------------------------------------------
SELECT
  'function_state' AS check_group,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'crm_phase1g_scope_allows',
    'crm_claim_pending_events',
    'crm_release_expired_pending_event_claims',
    'crm_consent_records_immutable_guard'
  )
ORDER BY p.proname, 2;

-- ---------------------------------------------------------------------------
-- F. Consent immutability trigger
-- ---------------------------------------------------------------------------
SELECT
  'trigger_state' AS check_group,
  tg.tgname AS trigger_name,
  cls.relname AS table_name
FROM pg_trigger tg
JOIN pg_class cls ON cls.oid = tg.tgrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND NOT tg.tgisinternal
  AND tg.tgname = 'crm_consent_records_immutable_trg';

-- ---------------------------------------------------------------------------
-- G. CRM permission seed rows + duplicate detection
-- ---------------------------------------------------------------------------
SELECT
  'permission_seed_state' AS check_group,
  p.id,
  p.module,
  p.action,
  COUNT(*) OVER (PARTITION BY p.id) AS id_occurrence_count
FROM public.permissions p
WHERE p.module = 'crm'
   OR p.id LIKE 'crm.%'
ORDER BY p.id;

SELECT
  'permission_duplicate_ids' AS check_group,
  p.id,
  COUNT(*) AS row_count
FROM public.permissions p
WHERE p.module = 'crm' OR p.id LIKE 'crm.%'
GROUP BY p.id
HAVING COUNT(*) > 1
ORDER BY p.id;

SELECT
  'permission_seed_expected_present' AS check_group,
  e.id AS expected_id,
  EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.id = e.id
  ) AS present
FROM (
  VALUES
    ('crm.lead.view'),
    ('crm.lead.create'),
    ('crm.lead.update'),
    ('crm.lead.assign'),
    ('crm.opportunity.view'),
    ('crm.opportunity.create'),
    ('crm.opportunity.update'),
    ('crm.pipeline.manage'),
    ('crm.interaction.view'),
    ('crm.interaction.create'),
    ('crm.task.view'),
    ('crm.task.create'),
    ('crm.task.update'),
    ('crm.task.assign'),
    ('crm.tag.create'),
    ('crm.tag.view'),
    ('crm.tag.update'),
    ('crm.tag.assign'),
    ('crm.consent.create'),
    ('crm.consent.view'),
    ('crm.consent.revoke'),
    ('crm.campaign.view'),
    ('crm.campaign.manage'),
    ('crm.audit.view')
) AS e(id)
ORDER BY e.id;

-- ---------------------------------------------------------------------------
-- H. Unexpected CRM role-matrix rows (deferred SQL must NOT have been applied)
-- ---------------------------------------------------------------------------
SELECT
  'role_matrix_crm_rows' AS check_group,
  rp.role_id,
  rp.permission_id
FROM public.role_permissions rp
WHERE rp.permission_id LIKE 'crm.%'
   OR rp.permission_id IN (
     SELECT p.id FROM public.permissions p WHERE p.module = 'crm'
   )
ORDER BY rp.role_id, rp.permission_id;

SELECT
  'role_matrix_crm_row_count' AS check_group,
  COUNT(*)::bigint AS crm_role_permission_rows
FROM public.role_permissions rp
WHERE rp.permission_id LIKE 'crm.%'
   OR rp.permission_id IN (
     SELECT p.id FROM public.permissions p WHERE p.module = 'crm'
   );

-- ---------------------------------------------------------------------------
-- I. Pass/fail summary hints (interpret in evidence doc)
-- Expected FIRST-APPLY READY when:
--   - four CRM tables absent OR exist with row_count_estimate = 0
--   - listed indexes absent
--   - listed CRM policies / RPCs / consent trigger absent
--   - permission duplicates = 0
--   - crm role_permissions count = 0 (matrix deferred)
-- ---------------------------------------------------------------------------
SELECT
  'summary_hint' AS check_group,
  'Interpret results in docs/crm/phase-1h-b/15_PRE_APPLY_OBJECT_STATE_EVIDENCE.md' AS note,
  'qyewbxjsiiyufanzcjcq' AS expected_staging_project_ref,
  'expuvcohlcjzvrrauvud' AS production_project_ref_blocklisted;
