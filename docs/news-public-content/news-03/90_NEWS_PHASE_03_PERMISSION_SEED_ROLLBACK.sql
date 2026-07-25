-- =============================================================================
-- NEWS-03 — Permission seed rollback (exact six keys only)
-- Purpose: Remove NEWS-03-owned news.* catalog rows from public.permissions.
-- Status: AUTHORED for Owner-controlled use. Do NOT auto-run.
--
-- Exact ids only — does NOT use LIKE 'news.%' (avoids deleting future keys).
-- Refuse if any of the six ids remain referenced by public.role_permissions.
-- Idempotent when rows already absent.
--
-- Target: Staging qyewbxjsiiyufanzcjcq ONLY. Production expuvcohlcjzvrrauvud PROHIBITED.
-- Does NOT drop News tables (see NEWS-02 90_NEWS_PHASE_02_ROLLBACK.sql).
-- =============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  v_blocked integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO v_blocked
  FROM public.permissions p
  INNER JOIN public.role_permissions rp ON rp.permission_id = p.id
  WHERE p.id IN (
    'news.view',
    'news.edit',
    'news.review',
    'news.approve',
    'news.publish',
    'news.admin'
  );

  IF v_blocked > 0 THEN
    RAISE EXCEPTION
      'NEWS_03_PERMISSION_SEED_ROLLBACK_REFUSED: % news.* permission id(s) still referenced by role_permissions. Clear temporary fixture / unexpected grants before seed rollback.',
      v_blocked
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.permissions p
  WHERE p.id IN (
    'news.view',
    'news.edit',
    'news.review',
    'news.approve',
    'news.publish',
    'news.admin'
  );
END $$;
