# Changelog

All notable changes to Pickleball Scheduler Pro are documented in this file.

## [4.0.0] - 2026-07-01 — General Availability (Sprint 12)

**Release Date:** 2026-07-01  
**Mục tiêu:** Phát hành chính thức Version 4.0 sau Sprint 11 RC. Không thêm tính năng mới.

### Completed Sprints (1–12)

| Sprint | Nội dung |
|--------|----------|
| 1 | Identity Phase A — roles/permissions/audit |
| 2 | Multi-tenant |
| 3 | Club Management |
| 4 | Subscription lifecycle |
| 5 | Tournament Engine 4.0 |
| 6 | Court Engine |
| 7 | AI Assistant (opt-in) |
| 8 | Dashboard Analytics |
| 9 | Mobile / PWA / QR Check-in |
| 10 | API / Marketplace (preview) |
| 11 | Release Candidate hardening |
| 12 | GA — production env, SQL/QA checklists, release docs |

### Fixed (post-GA production QA)

- **Court Engine P0 — auto-assign trùng sân bận** — Ghép sân lần 2 vẫn gán vào sân đang có assignment/trận active (`assigned` / `playing` / `paused` / `overrun`). Fix trong `src/features/court-engine/`: `courtStateService.js` (mới), `autoCourtAssignmentEngine.js`, `courtTimerService.js`. `courtStates` đồng bộ khi confirm/start/pause/resume/end match; `activeAssignments` fallback khi localStorage lệch. Test: `occupied court skipped on second auto-assign`. Production QA đóng 2026-07-01.
- **Court Engine** — `/court-engine` white screen khi reload trực tiếp hoặc session/context null; hiển thị thông báo hướng dẫn khi thiếu season/league (`courtEngineContextGuard`, `CourtEnginePage`). Production QA xác nhận RESOLVED 2026-07-01.

### Added (Sprint 12 — release only)

- `docs/GA-PRODUCTION-ENV-CHECKLIST.md` — Phase 1 Vercel/Supabase/GitHub/domain/RBAC/flags
- `docs/SUPABASE-PRODUCTION-CHECKLIST.md` — Phase 2 SQL production (15 bước + verify schema)
- `docs/GA-PRODUCTION-QA.md` — Phase 3 QA 8 roles + toàn module
- `docs/GA-FINAL-AUDIT.md` — Phase 6 build/lint/test/config/security audit
- `RELEASE_NOTES_v4.0.md`, `DEPLOYMENT_GUIDE.md`, `ROADMAP.md`

### Breaking Changes (v3.x → v4.0 GA)

1. **RBAC bắt buộc production** — `VITE_RBAC_ENABLED=true`; deny-by-default; không fallback PLAYER từ metadata.
2. **Profile bắt buộc** — Row `public.profiles` hợp lệ required khi RBAC bật.
3. **Signup role PLAYER** — Chỉ SUPER_ADMIN đổi role (SQL lần đầu hoặc User Management).
4. **Director Mode** — Yêu cầu Supabase Realtime + JWT; không dev anon trên Preview/Production.
5. **Role alias** — `VENUE_*` ↔ `COURT_*` normalized trong RBAC matrix.
6. **Storage v3** — Club blob unified schema; migration tự động từ v2 keys.

### Migration Notes

**Vercel Production:**

```
VITE_SUPABASE_URL=<production>
VITE_SUPABASE_ANON_KEY=<production>
VITE_RBAC_ENABLED=true
VITE_SEED_DEMO=false
VITE_PAYMENT_MODE=dev
VITE_ENABLE_AI_ENGINE=false
VITE_API_ENABLED=false
VITE_MARKETPLACE_ENABLED=false
```

**Supabase Production:** Chạy 15 file SQL theo thứ tự trong `docs/SUPABASE-PRODUCTION-CHECKLIST.md` (bạn thực hiện thủ công). Sau SQL: Realtime `tournament_match_live`, promote SUPER_ADMIN, tạo venue.

**Local dev:** Giữ `VITE_RBAC_ENABLED=false` — không đổi workflow cũ.

### Known Limitations

- Payment live (VNPay/MoMo/Stripe) chưa production — dùng `VITE_PAYMENT_MODE=dev`
- API/Marketplace preview-only — flags mặc định OFF
- AI Assistant opt-in — `VITE_ENABLE_AI_ENGINE=true` + SQL sprint7
- Push notification cần Edge Function
- Module Xếp sân không ghi điểm mùa/Elo (theo thiết kế)
- ESLint: 0 errors, 111 hooks warnings (không chặn GA)

### Tag

Sau QA production pass: `git tag -a v4.0.0 -m "Pickleball Scheduler Pro v4.0.0 GA"` (không auto-push)

