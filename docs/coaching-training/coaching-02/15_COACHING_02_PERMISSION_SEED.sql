-- =============================================================================
-- COACHING-02 — Identity permission catalog seed (handoff; no role grants)
-- Purpose: Idempotent insert of the 14 COACHING-01 action ids into
--          public.permissions. Role assignment is INTENTIONALLY ABSENT
--          (COACHING-03 prerequisite — Owner policy required).
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
-- Does NOT modify Identity module source. Catalog only.
-- Source strings: src/features/coaching/constants/permissions.js
-- Convention: CRM Phase 1H WHERE NOT EXISTS seed.
-- =============================================================================

SET search_path = public, pg_temp;

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.program.create', 'coaching', 'program.create', 'Create coaching program'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.program.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.program.update', 'coaching', 'program.update', 'Update coaching program'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.program.update');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.coach.assign', 'coaching', 'coach.assign', 'Assign coach reference / relationship'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.coach.assign');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.player.enroll', 'coaching', 'player.enroll', 'Enroll player in coaching program'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.player.enroll');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.curriculum.create', 'coaching', 'curriculum.create', 'Create coaching curriculum'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.curriculum.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.lesson.create', 'coaching', 'lesson.create', 'Create coaching lesson'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.lesson.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.session.schedule', 'coaching', 'session.schedule', 'Schedule coaching training session'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.session.schedule');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.attendance.record', 'coaching', 'attendance.record', 'Record coaching attendance'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.attendance.record');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.attendance.correct', 'coaching', 'attendance.correct', 'Correct coaching attendance atomically'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.attendance.correct');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.package.create', 'coaching', 'package.create', 'Create coaching package definition'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.package.create');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.entitlement.grant', 'coaching', 'entitlement.grant', 'Grant coaching package entitlement'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.entitlement.grant');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.entitlement.consume', 'coaching', 'entitlement.consume', 'Consume coaching package entitlement'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.entitlement.consume');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.evaluation.submit', 'coaching', 'evaluation.submit', 'Submit coaching evaluation / revision'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.evaluation.submit');

INSERT INTO public.permissions (id, module, action, description)
SELECT 'coaching.records.read', 'coaching', 'records.read', 'Read protected coaching records'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'coaching.records.read');

-- Explicitly DO NOT seed Phase 28 coarse keys as canonical:
--   coaching.view / coaching.manage / coaching.attendance / coaching.evaluate
-- Those remain Phase 28 draft artifacts and must not be carried forward.
