-- =============================================================================
-- CUSTOMER-07 — Pre-apply object state check (read-only)
-- Note: Do not put table references in CASE ELSE branches — Postgres may
-- still plan/evaluate them when the table is absent. Use two-step probes.
-- =============================================================================

SET search_path = public, pg_temp;

-- Step 1
SELECT to_regclass('public.customers') IS NOT NULL AS customers_present;

-- Step 2 (run only when customers_present = true)
-- SELECT
--   count(*)::int AS customer_row_count,
--   count(*) FILTER (
--     WHERE customer_id NOT LIKE 'CUSTOMER07_TEST_%'
--       AND customer_number NOT LIKE 'CUSTOMER07_TEST_%'
--       AND coalesce(display_name, '') NOT LIKE 'CUSTOMER07_TEST_%'
--   )::int AS non_test_customer_row_count
-- FROM public.customers;