---

## [4.0.0-sprint11] - Release Candidate Hardening

**Mục tiêu:** Đủ điều kiện nâng `4.0.0-beta` → `4.0.0-rc.1`. Không thêm tính năng mới.

### Fixed
- ESLint: 65 errors → 0 (unused vars, hooks, process in tests, no-useless-assignment)
- CI lint step unblocked

### Changed
- `VITE_RBAC_ENABLED`: production build mặc định `true` khi env không set (`src/auth/config.js`)
- `.env.production.example`, CI deploy default RBAC `true`
- `tests/subscription-sprint4.test.js` trong `npm run test:unit`
- Menu ẩn Marketplace/Integrations khi `VITE_*_ENABLED=false`
- SQL idempotent: `ai-assistant-sprint7`, `mobile-sprint9` (drop policy if exists)

### Added
- `docs/ARCHITECTURE.md` — kiến trúc v4 tổng thể
- `docs/RELEASE-4.0-RC.md` — Go/No-Go RC
- `docs/RBAC-RC-QA.md` — manual QA theo role
- `docs/SUPABASE-STAGING-CHECKLIST.md` — bổ sung Sprint 2–10 (15 SQL steps)

### Known limitations (RC)
- Payment live (VNPay/MoMo/Stripe) chưa production
- API/Marketplace preview-only
- AI Assistant opt-in
- Push notification cần Edge Function

## [4.0.0-beta] - Sprints 1–10

Tổng hợp các sprint đã triển khai trước Sprint 11 (xem các mục sprint6–sprint9 bên dưới và sprint1–5 trong lịch sử).

## [4.0.0-sprint9] - Mobile / PWA / QR Check-in

**Mục tiêu:** App dùng tốt trên điện thoại, cài PWA, offline cơ bản, QR check-in, push notification nền tảng. Không phá web desktop.

### Added
- `src/features/mobile/` — layout, offline, QR, check-in, notification services
- PWA: `vite-plugin-pwa`, manifest, service worker, `public/pwa-icon.svg`
- Routes `/mobile/check-in`, `/mobile/qr-scan`, `/mobile/qr-generate`, `/mobile/player`, `/mobile/notifications`
- Mobile shell: bottom nav, drawer menu, responsive padding, offline banner
- `docs/supabase-mobile-sprint9.sql` — `push_subscriptions`, `notifications`, `qr_tokens`, `checkins`
- `tests/mobile-sprint9.test.js` — 15 tests

### Changed
- `MainLayout` — mobile bottom nav + drawer; sidebar ẩn trên mobile
- `Header` — nút hamburger mobile
- `RefereeHub` — nút lớn, link quét QR trên mobile

### Unchanged
- Desktop sidebar + layout `md+`
- `/referee/:token` legacy scoreboard

## [4.0.0-sprint6] - Court Engine v4.0

**Mục tiêu:** Hệ thống điều hành sân hoàn chỉnh — check-in, queue, auto assignment, trọng tài, timer, chuyển sân. Không phá Director Mode.

### Added
- `src/features/court-engine/` — models, storage, services, `generateCourtAssignments`, guards
- Route `/court-engine` — UI Court Engine (Check-in, Queue, Live Courts, Referee, Activity Log)
- `transferMatchToCourt` trong `courtEngine.js` — giữ timer khi chuyển sân tournament
- `tests/court-engine.test.js` — 17 tests
- `src/features/court-engine/ARCHITECTURE.md`

### Changed
- Sidebar — menu Court Engine (Điều hành)
- `menuAccess.js` — route `/court-engine` → `DIRECTOR_USE` / `SCHEDULING_RUN`

### Unchanged
- `/tournament/director/:id` — Director Mode production giữ nguyên
- `/referee/:token` — route trọng tài legacy

## [4.0.0-sprint5] - Tournament Engine 4.0

**Mục tiêu:** Lõi xử lý giải đấu thông minh (rule-based/heuristic) — Seed, Draw, Schedule, Court Assignment, Time Prediction, Ranking. Không phá luồng tournament cũ.

### Added
- `src/features/tournament-engine/` — 6 engines, validation, facade, adapter, engine run log (localStorage)
- UI `/tournaments/:id/engine|seed|draw|schedule|courts|ranking|logs` — tab Engine 4.0 cho chủ sân
- `tests/tournament-engine.test.js` — 16 tests cho toàn bộ engines
- `src/features/tournament-engine/ARCHITECTURE.md`

### Changed
- `TournamentHome` / router — link Engine 4.0 (route mới, không đổi route cũ)
- `tournament.settings.engineV4` — lưu state engine song song dữ liệu giải hiện có

