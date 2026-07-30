-- Read-only verify for owner assess_self RBAC remediation.
-- TARGET ONLY: qyewbxjsiiyufanzcjcq

SELECT id
FROM public.permissions
WHERE id IN ('rating_v5.assess_self', 'rating_v5.view_own')
ORDER BY id;

SELECT rp.role_id, rp.permission_id
FROM public.role_permissions rp
WHERE rp.permission_id IN ('rating_v5.assess_self', 'rating_v5.view_own')
  AND rp.role_id IN ('COURT_OWNER', 'VENUE_OWNER', 'PLAYER', 'SUPER_ADMIN', 'SYSTEM_TECHNICIAN')
ORDER BY rp.role_id, rp.permission_id;

-- Expect true for both owner roles
SELECT
  EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = 'COURT_OWNER' AND permission_id = 'rating_v5.assess_self'
  ) AS court_owner_assess_self,
  EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = 'VENUE_OWNER' AND permission_id = 'rating_v5.assess_self'
  ) AS venue_owner_assess_self,
  EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id IN ('COURT_OWNER', 'VENUE_OWNER')
      AND permission_id = 'rating_v5.calibration_manage'
  ) AS owners_got_calibration_manage;
