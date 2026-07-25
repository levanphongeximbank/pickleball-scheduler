-- =============================================================================
-- NEWS-03 — Identity permission seed (catalog only)
-- Purpose: Idempotent insert of exact news.* permission keys into public.permissions.
-- Status: AUTHORED — apply only via NEWS-03 Staging harness after Owner GO.
--
-- Source of truth: src/features/news-public-content/authorization/capabilityMatrix.js
--   NEWS_PERMISSION: news.view | news.edit | news.review | news.approve | news.publish | news.admin
--
-- Canonical table: public.permissions (id text PK, module, action, description, created_at)
-- Convention: CRM Phase 1H / Identity sprint (WHERE NOT EXISTS).
--
-- INTENTIONALLY ABSENT:
--   - role_permissions permanent mapping
--   - wildcard / broad permissions
--   - authenticated grants of news.*
--   - credentials / News table data dependencies
--
-- Safe to run after NEWS-02 files 10→60. Does not require News table rows.
-- Target: Staging qyewbxjsiiyufanzcjcq ONLY. Production expuvcohlcjzvrrauvud PROHIBITED.
-- =============================================================================

SET search_path = public, pg_temp;

-- news.view
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.view', 'news', 'view', 'Xem nội dung biên tập News & Public Content'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.view');

-- news.edit
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.edit', 'news', 'edit', 'Tạo/sửa bản nháp và gửi duyệt News & Public Content'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.edit');

-- news.review
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.review', 'news', 'review', 'Review nội dung News & Public Content'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.review');

-- news.approve
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.approve', 'news', 'approve', 'Phê duyệt nội dung News & Public Content'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.approve');

-- news.publish
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.publish', 'news', 'publish', 'Lên lịch / xuất bản / gỡ xuất bản News & Public Content'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.publish');

-- news.admin
INSERT INTO public.permissions (id, module, action, description)
SELECT 'news.admin', 'news', 'admin', 'Quản trị biên tập News & Public Content (capability admin)'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = 'news.admin');

-- NOTE: No INSERT into public.role_permissions.
-- Temporary Staging fixture grants (post Owner GO live tests) must cleanup after use.
-- Platform is_super_admin() path in NEWS-02 RLS remains unchanged.