### Unchanged
- `/tournament/internal/*`, `/tournament/official/*`, Director Mode, legacy setup wizard
- Không dùng API AI bên ngoài. Chưa migration Supabase bắt buộc (Sprint 6).

## [4.0.0-sprint4] - Subscription

**Mục tiêu:** Gói Trial / Starter / Professional / Enterprise — tự động gia hạn, khóa khi hết hạn, nhắc thanh toán.

### Added
- `src/features/subscription/` — lifecycle service, policy constants, ARCHITECTURE
- 4 gói: `trial` (14 ngày), `starter`, `professional`, `enterprise`
- `runSubscriptionMaintenance()` — auto renew + past_due + expired lock trên bootstrap
- `SubscriptionBanner` — nhắc 7/3/1 ngày trước hết hạn
- `SubscriptionGate` — khóa tenant khi subscription expired (SUPER_ADMIN bypass)
- `tests/subscription-sprint4.test.js`, `docs/SUBSCRIPTION-SPRINT4-CHECKLIST.md`
- `docs/supabase-subscription-sprint4.sql`

### Changed
- Alias legacy: `basic` → `starter`, `pro` → `professional`
- `upgradeSubscription` / webhook dùng `renewSubscriptionPeriod`
- Stripe env: `VITE_STRIPE_LINK_STARTER`, `_PROFESSIONAL`, `_ENTERPRISE`

### Unchanged
- `VITE_RBAC_ENABLED=false` → subscription guards tắt như cũ. Chưa deploy production.

## [4.0.0-sprint3] - Club Management

**Mục tiêu:** Tầng quản lý CLB trong từng tenant — thành viên, ELO theo CLB, lịch sử trận, giải nội bộ.

### Added
- `src/features/club/` — models, storage extension, services (member, rating, match, tournament, elo, access)
- Routes `/clubs`, `/clubs/:clubId` — danh sách + chi tiết 5 tab (Tổng quan, Thành viên, ELO, Lịch sử, Giải nội bộ)
- `ClubMember`, `ClubPlayerRating`, `ClubRatingHistory`, `ClubMatch` — localStorage per club
- Ghi trận giao hữu + cập nhật ELO CLB tự động (`createFriendlyClubMatch`, `applyClubMatchElo`)
- Bridge giải `club_internal` → lịch sử CLB + ELO scoped (`clubTournamentBridge`)
- Seed idempotent CLB A/B/C cho Future Arena (`ensureClubManagementSeed`)
- `getClubsVisibleToUser` — PLAYER/CLUB_OWNER chỉ thấy CLB mình tham gia
- `tests/club-management.test.js`

### Changed
- Model `Club` — thêm `code`, `description`, `status`, `createdByUserId`
- `tournamentLifecycle` — giải `club_internal` dùng ELO CLB, không ghi ELO blob toàn hệ thống
- `InternalTournamentSetup` — resolve đúng `clubId`, pool VĐV từ thành viên CLB
- Sidebar nhóm CLB — Danh sách CLB, Tạo CLB mới (`/clubs?create=1`)

### Unchanged
- `/club` (Mùa giải / CLB & Giải), players, courts, tournaments hiện có

## [4.0.0] - Identity Phase C — Server RLS + Audit UI

**Mục tiêu:** RPC server-side user management + audit read; venue admin khóa user qua SQL trigger.

### Added
- SQL: `docs/supabase-identity-v40-phaseC.sql` (+ rollback) — `user_has_permission`, RPC `identity_*`
- `src/features/identity/services/identityRpcService.js`
- Route `/audit` — `AuditLogPage.jsx`
- Tests: `tests/identity-phaseC.test.js`

### Changed
- `userManagementService.js` — ưu tiên RPC khi Supabase có Phase C
- `auditService.js` — `listAuditLogs` qua RPC + guard `USER_MANAGE`
- `profiles` trigger — venue admin (`user.manage`) cập nhật status user cùng venue
- `sidebarMenu.js`, `menuAccess.js`, `router.jsx` — menu Nhật ký
- Staging checklist SQL bước 10

### Unchanged
- RBAC mặc định tắt; legacy `/referee/:token` giữ nguyên
- RPC fallback nếu Phase C SQL chưa chạy

## [4.0.0-sprint2] - Multi Tenant System

**Mục tiêu:** Cô lập dữ liệu theo tenant (sân/đơn vị thuê phần mềm). `tenantId` alias `venueId` — không phá Sprint 1 Identity.

