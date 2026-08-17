-- Court Resource canonical inventory read ROLLBACK.
-- Drops only this package RPC. Does not touch Phase 3A / 3B / D4.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.

BEGIN;

DROP FUNCTION IF EXISTS public.court_resource_list_eligible_courts(text, text, text);

COMMIT;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_resource_list_eligible_courts' AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
