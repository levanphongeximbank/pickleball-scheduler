# Phase 19B — RBAC / Navigation / Runtime Patch Report

**Ngày:** 2026-07-05  
**Branch:** `v5-platform-edition`  
**Production URL (pre-patch):** `https://pickleball-scheduler-eight.vercel.app`  
**Deploy live:** `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB`  
**Patch status:** ✅ **DEPLOYED Production** (2026-07-05)  
**Deployment ID:** `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`  
**Rollback target:** `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB`  
**Manual RBAC retest:** ⏳ PENDING (§16 controlled test report)  
**Rollback deploy vì patch:** ⛔ **NO**  
**Payment live:** ⛔ **OFF**  
**Gate 4:** ⛔ **BLOCKED** (cần redeploy + retest RBAC PASS)

---

## 1. Vì sao Founder (SUPER_ADMIN) bị chặn?

**Root cause:** Lớp **platform runtime preview** (`buildRuntimeAccessState`) chạy **song song** identity RBAC, dùng:

1. Permission matrix thiếu (`tournament.manage`, `club.manage`, `system.setting`, … không có trong `SUPER_ADMIN`).
2. User **hardcoded demo** `{ user_id: "demo-admin", role: "SUPER_ADMIN" }` — không map user thật từ AuthContext.
3. Khi permission không khớp matrix → `accessAllowed = false` → UI hiện *"Runtime platform chặn thao tác quản lý giải đấu/quản lý sân"* và disable thao tác dù identity RBAC đã cho phép.

**Patch:**

- `runtimeAccess.js` — bridge identity RBAC trước platform matrix; SUPER_ADMIN bypass.
- `core/platform/index.js` + `services/index.js` — mở rộng permission matrix; SUPER_ADMIN wildcard trong `authorize()`.
- `usePageRuntimeAccess.js` — hook dùng user thật + `AuthContext.can()`.
- `TenantContext.jsx` — SUPER_ADMIN không bị `TenantGate` chặn khi tenant chưa hydrate.

---

## 2. Vì sao COURT_OWNER bị hiểu sai?

**Root cause (UX/naming):**

- Role code `COURT_OWNER` + label cũ **"Chủ sân"** gợi ý chủ **một sân đơn lẻ**.
- Nghiệp vụ đúng: **COURT_OWNER = chủ cụm sân / cơ sở (venue/tenant)**, quản lý **nhiều sân con** (`court.*` permissions).

**Patch terminology:**

| Khái niệm code | Nghiệp vụ | Label UI mới |
|---------------|----------|--------------|
| `venue` / `tenant` | Cụm sân / cơ sở | Cụm sân / Cơ sở |
| `court` | Sân pickleball vật lý | Sân thi đấu / Sân con |
| `COURT_OWNER` | Chủ cụm sân | **Chủ cụm sân** |

Menu admin **"Sân"** → **"Sân thi đấu"**; nhóm **"Vận hành sân"** → **"Vận hành cụm sân"**.

Logic RBAC **đã** scope theo `venueId` — patch chủ yếu terminology + runtime gate (không còn chặn owner thao tác giải/sân).

---

## 3. Thuật ngữ venue/court đã sửa thế nào?

| File | Thay đổi |
|------|----------|
| `src/features/identity/constants/roles.js` | `COURT_OWNER` → "Chủ cụm sân"; `TENANT_OWNER` → "Chủ cụm sân" |
| `src/config/navigationConfig.js` | VENUE_OPS label, admin courts/tenants labels |
| `src/pages/admin/TenantManagement.jsx` | Mô tả "Quản lý cụm sân / cơ sở pickleball" |
| `src/components/TenantGate.jsx` | Button "Quản lý cụm sân" |

**Không đổi** route path (`/court-management/courts` giữ nguyên — chỉ đổi nhãn hiển thị).

---

## 4. CLUB_OWNER 403 do đâu?

**Root cause kép:**

1. **Route scope:** `resolveRouteAccessScope` không fallback `activeClubId` khi profile thiếu `clubId` → `can(CLUB_VIEW)` fail → `/403`.
2. **Runtime gate:** `club.manage` không có trong platform matrix → `ClubManagement` set `accessAllowed=false` (chặn thao tác, có thể gây cảm giác 403).

**Patch:**

- `profileVenueService.js` — `clubId: user?.clubId || activeClubId`.
- `rbac.js` — CLUB scope cho phép khi `scope.clubId` khớp active club.
- `menuAccess.js` — home CLUB_OWNER → `/club`.
- Identity bridge cho `club.manage`.

---

## 5. REFEREE menu đã tối giản chưa?

**Trước patch:** REFEREE thấy nhóm **Trọng tài** + **Giải đấu** (full) + **Hỗ trợ** (billing/settings/…).

**Sau patch:**

