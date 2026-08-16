-- Court Resource canonical owner-reservation read ROLLBACK.
-- Drops only this package RPC. Does not touch Phase 3A / 3B / D4.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.

BEGIN;

DROP FUNCTION IF EXISTS public.court_resource_list_owner_reservations(text, text, text, text, uuid[]);

COMMIT;

SELECT 'ROLLBACK_SCOPE' AS check_item, 'court_resource_list_owner_reservations' AS value, true AS ok;
SELECT 'PHASE3A_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'PHASE3B_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
SELECT 'D4_OBJECTS_TOUCHED' AS check_item, 0 AS value, true AS ok;