### Added
- `src/features/tenant/` — model, guards, service, seed 3 tenant demo + `default-tenant` migration
- `TenantContext`, `TenantSwitcher`, `TenantGate`, `/admin/tenants` (SUPER_ADMIN)
- `src/features/club/` — quản lý CLB theo tenant: `/clubs`, `/clubs/:clubId`
- `tests/tenant.test.js`, `docs/MULTI-TENANT-SPRINT2-CHECKLIST.md`
- Dev users: `owner@futurearena.local`, `owner@abc.local`, `owner@elite.local`

### Changed
- Auto-stamp `tenantId` khi save players/courts/tournaments/bookings/customers
- `guardClubAccess` + `guardClubTenant` khi RBAC bật và CLB đã gán tenant
- Role alias: `TENANT_OWNER`, `CLUB_MANAGER` → canonical Sprint 1 roles
- `PlayerProfile` — chặn cross-tenant qua `guardRecordTenant`

### Security
- User tenant A không đọc/ghi dữ liệu tenant B (service guard + ClubContext filter)
- SUPER_ADMIN switch tenant trên header — CLB active đổi theo tenant

### Unchanged
- `VITE_RBAC_ENABLED=false` → workflow cũ. Chưa deploy production.

### Verification
- `node --test tests/tenant.test.js`: 11/11 pass
- `npm run test:unit`: 443/443 pass
- `npm run build`: Pass
- Tournament cross-tenant: `assertTournamentAccess` + `TournamentManageGate`
- Cloud pull: reject `venue_id` mismatch (`cloudSync.js`)

## [4.0.0-beta] - Identity & Permission — Phase B

**Mục tiêu:** Auth flows, User Management, My Profile, `/403`, Audit service, Referee session login. RBAC mặc định **tắt** — không phá màn cũ.

### Added
- `docs/STAGING-APPLY-QA-v40.md` — index QA staging v4.0 (Phase B + Sprint 2)
- Pages: `ForbiddenPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `MyProfilePage`, `UserManagementPage`, `RefereeHub`, `RefereeSessionScoreboard`
- Services (`src/features/identity/services/`): `auditService`, `passwordService`, `userManagementService`, `selfProfileService`, `refereeSessionService`
- SQL: `docs/supabase-identity-v40-phaseB.sql` (+ rollback) — `audit_logs` mở rộng, `password_reset_tokens`
- Tests: `tests/identity-phaseB.test.js` (guards, password, audit, user mgmt, profile, referee)
- Docs: `docs/STAGING-APPLY-QA-v40-phaseB.md` — QA staging Phase B

### Changed
- `authGuard.js` — public/authenticated-only paths; redirect `/403` khi thiếu quyền
- `RouteAccessGate.jsx` — RBAC deny → `/403` (chưa login → `/login`)
- `router.jsx` — route Phase B; legacy `/referee/:token` giữ ngoài MainLayout
- `menuAccess.js`, `sidebarMenu.js` — Users, Profile, Referee hub
- `authService.js` — audit login/logout/login_failed
- `Header.jsx` — link Hồ sơ / Users
- `LoginPage.jsx` — link Quên mật khẩu
- `RefereeScoreboard.jsx` — hỗ trợ session mode + legacy banner
- `docs/SUPABASE-STAGING-CHECKLIST.md` — thêm SQL identity v4.0
- `src/features/identity/ARCHITECTURE.md` — mục Phase B

### Security
- Đổi mật khẩu yêu cầu mật khẩu hiện tại; reset dùng token có hạn
- Audit log không ghi password/token nhạy cảm
- User thường không tự nâng role; không xóa cứng user (soft disable)
- REFEREE session không truy cập admin/users/system

### Unchanged
- `VITE_RBAC_ENABLED=false` mặc định — workflow cũ không đổi
- Legacy `/referee/:token` vẫn hoạt động
- Không deploy production

### Verification
- `npm run build`: Pass
- `npm test`: 419/419 pass

## [4.0.0-alpha] - Identity & Permission — Phase A

### Added
- Module `src/features/identity/` — roles, permissions CRUD, matrix, `normalizeRole` VENUE_* ↔ COURT_*
- SQL: `docs/supabase-identity-v40-sprint1.sql` (+ rollback) — `profiles` phone/avatar, `roles`/`permissions`/`audit_logs`
- `scripts/migrate-permissions-v40.mjs` — migrate permission keys trong codebase
- `src/features/identity/ARCHITECTURE.md`

### Changed
- `src/auth/permissions.js`, `roles.js`, `rolePermissions.js` — re-export identity
- `src/auth/rbac.js` — multi-scope `can()`, REFEREE role
- ~30 file pages/domain — permission keys CRUD (`player.view`, `court.create`, …)

### Verification
- `npm run build`: Pass
- `npm test`: 412/412 pass

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