| Nhóm | REFEREE thấy |
|------|--------------|
| Trọng tài | Chấm trận, Quét QR, Kết quả & Xếp hạng |
| Hỗ trợ | Chỉ Hồ sơ (ẩn billing/settings/marketplace) |
| Ẩn | Giải đấu, Vận hành, Tài chính, CLB, Quản trị |

Mobile bottom nav referee profile giữ 4 tab: Trận đấu, Nhập điểm, Kết quả, Hồ sơ.

Thêm `STATISTICS_VIEW` cho REFEREE để vào `/statistics`.

---

## 6. File đã sửa

| Layer | Files |
|-------|-------|
| Platform runtime | `src/core/platform/app/runtimeAccess.js`, `usePageRuntimeAccess.js`, `src/core/platform/index.js`, `src/core/platform/services/index.js` |
| Tenant / scope | `src/context/TenantContext.jsx`, `src/components/TenantGate.jsx`, `src/features/tenant/services/profileVenueService.js` |
| Identity RBAC | `src/features/identity/constants/roles.js`, `src/features/identity/matrix/rolePermissions.js`, `src/auth/rbac.js`, `src/auth/menuAccess.js` |
| Navigation | `src/config/navigationConfig.js`, `src/features/mobile/services/mobileNavAccess.js` |
| Pages | `src/pages/tournament/TournamentHome.jsx`, `src/pages/ClubManagement.jsx`, `src/pages/admin/TenantManagement.jsx` |
| Build fix (pre-existing) | `src/components/tournament/TeamRosterPanel.jsx` (icon import) |
| Tests | `tests/rbac.test.js`, `tests/core-platform-runtime.test.js` |
| Docs | `docs/v5/PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`, this file |

---

## 7. Test đã thêm/sửa

### `tests/rbac.test.js` (Phase 19B block)

1. SUPER_ADMIN — admin/tournament/court-engine/audit routes
2. COURT_OWNER — dashboard, billing, court-engine, tournament, courts
3. COURT_OWNER — không venue khác
4. CLUB_OWNER — `/club` không 403 + home `/club`
5. CLUB_OWNER — bootstrap clubId từ activeClub
6. REFEREE — menu tối giản (không Giải đấu/Tài chính/CLB)
7. CASHIER — menu pass regression
8. Venue/court labels
9. PLAYER — không admin routes

### `tests/core-platform-runtime.test.js`

1. `buildPageRuntimeAccessState` — SUPER_ADMIN + `tournament.manage`
2. `buildPageRuntimeAccessState` — COURT_OWNER via identity RBAC

---

## 8. Kết quả test / build / lint

| Gate | Kết quả |
|------|---------|
| `npm test` | ✅ **847/847 PASS** (58 suites) |
| `npm run build` | ✅ PASS (`5.0.0-rc1`, Vite 8.1.0) |
| `npm run lint` | ⚠️ **0 errors mới** · ~134 warnings pre-existing (animation hooks, team-tournament files) |

---

## 9. Có cần owner GO redeploy patch không?

✅ **DONE** — Owner Phong GO 2026-07-05 · deployed `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`

| Item | Giá trị |
|------|---------|
| Live deployment | `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| Inspector | `https://vercel.com/pickleball-scheduler/pickleball-scheduler/93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| Rollback nếu retest FAIL nghiêm trọng | Promote `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| Payment live | ⛔ **OFF** |

**Retest:** Manual RBAC §16 — 6 account role matrix (owner Phong).

---

## 10. Có được Gate 4 chưa?

⛔ **CHƯA**

| Điều kiện | Trạng thái |
|-----------|------------|
| Gate 1/2/3 | ✅ PASS |
| Phase 19B deploy | ✅ DONE |
| Manual RBAC smoke (pre-patch) | ❌ FAIL |
| RBAC patch redeploy | ✅ DONE |
| Manual RBAC retest (post-patch) | ⏳ PENDING |
| P1-Auth-01 reset redirect | ⏳ Owner Supabase URL |
| P1-Tournament-01 open_doubles | ⏳ Post-19B |
| Payment live OFF | ✅ |
| Commercial Beta / GA | ⛔ **BLOCKED** |

**Gate 4 mở khi:** RBAC manual retest PASS + T+24h PASS + backlog P1 đóng theo kế hoạch owner.

---

## Role matrix sau patch (kỳ vọng retest)

| Role | Kỳ vọng |
|------|---------|
| SUPER_ADMIN | Platform admin, tenant selector, không runtime block |
| COURT_OWNER | Dashboard cụm sân, courts, booking, court-engine, tournament venue, billing |
| CASHIER | Giữ PASS |
| CLUB_OWNER | `/club`, members, internal tournament — không 403 |
| REFEREE | QR + chấm trận + kết quả — menu tối giản |
| PLAYER | Giữ PASS; Team Captain = P2 |

---

**Report author:** Engineering (Codex 2026-07-05)
