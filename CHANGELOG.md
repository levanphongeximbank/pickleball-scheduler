# Changelog

All notable changes to Pickleball Scheduler Pro are documented in this file.

## [3.5.8] - Staging Apply & Manual QA

### Added
- `docs/STAGING-APPLY-QA-v358.md` — SQL staging order, 6 user test, QA theo role, security checks v3.5.7, Preview env, Go/No-Go.

### Changed
- `docs/SUPABASE-STAGING-CHECKLIST.md` — RLS verify SQL, link v3.5.8 QA doc.

### Unchanged
- Không thêm tính năng app. Không deploy production. Tournament/scheduler không đổi.

## [3.5.7] - Security Hardening (Preview)

### Added
- `docs/supabase-security-hardening-v357.sql` — patch staging: PLAYER-only signup, profile update guards.
- `src/auth/runtime.js` — `isSecureRuntime()` khóa dev fallback trên Preview/Production.
- `tests/security-hardening.test.js` — role escalation, profile patch, JWT director client.

### Changed
- `docs/supabase-rbac.sql` — trigger `handle_new_user` luôn `PLAYER`; trigger chặn đổi role/venue/club/status.
- `src/auth/authService.js` — không gửi role metadata khi signup; khóa dev login / RBAC toggle.
- `src/auth/profileService.js` — `mapUserToSelfProfilePatch`; bắt profile khi secure runtime.
- `src/domain/matchLiveSync.js` — Director dùng JWT (`getSupabaseAuthClient`); referee giữ anon+RPC.
- `src/pages/Settings.jsx` — ẩn `RbacDevPanel` trên production build.

### Security
- User không tự gán role khi đăng ký; chỉ SUPER_ADMIN đổi role (SQL trigger).
- User chỉ sửa `display_name`, `player_id` trên profile của mình.
- Preview/Production: không bypass RBAC, không dev login, không referee direct-table fallback.

### Unchanged
- Không deploy production. Tournament/scheduler không đổi.

## [3.5.6] - Referee Security Fix

### Added
- RPC `referee_update_match_score(token, payload)` — adjust/finalize token-scoped.
- `tests/referee-rpc-security.test.js` — token scope, anon block, staff select, dev fallback.

### Changed
- `docs/supabase-match-live-rls.sql` — gỡ anon SELECT/UPDATE; RPC trả JSON không lộ `club_id`.
- `src/domain/matchLiveSync.js` — referee đọc/ghi qua RPC; poll 4s; fallback direct khi dev chưa có RPC.
- `docs/RLS-TEST-PLAN.md`, `SUPABASE-STAGING-CHECKLIST.md`, `DEPLOY.md` — cập nhật v3.5.6.

### Security
- Anon không còn `select *` trực tiếp trên `tournament_match_live` (staging RLS).
- Director/staff vẫn authenticated SELECT/UPDATE + Realtime.

### Unchanged
- Không deploy production, không Stripe.
- Tournament/scheduler/ranking không đổi.
- Dev local (`supabase-match-live.sql` anon-open) vẫn hoạt động qua fallback.

## [3.5.5] - Supabase/RLS Staging

### Added
- `docs/SUPABASE-STAGING-CHECKLIST.md` — thứ tự SQL, admin, gán role, rollback.
- `docs/RLS-TEST-PLAN.md` — test manual staging + tiêu chí pass.
- `docs/supabase-match-live-rls.sql` — RLS match live + RPC `referee_get_match_by_token`.
- `docs/supabase-rls-rollback.sql` — rollback khẩn anon-open.
- `tests/rls-access.test.js` — mock: thiếu profile, sai venue/club, suspended, player scope.

### Changed
- `supabase-rbac.sql` — helpers `user_club_id`, `user_role`, `is_venue_staff`; policies profiles/subscriptions/payments.
- `supabase-club-v3-rls.sql` — gỡ anon, dùng `user_club_id()`; CASHIER/PLAYER read-only write.
- `DEPLOY.md` — staging vs dev, deploy preview.

### Unchanged
- Không deploy production, không Stripe.
- Tournament/scheduler/ranking engine không đổi.
- Dev fallback khi `VITE_RBAC_ENABLED=false`.

## [3.5.4] - RBAC Production

