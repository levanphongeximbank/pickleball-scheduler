# Pickleball Scheduler Pro

**Version hiện tại:** v3.5.8

**Trạng thái:** Staging Apply & Manual QA (Preview-ready, chưa production)

## v3.5.8 — Staging Apply & Manual QA

- Checklist apply Supabase staging sau v3.5.7: `docs/STAGING-APPLY-QA-v358.md`.
- Bộ user test 6 role, QA theo role, Go/No-Go Vercel Preview.
- Không thêm tính năng; không deploy production.

## v3.5.7 — Security Hardening

- Signup trigger: role luôn `PLAYER` (không đọc metadata).
- Profile update trigger: user không đổi role/venue/club/status; role chỉ SUPER_ADMIN.
- Director match live: JWT session (đồng bộ cloudSync), không anon client.
- Preview/Production: khóa dev login, RBAC toggle, RbacDevPanel, referee direct fallback.
- Tests: `tests/security-hardening.test.js`.

## v3.5.6 — Referee Security Fix

- RPC referee: `referee_get_match_by_token`, `referee_update_match_score`.
- Anon không select/update trực tiếp `tournament_match_live` (staging RLS).
- App referee flow qua RPC; dev fallback khi chưa chạy RLS SQL.
- Tests: `tests/referee-rpc-security.test.js`.

## v3.5.5 — Supabase/RLS Staging

- SQL staging: `supabase-rbac.sql`, `supabase-club-v3-rls.sql`, `supabase-match-live-rls.sql`, `supabase-rls-rollback.sql`.
- Checklist: `docs/SUPABASE-STAGING-CHECKLIST.md`, test plan `docs/RLS-TEST-PLAN.md`.
- Unit tests: `tests/rls-access.test.js` (mock client RBAC ↔ RLS intent).

## v3.5.4 — RBAC Production

- `VITE_RBAC_ENABLED=true` — enforce permission client-side.
- Profile bắt buộc từ `public.profiles` (không fallback PLAYER khi RBAC bật).
- Route/menu/action guard theo role matrix.
- SQL docs: `supabase-rbac.sql`, `supabase-club-v3-rls.sql` (RLS tùy chọn, chưa bật trong app).

## v3.5.3 — Authentication Production

- Supabase Auth: `signInWithPassword`, `signOut`, session restore, profile sync.
- Auth production tự bật khi có Supabase env (bắt đăng nhập).

## Lý do nâng version từ 3.0.0 lên 3.5.0

`package.json` vẫn ghi `3.0.0` trong khi source code đã vượt xa mốc v3.0 — tương đương khoảng v3.4.0 theo đánh giá nội bộ. Phiên bản **v3.5.0** đánh dấu giai đoạn hoàn thiện SaaS: RBAC, authentication, multi-tenant, court management, tournament/league production.

## Các module đã có

- Tournament Engine
- League Engine
- AI Scheduling
- Court Management
- Director Mode
- Ranking
- Statistics
- Export / Import
- Mobile-friendly UI

## Các module cần hoàn thiện để production

- Authentication
- RBAC Production
- Multi-tenant
- SaaS Subscription
- Finance
- Notification
- Audit Log
- Backup / Restore
- Deploy Production

## Roadmap

### v3.5.0
- Stabilize Tournament Engine.
- Stabilize League Engine.
- Complete Court Management.
- Complete Authentication.
- Complete RBAC Production.
- Prepare SaaS architecture.

### v3.6.0
- Finance module.
- Notification module.
- Dashboard and analytics.
- Export reports.

### v3.7.0
- Mobile-first UI.
- Android/iOS preparation.
- PWA support.

### v3.8.0
- AI Director Mode.
- AI Pairing.
- AI Ranking.
- Smart court assignment.

### v4.0.0
- Full SaaS version.
- Multi-tenant production.
- Subscription billing.
- Production deployment.
- Backup and restore.
- Audit log.
