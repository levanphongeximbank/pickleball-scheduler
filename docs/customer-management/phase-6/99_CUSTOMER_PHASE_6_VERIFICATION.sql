-- =============================================================================
-- CUSTOMER-06 — Verification queries (static / post-apply checklist)
-- Run after Owner-gated apply. No Production secrets.
-- =============================================================================

SET search_path = public, pg_temp;

SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'customer_duplicate_candidates',
    'customer_merge_proposals',
    'customer_merge_history'
  )
  AND c.relkind = 'r'
ORDER BY 1;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'customer_duplicate_candidates',
    'customer_merge_proposals',
    'customer_merge_history'
  )
ORDER BY 1;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN (
    'merged_into_customer_id',
    'merged_at',
    'merge_history_id',
    'merge_proposal_id'
  )
ORDER BY 1;

SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'customer_save_duplicate_candidate',
    'customer_save_merge_proposal',
    'customer_execute_merge'
  )
ORDER BY 1;
