-- =============================================================================
-- CRM Phase 1H — Identity permission seed (catalog only)
-- Purpose: Idempotent insert of CRM permission keys into public.permissions.
-- Status: AUTHORED ONLY — do not apply in Phase 1H-A.
-- Owner approval required before Staging apply.
--
-- Convention: mirrors docs/v5/PHASE_42I_MEMBERSHIP_REVIEW.sql (WHERE NOT EXISTS).
-- Role grants are INTENTIONALLY ABSENT — see 20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql.
-- No Production IDs. No real user IDs. No secrets.
-- Source strings: src/features/crm/constants/permissions.js (CRM_PERMISSION_VALUES).
-- =============================================================================

SET search_path = public, pg_temp;

-- crm.lead.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.lead.view', 'crm', 'lead.view', 'Xem lead CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.lead.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.lead.create', 'crm', 'lead.create', 'Tạo lead CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.lead.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.lead.update', 'crm', 'lead.update', 'Cập nhật lead CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.lead.update');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.lead.assign', 'crm', 'lead.assign', 'Gán lead CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.lead.assign');

-- crm.opportunity.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.opportunity.view', 'crm', 'opportunity.view', 'Xem opportunity CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.opportunity.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.opportunity.create', 'crm', 'opportunity.create', 'Tạo opportunity CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.opportunity.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.opportunity.update', 'crm', 'opportunity.update', 'Cập nhật opportunity CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.opportunity.update');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.pipeline.manage', 'crm', 'pipeline.manage', 'Quản lý pipeline CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.pipeline.manage');

-- crm.interaction.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.interaction.view', 'crm', 'interaction.view', 'Xem tương tác CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.interaction.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.interaction.create', 'crm', 'interaction.create', 'Tạo tương tác CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.interaction.create');

-- crm.task.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.task.view', 'crm', 'task.view', 'Xem task CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.task.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.task.create', 'crm', 'task.create', 'Tạo task CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.task.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.task.update', 'crm', 'task.update', 'Cập nhật task CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.task.update');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.task.assign', 'crm', 'task.assign', 'Gán task CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.task.assign');

-- crm.tag.* (Phase 1G RLS)
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.tag.create', 'crm', 'tag.create', 'Tạo thẻ CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.tag.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.tag.view', 'crm', 'tag.view', 'Xem thẻ CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.tag.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.tag.update', 'crm', 'tag.update', 'Cập nhật thẻ CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.tag.update');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.tag.assign', 'crm', 'tag.assign', 'Gán thẻ CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.tag.assign');

-- crm.consent.* (Phase 1G RLS)
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.consent.create', 'crm', 'consent.create', 'Tạo bản ghi đồng ý CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.consent.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.consent.view', 'crm', 'consent.view', 'Xem đồng ý CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.consent.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.consent.revoke', 'crm', 'consent.revoke', 'Thu hồi đồng ý CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.consent.revoke');

-- crm.campaign.*
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.campaign.view', 'crm', 'campaign.view', 'Xem chiến dịch CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.campaign.view');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.campaign.manage', 'crm', 'campaign.manage', 'Quản lý chiến dịch CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.campaign.manage');

-- crm.audit.view — pending-event claim/dispatch + audit (Phase 1F/1G)
INSERT INTO public.permissions (id, module, action, description)
SELECT 'crm.audit.view', 'crm', 'audit.view', 'Xem audit / pending-event CRM'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'crm.audit.view');

-- NOTE: No crm.opportunity.assign — not present in CRM_PERMISSIONS.
-- Pending-event access reuses crm.audit.view (no new invented permission).
