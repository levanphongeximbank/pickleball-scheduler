# MENU_READINESS_MATRIX

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Live sidebar source (legacy shell):** `src/config/navigationConfig.js` `MENU_GROUPS` ← `src/config/v5Menu/`  
**Canonical sidebar source (Production shell evidence):** `canonicalMenuData.js` + `filterCanonicalMenu.js`  
**Feature audit:** `fullMenuAudit.js` + `APPROVED_PARTIAL_MENU_PATHS`

## Executive counts

```
LIVE_MENU_ROUTES=63
LIVE_DYNAMIC_MENU_ROUTES=3
PARTIAL_MENU_ROUTES=6
LEGACY_MENU_ROUTES=11
DEAD_MENU_ROUTES=0
DUPLICATE_MENU_ROUTES=25
COMING_SOON_MENU_ROUTES=3
ROLE_RESTRICTED_LEAVES=74
V5_MENU_LEAVES=115
V5_UNIQUE_PATHS=83
CANONICAL_MENU_NODES=120
```

Classification used here:

| Class | Rule |
|-------|------|
| LIVE | `featureStatus=live`, router exists, not a legacy tournament hub family |
| PARTIAL | Exact `APPROVED_PARTIAL_MENU_PATHS` |
| LEGACY | `/tournament` and `/tournament/*` hubs still in V5 sidebar (OD-B02 retain routes; menu still exposes hubs) |
| DEAD | Menu path with no router match — **none** after nested `/court-management/*` and `/mobile/*` |
| DUPLICATE | Same destination, ≥2 leaves |
| ROLE_RESTRICTED | `roles` / `excludeRoles` present |

---

## Approved PARTIAL (honest)

| Path | Label family |
|------|----------------|
| `/crm/messages` | CRM tin nhắn |
| `/crm/templates` | Mẫu |
| `/crm/campaigns` | Chiến dịch |
| `/crm/history` | Lịch sử |
| `/crm/reminders/booking` | Nhắc đặt sân |
| `/reports` | Báo cáo |

---

## V5 level-1 groups vs user spec

| Spec group | V5 `V5_MENU_GROUPS` id | Status |
|------------|------------------------|--------|
| Tổng quan | `dashboard` | LIVE |
| Vận hành sân | `venue-ops` | LIVE |
| Khách hàng & VĐV | `customers` | LIVE |
| CLB & Huấn luyện | `club` | LIVE (includes Daily Play) |
| Giải đấu | `tournament` | LEGACY hubs — does **not** deep-link Experience 23 screens |
| Tài chính | `finance` | LIVE |
| Tổ chức | `tenant` | LIVE (billing plan/upgrade only) |
| Báo cáo | `reports` | PARTIAL |
| Chăm sóc khách hàng | `crm` | PARTIAL + misleading “Thông báo” |
| Trợ lý thông minh | `ai` | LIVE if `VITE_ENABLE_AI_ENGINE` |
| Quản trị | `admin` | LIVE (platform-gated leaves) |
| Tài khoản | `profile` | LIVE via special-case (not in `ROLE_MENU_MAP`) |
| Hỗ trợ | `support` | LIVE menu / **permission mismatch** on route |
| Giao tiếp (extra) | `messaging` | LIVE route; **not in `ROLE_MENU_MAP`** |

Canonical L1 adds: Xếp hạng, Thông báo, Cổng công khai, Quản trị nền tảng — richer than V5.

---

## Critical menu defects

### 1. `messaging` omitted from `ROLE_MENU_MAP` — ROLE_RESTRICTED / broken visibility

`src/config/navigationConfig.js`: group `messaging` is never listed.  
`isGroupAllowedForRole` special-cases `profile`, **not** `messaging`.  
Result: **Giao tiếp `/messages` visible only to PLATFORM_ADMIN / SUPER_ADMIN (`*`)** even though route permissions are `[]` (any authenticated user).

Class: **LIVE** destination, **ROLE_RESTRICTED** visibility bug.

### 2. Tournament sidebar still LEGACY hubs

V5 Giải đấu leaves go to `/tournament`, `/tournament/list`, `/tournament/types`, `/tournament/roster`, `/tournament/organize`, `/tournament/operations`, `/tournament/results`, `/tournament/config`, `/tournament/create`, `/tournaments`.

Frozen Experience screens (`/tournament/:id/overview` …) have **in-page nav only**.  
OD-B02: Canonical filter hides most `/tournament/*` except allowlisted hubs. V5 still shows those hubs.

Class: **LEGACY** (hubs) + **CANONICAL_ADOPTION_GAP**.

### 3. Duplicate destinations (25 unique paths)

Highest noise:

| Path | Competing labels |
|------|------------------|
| `/manage/clubs` | Tạo CLB / Quản trị CLB / Quản lý CLB |
| `/coaching/coaches` vs `/coaching/coach-list` | Cùng nhãn “Danh sách HLV” |
| `/dashboard/rankings` | Xếp hạng VPR vs Quản trị VPR |
| `/court-management/courts` | Vận hành vs Admin |
| `/crm/messages` | CRM vs Captain “Tin nhắn đội” |
| `/support` | Support + Captain + Tech |
| `/tournaments` | Player / staff / referee “Giải của tôi” |
| `/platform/clubs` | Tất cả CLB vs Sổ CLB Platform |

