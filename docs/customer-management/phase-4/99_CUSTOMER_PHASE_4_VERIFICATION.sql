-- =============================================================================
-- CUSTOMER-04 — Verification SQL (post-apply checklist)
-- Status: AUTHORED ONLY. Run after Owner-gated apply. No secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- Tables exist
SELECT to_regclass('public.customer_consents') AS customer_consents;
SELECT to_regclass('public.customer_consent_history') AS customer_consent_history;
SELECT to_regclass('public.customer_communication_preferences') AS customer_communication_preferences;
SELECT to_regclass('public.customer_preference_history') AS customer_preference_history;

-- RLS enabled
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'customer_consents',
    'customer_consent_history',
    'customer_communication_preferences',
    'customer_preference_history'
  )
ORDER BY c.relname;

-- No anon table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'customer_consents',
    'customer_consent_history',
    'customer_communication_preferences',
    'customer_preference_history'
  )
  AND grantee = 'anon';

-- RPCs exist
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('customer_save_consent', 'customer_save_preference')
ORDER BY p.proname;

-- Immutable triggers exist
SELECT tg.tgname
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND tg.tgname IN (
    'customer_consent_history_immutable_trg',
    'customer_preference_history_immutable_trg'
  )
ORDER BY tg.tgname;
