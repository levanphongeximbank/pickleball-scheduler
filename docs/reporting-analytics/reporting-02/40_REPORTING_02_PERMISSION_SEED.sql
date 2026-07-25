-- =============================================================================
-- REPORTING-02 — Identity permission seed (catalog only)
-- Purpose: Idempotent insert of Reporting permission keys into public.permissions.
-- Status: AUTHORED ONLY — do not apply without separate Owner authorization.
--
-- Convention: mirrors docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql
--             (WHERE NOT EXISTS). Role grants are INTENTIONALLY ABSENT.
-- Role mapping handoff: 04_IDENTITY_PERMISSION_HANDOFF.md
-- Source of truth: src/features/reporting-analytics/constants/permissions.js
--                  (REPORTING_PERMISSION_VALUES — 10 ids).
--
-- Does NOT:
--   - INSERT into role_permissions
--   - grant cross-tenant / sensitive / export broadly
--   - modify Identity module code
--   - delete or overwrite unrelated permissions
-- No Production IDs. No secrets. No Staging auto-apply.
-- =============================================================================

SET search_path = public, pg_temp;

-- reporting.dashboard.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.dashboard.view', 'reporting', 'dashboard.view',
       'Xem operational dashboard Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.dashboard.view'
);

-- reporting.report.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.report.execute', 'reporting', 'report.execute',
       'Thực thi báo cáo vận hành Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.report.execute'
);

INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.report.save', 'reporting', 'report.save',
       'Lưu cấu hình báo cáo Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.report.save'
);

INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.report.export', 'reporting', 'report.export',
       'Xuất báo cáo Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.report.export'
);

-- reporting.field.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.field.sensitive.view', 'reporting', 'field.sensitive.view',
       'Xem trường nhạy cảm trên báo cáo Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.field.sensitive.view'
);

-- reporting.filter.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.filter.save', 'reporting', 'filter.save',
       'Lưu bộ lọc báo cáo Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.filter.save'
);

-- reporting.scope.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.scope.tenant', 'reporting', 'scope.tenant',
       'Phạm vi tenant cho Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.scope.tenant'
);

INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.scope.club', 'reporting', 'scope.club',
       'Phạm vi club cho Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.scope.club'
);

INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.scope.venue', 'reporting', 'scope.venue',
       'Phạm vi venue cho Reporting'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.scope.venue'
);

INSERT INTO public.permissions (id, module, action, description)
SELECT 'reporting.scope.cross_tenant', 'reporting', 'scope.cross_tenant',
       'Phạm vi cross-tenant Reporting (fail-closed; không gán role rộng)'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = 'reporting.scope.cross_tenant'
);