### Added
- `resolveAuthUserFromProfile()` — RBAC bật thì bắt buộc profile hợp lệ; từ chối suspended/thiếu role.
- Unit tests: permission matrix, route/menu theo role, profile-required khi RBAC bật.
- `docs/RBAC-MATRIX.md` — profile mapping, enforcement points, hướng dẫn SQL.

### Changed
- `syncSupabaseUser` — không fallback PLAYER/metadata khi `VITE_RBAC_ENABLED=true`.
- `authErrors.js` — thông báo `PROFILE_INVALID`, `PROFILE_SUSPENDED`, `PROFILE_REQUIRED`.
- SQL docs: header hướng dẫn chạy `supabase-rbac.sql` + `supabase-club-v3-rls.sql`.

### Unchanged
- RLS không bật trong app code — chỉ docs SQL.
- Thuật toán tournament/scheduler/ranking không đổi.
- Referee vẫn dùng token link `/referee/:token` (ngoài RBAC role).

## [3.5.3] - Authentication Production

### Added
- Auth production: tự bật khi có `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (tách khỏi RBAC).
- `src/auth/authGuard.js` — route guard đăng nhập (redirect `/login`, quay lại trang yêu cầu).
- `src/auth/authErrors.js` — thông báo lỗi đăng nhập tiếng Việt.
- `AuthContext`: `authLoading`, session restore an toàn khi refresh.
- Profile mapping: `PROFILE_FIELD_MAP`, `mapUserToProfileRow()`.
- Unit tests: `tests/auth.test.js`.

### Changed
- `LoginPage` — mobile-friendly, loading/error rõ ràng, dev login chỉ khi thiếu Supabase env.
- `RouteAccessGate` — auth production bắt login; RBAC permission vẫn tắt mặc định.
- `Header` / Settings — nút đăng xuất khi auth production hoặc RBAC bật.
- Dev registry (`signInDev`, `listDevUsers`) vô hiệu khi Supabase env có mặt.

### Unchanged
- `VITE_RBAC_ENABLED=false` — chưa bật RBAC production.
- Supabase RLS — chưa chạy.

## [3.5.2] - UI/Quality Fix

### Added
- Sidebar: mục **Xếp sân** (`/select-players`, icon Shuffle, permission `scheduling.view`).

### Fixed
- UI tests: bọc `AuthProvider` trong `tests/ui/testUtils.jsx` (ClubSwitcher, RbacDevPanel).

### Verified
- Re-export: `src/pages/Statistics.jsx`, `src/pages/tournament/TournamentDirectorMode.jsx` — production import giữ nguyên; `src/features/*/index.js` song song.
- Lint `react-hooks/exhaustive-deps`: giữ nguyên dependency `localRevision`/`revision` (cache-bust có chủ đích).

### Unchanged
- Router vẫn import từ `src/pages/` (chưa chuyển sang `features/`).
- RBAC production, Supabase RLS — chưa bật.

## [3.5.1] - Architecture Freeze

### Added
- `src/features/tournament/director/` — Director Mode split (UI / hooks / services).
- `src/features/statistics/` — Statistics split (panels / hooks / export service).
- `ARCHITECTURE.md`, `REFACTOR-v3.5.1.md`.
- CI: lint + unit tests before production build.

### Changed
- Router giữ import từ `src/pages/` (production không đổi).
- `src/features/` là module song song, chưa gắn route.

### Restored (non-destructive policy)
- `pages/Tournament.jsx`, `engine/`, `scheduler/`, `CourtManagementFuturePanel.jsx` — khôi phục sau bước refactor trước.
- `legacy/` chỉ là bản nháp tham chiếu.

## [3.5.0] - Current Development Version

### Added
- Standardized project version to v3.5.0.
- Defined official roadmap from v3.5.0 to v4.0.0.
- Confirmed Tournament Engine, League Engine, AI Scheduling, Court Management, Ranking and Statistics as core v3.x modules.

### Changed
- Reclassified project from local tournament scheduler to pre-production sports management platform.
- Updated documentation to prepare for SaaS architecture.

### Pending
- Authentication and login/logout.
- RBAC production permission matrix.
- Multi-tenant owner/club/player model.
- SaaS billing and subscription.
- Finance and notification modules.
- Production deployment.