### 4. Misleading labels

| Menu text | Actual route | Issue |
|-----------|--------------|-------|
| CRM › Thông báo | `/mobile/notifications` | Push settings, not CRM |
| Captain › Tin nhắn đội | `/crm/messages` | CRM outreach, PARTIAL |
| Legacy Header Help | `/settings` | Not `/support` |
| Dual HLV lists | two paths | Same label |

### 5. Coming soon (SYSTEM_TECHNICIAN)

- `/coming-soon/tech-diagnostics`
- `/coming-soon/tech-error-log`
- `/coming-soon/tech-support-history`

Class: **DEAD** product-wise, **LIVE** router placeholder.

### 6. Team captain `resolvePath`

Three leaves resolve to `/team-portal/:id` at runtime. If `user.tournamentId` missing → **null path**. Class: **LIVE_DYNAMIC** / broken UX.

---

## Full V5 leaf matrix (grouped)

### Tổng quan — LIVE

| Label | Path | Class |
|-------|------|-------|
| Tổng quan | `/dashboard` | LIVE |
| Xếp hạng VPR | `/dashboard/rankings` | LIVE + DUPLICATE (admin) |

### Vận hành sân — LIVE

| Label | Path | Class |
|-------|------|-------|
| Lịch sân | `/court-management/calendar` | LIVE |
| Đặt sân | `/court-management/bookings` | LIVE |
| Check-in | `/mobile/check-in` | LIVE + DUPLICATE (captain) |
| Danh sách chờ | `/select-players` | LIVE |
| Điều phối sân | `/court-engine` | LIVE |
| Quản lý sân | `/court-management/courts` | LIVE + DUPLICATE (admin) |

### Khách hàng & VĐV — LIVE

| Label | Path | Class |
|-------|------|-------|
| Khách hàng | `/court-management/customers` | LIVE |
| Hội viên | `/court-management/members` | LIVE |
| Vận động viên | `/players` | LIVE + DUPLICATE (tech) |
| Điểm trình độ | `/players/skill` | LIVE |
| Đánh giá lần đầu | `/player/skill-assessment` | LIVE + DUPLICATE (player zone) |

### CLB & Huấn luyện — LIVE + DUPLICATE

Club/discovery/coaching leaves as in `clubCoachingMenu.js`. Daily Play `/daily-play` LIVE but PLAYER-restricted at route prefix.

### Giải đấu — LEGACY hubs + LIVE `/tournaments`

| Label | Path | Class |
|-------|------|-------|
| Tổng quan | `/tournament` | LEGACY |
| Giải của tôi | `/tournaments` | LIVE + DUPLICATE |
| Danh sách giải | `/tournament/list` | LEGACY |
| Tạo giải | `/tournament/create` | LEGACY (create is current; landing after create is legacy setup) |
| Loại giải | `/tournament/types` | LEGACY |
| VĐV / Đội | `/tournament/roster` | LEGACY |
| Tổ chức thi đấu | `/tournament/organize` | LEGACY |
| Điều hành | `/tournament/operations` | LEGACY |
| Kết quả | `/tournament/results` | LEGACY |
| Cấu hình | `/tournament/config` | LEGACY |

### Tài chính / Tổ chức / Báo cáo / CRM / AI / Admin / Profile / Support

See route inventory. CRM + Reports = PARTIAL. `/messages` = LIVE but hidden. `/support` = LIVE menu, route needs `SUPPORT_TICKET_MANAGE` **or** `BILLING_VIEW` — many roles will 403.

---

## Canonical vs V5 drift

| V5 path not in Canonical | Canonical-only examples |
|--------------------------|-------------------------|
| `/player/profile` | `/home`, `/notifications`, `/billing`, `/marketplace`, `/admin/marketplace/*`, `/admin/billing/*`, `/admin/api-*`, `/mobile/operations`, `/mobile/qr-generate`, `/tournament/register`, `/tournament/my`, `/support/guide`, `/support/faq`, public `/clubs` `/courts` `/rankings` `/news` |
| `/tournament/schedule` | Experience 23 operator routes **also missing from Canonical catalog** (stale Aug 7 inventory) |
| `/tournament/teams` | |

Canonical catalog still marks `/tournament/:id/public` as LEGACY — **wrong** after Production Cutover.

---

## Menu readiness by destination class

| Class | Unique paths | Ready for Production menu? |
|-------|-------------:|----------------------------|
| LIVE | 63 | Yes, with duplicate/label cleanup later |
| PARTIAL | 6 | Yes if badge remains |
| LEGACY | 11 | Hubs exist; **not** Experience-aligned |
| DEAD | 0 | n/a |
| DUPLICATE | 25 | Noisy, not broken |
| Coming soon | 3 | Tech only |

**Verdict:** Menu is **functionally navigable** (no static dead links) and **not Experience-complete**. Production Canonical shell and V5 menu tell different stories.
