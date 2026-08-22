# MASTER_ROUTE_INVENTORY

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Base:** `origin/main` @ `e023e0d7521dee052420454a3182a3cfca9d9ded`  
**Source of truth:** `src/router.jsx` (203 `path=` declarations)  
**Catalog note:** `src/features/canonical-shell/config/canonicalRouteCatalog.js` is stale (generated 2026-08-07, 179 routes) and does **not** list the frozen Tournament Experience 23-screen family.

## Classification legend — CURRENT_UI_GENERATION

| Value | Meaning |
|-------|---------|
| `CANONICAL_CURRENT` | Frozen Tournament Experience 23-screen visual language (`src/features/tournament/experience-a1/`). Do not redesign. |
| `LEGACY_V1` | Pre-v5 / setup-era tournament and director/engine surfaces still reachable. |
| `LEGACY_V2` | v5 operational modules (Slate Enterprise). Production-current functionally; not Experience visual language. |
| `MIXED` | Current shell/chrome wrapping older page body, or dual old/new path. |
| `UNKNOWN` | Placeholder, 404 stub, or incomplete surface. |

## Totals

```
TOTAL_ROUTES=203
REDIRECT_ROUTES=5
LAYOUT_ONLY_PARENTS=1
TOTAL_USER_VISIBLE_ROUTE_PATTERNS=197
```

Redirects (not user screens): `/onboarding/pick-vn-rating`, `/clubs/discover`, `/club/activity`, `/courts-ops`, `/tournament/entry-fee`.  
Layout-only parent: `/mobile` (children are the screens).

Default authenticated **LAYOUT** = `MainLayout` → production evidence (2026-08-07) renders `CanonicalAppShell` when `VITE_CANONICAL_APP_SHELL_ENABLED=true`; code default is OFF (legacy Header/Sidebar). This inventory records LAYOUT as `MainLayout` unless a dedicated layout is used.

---

## A. AUTH / ACCOUNT (no MainLayout except where noted)

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/login` | AUTH | Đăng nhập | Standalone | Public | none | MIXED | OK desktop/mobile | Supabase Auth + optional dev users | WRITE (session) | CURRENT | no | Signup on same page when flag on. Dev-user picker if `isDevAuthAllowed`. |
| `/forgot-password` | AUTH | Quên mật khẩu | Standalone | Public | none | LEGACY_V2 | OK | Supabase Auth | WRITE | CURRENT | no | |
| `/reset-password` | AUTH | Đặt lại mật khẩu | Standalone | Public (token) | none | LEGACY_V2 | OK | Supabase Auth | WRITE | CURRENT | no | |
| `/change-password` | AUTH | Đổi mật khẩu bắt buộc | Standalone | Authenticated (must-change) | none | LEGACY_V2 | OK | Identity password service | WRITE | CURRENT | no | Gate redirects here. |
| `/403` | AUTH | Không có quyền | Standalone | Authenticated | none | LEGACY_V2 | OK | none | NONE | CURRENT | no | |
| `/coming-soon/:moduleKey` | AUTH | Tính năng mới | MainLayout | Role-filtered | System tech placeholders | UNKNOWN | OK | none | NONE | LEGACY | no | Tech diagnostics / error-log / support-history. |

---

## B. PUBLIC SURFACES

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/` | PUBLIC | Cổng PICK_VN | PublicLayout | Public | Cổng công khai (canonical menu) | MIXED | OK | Public catalog reads | NONE | CURRENT | vs `/home` | PublicRootPage. |
| `/home` | PUBLIC | Trang chủ | PublicLayout | Public | Cổng công khai | MIXED | OK | Public content | NONE | CURRENT | vs `/` | |
| `/public/tournaments` | PUBLIC | Giải đấu công khai | PublicLayout | Public | none in V5 sidebar | MIXED | OK | Tournament public list | NONE | CURRENT | vs `/tournaments` (auth hub) | Comment in router: not My Tournaments. |
| `/clubs` | PUBLIC | CLB công khai | PublicLayout | Public | Canonical portal | MIXED | OK | Public clubs | NONE | CURRENT | vs `/manage/clubs` | |
| `/clubs/:publicId` | PUBLIC | CLB không tìm thấy | PublicLayout | Public | none | UNKNOWN | OK | none | NONE | CURRENT | no | `PublicCatalogNotFoundPage`. |
| `/courts` | PUBLIC | Sân công khai | PublicLayout | Public | Canonical portal | MIXED | OK | Public courts | NONE | CURRENT | vs `/court-management/courts` | |
| `/courts/:publicId` | PUBLIC | Sân không tìm thấy | PublicLayout | Public | none | UNKNOWN | OK | none | NONE | CURRENT | no | |
| `/rankings` | PUBLIC | BXH công khai | PublicLayout | Public | Canonical portal | MIXED | TABLE_SCROLL | Ranking reads | NONE | CURRENT | vs `/dashboard/rankings` | |
| `/news` | PUBLIC | Tin tức | PublicLayout | Public | Canonical portal | MIXED | OK | News reads | NONE | CURRENT | no | |
| `/tournament/:tournamentId/public` | TOURNAMENT_EXPERIENCE | Giải đấu công khai | PublicTournamentExperienceLayout | Public | none | CANONICAL_CURRENT | OK (cards) | Canonical tournament read | NONE | CURRENT | vs public catalog | Frozen screen #23. |

---

## C. APP SHELL — TỔNG QUAN / DASHBOARD

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/dashboard` | DASHBOARD | Tổng quan | MainLayout | Most ops roles | Tổng quan | MIXED | OK; analytics tables scroll | Dashboard analytics | READ | CURRENT | no | Not Experience visual language. |
| `/dashboard/rankings` | RANKING | Xếp hạng VPR | MainLayout | Ranking perms | Tổng quan › Xếp hạng VPR; also Admin | LEGACY_V2 | TABLE_SCROLL | Ranking admin | READ_WRITE | CURRENT | DUPLICATE menu labels | |
| `/dev/pairing-intervention-preview` | DEV | Pairing preview | MainLayout | SUPER_ADMIN | none | UNKNOWN | n/a | Dev preview | NONE | CURRENT | no | Not production user surface. |
| `/statistics` | REPORTS | Thống kê | MainLayout | STATISTICS_VIEW | Referee zone / captain | LEGACY_V2 | TABLE_SCROLL | Season/Elo stats | READ | CURRENT | vs `/reports` | |
| `/reports` | REPORTS | Báo cáo | MainLayout | STATISTICS/FINANCE | Báo cáo | MIXED | OK hub | Hub only | NONE | CURRENT | vs `/statistics` | Approved PARTIAL. |

---

## D. VẬN HÀNH SÂN

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/court-management` | VENUE | Trạng thái sân | MainLayout + CourtManagementLayout | COURT_VIEW | none (index) | LEGACY_V2 | OK | Court ops | READ | CURRENT | no | Nested tabs. |
| `/court-management/calendar` | VENUE | Lịch sân | CourtManagementLayout | BOOKING_VIEW | Vận hành sân › Lịch sân | LEGACY_V2 | CRITICAL overflow week matrix minWidth 900 | Calendar reads | READ_WRITE | CURRENT | no | High-traffic. |
| `/court-management/calendar/preview` | VENUE | Preview lịch | CourtCalendarShell | BOOKING_VIEW | none | LEGACY_V2 | OVERFLOW | Calendar | READ | CURRENT | no | |
| `/court-management/bookings` | VENUE | Đặt sân | CourtManagementLayout | BOOKING_VIEW | Vận hành sân › Đặt sân | LEGACY_V2 | TABLE_SCROLL | Bookings | READ_WRITE | CURRENT | no | |
| `/court-management/revenue` | FINANCE | Doanh thu sân | CourtManagementLayout | FINANCE_VIEW | Tài chính › Doanh thu | LEGACY_V2 | TABLE_SCROLL | Revenue | READ | CURRENT | no | |
| `/court-management/customers` | CUSTOMERS | Khách hàng | CourtManagementLayout | CUSTOMER_VIEW | Khách hàng & VĐV | LEGACY_V2 | TABLE_SCROLL | Customers | READ_WRITE | CURRENT | no | |
| `/court-management/members` | CUSTOMERS | Hội viên | CourtManagementLayout | CUSTOMER_VIEW | Khách hàng & VĐV | LEGACY_V2 | TABLE_SCROLL | Members | READ_WRITE | CURRENT | no | |
| `/court-management/customer-groups` | CUSTOMERS | Nhóm khách | CourtManagementLayout | CUSTOMER_VIEW | none in V5 leaves | LEGACY_V2 | TABLE_SCROLL | Groups | READ_WRITE | CURRENT | no | |
| `/court-management/ops-log` | VENUE | Nhật ký vận hành | CourtManagementLayout | COURT_VIEW | none | LEGACY_V2 | TABLE_SCROLL | Ops log | READ | CURRENT | no | |
| `/court-management/courts` | VENUE | Quản lý sân | CourtManagementLayout | COURT_VIEW | Vận hành sân + Admin | LEGACY_V2 | OK cards/table | Courts | READ_WRITE | CURRENT | DUPLICATE menu | |
| `/court-management/future` | VENUE | Tính năng tương lai | CourtManagementLayout | COURT_UPDATE/VIEW | none | UNKNOWN | OK | none | NONE | LEGACY | no | Placeholder. |
| `/select-players` | VENUE | Danh sách chờ | MainLayout | SCHEDULING_VIEW | Vận hành sân | LEGACY_V1 | DENSE | Club blob + pairing | READ_WRITE | LEGACY | no | Xếp sân AI core. |
| `/court-engine` | VENUE | Điều phối sân | MainLayout | DIRECTOR/SCHEDULING | Vận hành sân | LEGACY_V1 | DENSE; small icon buttons | Engine | READ_WRITE | LEGACY | no | |

---

## E. KHÁCH HÀNG & VĐV / CLB & HUẤN LUYỆN

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/players` | PLAYERS | Vận động viên | MainLayout | PLAYER_VIEW | Khách hàng & VĐV | MIXED | Card grid OK | Club players | READ_WRITE | CURRENT | vs tech zone | Alert stack → layout shift. |
| `/players/skill` | PLAYERS | Điểm trình độ | MainLayout | PLAYER_VIEW | Khách hàng & VĐV | LEGACY_V2 | TABLE_SCROLL | Skill levels | READ_WRITE | CURRENT | no | |
| `/players/profile/:playerId` | PLAYERS | Hồ sơ VĐV | MainLayout | PLAYER_VIEW | none | MIXED | OK | Player history | READ_WRITE | CURRENT | vs `/player/profile` | |
| `/profile` | ACCOUNT | Hồ sơ của tôi | MainLayout | Authenticated (not PLAYER group) | Tài khoản | LEGACY_V2 | OK | profiles | READ_WRITE | CURRENT | vs `/player/profile` | |
| `/athletes` | PLAYERS | Danh bạ VĐV | MainLayout | Authenticated | Tài khoản | LEGACY_V2 | OK | Directory | READ | CURRENT | DUPLICATE zones | |
| `/athletes/:playerId` | PLAYERS | Chi tiết danh bạ | MainLayout | Authenticated | none | LEGACY_V2 | OK | Directory | READ | CURRENT | no | |
| `/player/profile` | PLAYER | Hồ sơ VĐV (self) | MainLayout | PLAYER/CUSTOMER | Player zone | LEGACY_V2 | OK | Athlete profile | READ_WRITE | CURRENT | vs `/profile` | Not in Canonical catalog. |
| `/player/skill` | PLAYER | Trình độ của tôi | MainLayout | PLAYER | Player zone | LEGACY_V2 | OK | Skill | READ | CURRENT | no | |
| `/player/skill-assessment` | PLAYER | Đánh giá lần đầu | MainLayout | PLAYER | Khách hàng & VĐV / player zone | LEGACY_V2 | OK | Assessment | WRITE | CURRENT | no | |
| `/player/skill-assessment-v5` | PLAYER | Đánh giá V5 | MainLayout | SUPER_ADMIN + flag/enrollment | hidden (OD-B03) | MIXED | OK | V5 rating | WRITE | SHADOW | no | Shadow pilot. |
| `/club` | CLUB | Vận hành CLB | MainLayout | CLUB_VIEW; exclude PLAYER | CLB & Huấn luyện | LEGACY_V1 | MIXED | Club blob v3 | READ_WRITE | LEGACY | vs `/manage/clubs` | ClubManagement. |
| `/manage/clubs` | CLUB | Danh sách CLB | MainLayout | CLUB_VIEW | Tạo/Quản trị/Quản lý CLB | MIXED | OK | Club registry | READ_WRITE | CURRENT | DUPLICATE ×3 labels | ClubPageShell. |
| `/manage/clubs/:clubId` | CLUB | Chi tiết CLB | MainLayout | CLUB_VIEW | none | MIXED | OK | Club registry | READ_WRITE | CURRENT | no | Deep-link to `/tournament/internal/:id` still. |
| `/platform/clubs` | CLUB | Tất cả CLB | MainLayout | PLATFORM_ADMIN | Admin / CLB | LEGACY_V2 | TABLE_SCROLL | Platform clubs | READ_WRITE | CURRENT | DUPLICATE labels | |
| `/my-club` | CLUB | CLB của tôi | MainLayout | Authenticated | CLB của tôi | MIXED | OK | Membership | READ_WRITE | CURRENT | no | |
| `/my-club/requests` | CLUB | Yêu cầu gia nhập | MainLayout | Authenticated | CLB | MIXED | OK | Join requests | READ_WRITE | CURRENT | no | |
| `/discover-clubs` | CLUB | Khám phá CLB | MainLayout | Authenticated | CLB | MIXED | OK | Discovery | WRITE (request) | CURRENT | `/clubs/discover` redirect | |
| `/daily-play` | TOURNAMENT | Vui chơi mỗi ngày | MainLayout | TOURNAMENT_VIEW; PLAYER blocked | CLB › Vui chơi mỗi ngày | LEGACY_V1 | OK | Daily play | WRITE (launch) | LEGACY | no | Domain extension, not 23-screen. |
| `/coaching/coaches` | COACHING | Danh sách HLV | MainLayout | Club group | Huấn luyện | LEGACY_V2 | OK | Coaching | READ_WRITE | CURRENT | vs `/coaching/coach-list` | Same label, different path. |
| `/coaching/coach-list` | COACHING | Danh sách HLV | MainLayout | Public-menu path | Player/coach | LEGACY_V2 | OK | Coaching | READ | CURRENT | DUPLICATE label | |
| `/coaching/register` | COACHING | Đăng ký gói học | MainLayout | Authenticated | Huấn luyện | LEGACY_V2 | OK | Packages | WRITE | CURRENT | no | |
| `/coaching/students` | COACHING | Học viên | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | TABLE_SCROLL | Students | READ_WRITE | CURRENT | no | |
| `/coaching/classes` | COACHING | Lớp học | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | OK | Classes | READ_WRITE | CURRENT | no | |
| `/coaching/schedule` | COACHING | Lịch huấn luyện | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | OVERFLOW calendar risk | Schedule | READ_WRITE | CURRENT | no | |
| `/coaching/packages` | COACHING | Gói học | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | OK | Packages | READ_WRITE | CURRENT | no | |
| `/coaching/attendance` | COACHING | Điểm danh | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | TABLE_SCROLL | Attendance | WRITE | CURRENT | no | |
| `/coaching/evaluations` | COACHING | Đánh giá học viên | MainLayout | Coach/ops | Huấn luyện | LEGACY_V2 | OK | Evaluations | WRITE | CURRENT | no | |

---

## F. TOURNAMENT EXPERIENCE — FROZEN 23 SCREENS (CANONICAL_CURRENT)

**Tournament protection:** Canonical 23-screen Tournament Experience remains frozen.  
Legacy Tournament surfaces may be converged later, but must not redesign the accepted 23-screen system.

Do **not** redesign. `VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED` default ON. Auth prefix: `/tournament/*` → `TOURNAMENT_VIEW` only (see ROLE_UX_MATRIX).

| # | ROUTE | PAGE_TITLE | COMPONENT | CURRENT_UI_GENERATION | DATA_SOURCE | MUTATION_CAPABILITY | NOTES |
|---|-------|------------|-----------|----------------------|-------------|---------------------|-------|
| Hub | `/tournament` | Trung tâm giải đấu | `TournamentCenterExperiencePage` (flag ON) | CANONICAL_CURRENT | Tournament list read | NONE (nav) | `?experience=legacy` → `CanonicalTournamentHubPage`. |
| 1 | `/tournament/:tournamentId/overview` | Tổng quan giải | `IndividualOverviewPage` | CANONICAL_CURRENT | Canonical tournament read | READ | ExperiencePageHeader. |
| 2 | `/tournament/:tournamentId/settings` | Cài đặt giải | `IndividualSettingsPage` | CANONICAL_CURRENT | Canonical settings | READ_WRITE | |
| 3 | `/tournament/:tournamentId/registration` | Đăng ký / công bố | `IndividualRegistrationPublicationPage` | CANONICAL_CURRENT | Registration | READ_WRITE | Batch B frame. |
| 4 | `/tournament/:tournamentId/participants` | VĐV tham dự | `IndividualParticipantsPage` | CANONICAL_CURRENT | Participants | READ_WRITE | |
| 5 | `/tournament/:tournamentId/pairs` | Thành cặp | `IndividualPairFormationPage` | CANONICAL_CURRENT | Pairing read/write | READ_WRITE | Preserve pairing authority. |
| 6 | `/tournament/:tournamentId/pair-draw` | Bốc thăm cặp | `IndividualPairDrawRoomPage` | CANONICAL_CURRENT | Draw runtime | READ_WRITE | Draw shell, not page header. |
| 7 | `/tournament/:tournamentId/group-draw` | Bốc thăm bảng | `IndividualGroupDrawRoomPage` | CANONICAL_CURRENT | Draw runtime | READ_WRITE | |
| 8 | `/tournament/:tournamentId/groups` | Vòng bảng | `IndividualGroupStagePage` | CANONICAL_CURRENT | Groups | READ_WRITE | |
| 9 | `/tournament/:tournamentId/schedule` | Lịch thi đấu | `IndividualSchedulePage` | CANONICAL_CURRENT | Schedule | READ_WRITE | |
| 10 | `/tournament/:tournamentId/matches` | Trung tâm trận | `IndividualMatchCenterPage` | CANONICAL_CURRENT | Matches | READ_WRITE | |
| 11 | `/tournament/:tournamentId/standings` | Bảng xếp hạng | `IndividualStandingsPage` | CANONICAL_CURRENT | Standings | READ | |
| 12 | `/tournament/:tournamentId/knockout` | Knockout | `IndividualKnockoutPage` | CANONICAL_CURRENT | Knockout | READ_WRITE | |
| 13 | `/tournament/:tournamentId/bracket` | Nhánh đấu | `IndividualBracketPage` | CANONICAL_CURRENT | Bracket | READ | |
| 14 | `/tournament/:tournamentId/director` | Điều hành | `IndividualDirectorOpsPage` | CANONICAL_CURRENT | Director ops read | READ_WRITE | Not a replacement of `TournamentDirectorMode` runtime. |
| 15 | `/tournament/:tournamentId/courts` | Bảng sân | `IndividualCourtBoardPage` | CANONICAL_CURRENT | Courts | READ_WRITE | |
| 16 | `/tournament/:tournamentId/referees` | Bảng trọng tài | `IndividualRefereeBoardPage` | CANONICAL_CURRENT | Referees | READ_WRITE | |
| 17 | `/tournament/:tournamentId/exceptions` | Ngoại lệ | `IndividualExceptionCenterPage` | CANONICAL_CURRENT | Exceptions | READ_WRITE | |
| 18 | `/tournament/:tournamentId/communications` | Truyền thông giải | `IndividualCommunicationsPage` | CANONICAL_CURRENT | Comms | READ_WRITE | |
| 19 | `/tournament/:tournamentId/media` | Trình chiếu | `IndividualMediaPresentationPage` | CANONICAL_CURRENT | Media | READ | |
| 20 | `/tournament/:tournamentId/awards` | Giải thưởng | `IndividualAwardsExperiencePage` | CANONICAL_CURRENT | Awards | READ_WRITE | |
| 21 | `/tournament/:tournamentId/complete` | Kết thúc giải | `IndividualCompleteTournamentPage` | CANONICAL_CURRENT | Complete | WRITE | |
| 22 | `/tournament/:tournamentId/register` | Đăng ký VĐV | `IndividualRegistrationPage` | MIXED | Registration write | WRITE | Athlete write; adjacent, not organizer 23. |
| 23 | `/tournament/:tournamentId/public` | (listed in Public) | `IndividualPublicExperiencePage` | CANONICAL_CURRENT | Public read | NONE | |

ACTIVE_MENU_ENTRY for all 21 operator screens: **none in V5 sidebar** (sidebar still points at legacy hubs `/tournament`, `/tournament/list`, …). In-page Experience nav is the active entry.

RESPONSIVE_STATUS: desktop OK; some secondary CTAs `display:none` below `sm`; tables cardify on several batch pages.

---

## G. TOURNAMENT LEGACY / HUBS / ENGINE / TEAM / REFEREE

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/tournament/list` | TOURNAMENT | Danh sách giải | MainLayout | TOURNAMENT_VIEW | Giải đấu › Danh sách | LEGACY_V2 | TABLE; small icon actions | Tournament list | READ | MIXED | vs `/tournaments` | |
| `/tournament/create` | TOURNAMENT | Tạo giải | MainLayout | TOURNAMENT_CREATE | Giải đấu › Tạo giải | MIXED | OK | Create writer | WRITE | MIXED | no | Post-create still opens legacy setup. |
| `/tournament/types` | TOURNAMENT | Loại giải | MainLayout | exclude PLAYER | Giải đấu › Loại giải | LEGACY_V2 | OK hub | none | NONE | LEGACY | no | Hub. PLAYER restricted. |
| `/tournament/types/:category` | TOURNAMENT | Loại giải (nhóm) | MainLayout | TOURNAMENT_VIEW | types hub | LEGACY_V2 | OK | none | NONE | LEGACY | no | |
| `/tournament/roster` | TOURNAMENT | VĐV / Đội | MainLayout | dual | Giải đấu › VĐV/Đội | LEGACY_V2 | OK hub | none | NONE | LEGACY | no | Adapter required. |
| `/tournament/organize` | TOURNAMENT | Tổ chức thi đấu | MainLayout | exclude PLAYER | Giải đấu › Tổ chức | LEGACY_V2 | OK hub | resolvers → director/engine/setup | NONE | LEGACY | no | |
| `/tournament/operations` | TOURNAMENT | Điều hành | MainLayout | exclude PLAYER | Giải đấu › Điều hành | LEGACY_V2 | OK hub | same | NONE | LEGACY | PLAYER restricted prefix. |
| `/tournament/results` | TOURNAMENT | Kết quả | MainLayout | dual | Giải đấu › Kết quả | LEGACY_V2 | OK hub | engine ranking | NONE | LEGACY | no | |
| `/tournament/register` | TOURNAMENT | Đăng ký (hub) | MainLayout | TOURNAMENT_UPDATE/VIEW | Canonical only | LEGACY_V2 | OK hub | none | NONE | LEGACY | vs per-id register | |
| `/tournament/my` | TOURNAMENT | Cổng VĐV | MainLayout | TOURNAMENT_VIEW | Canonical | MIXED | OK | Player tournaments | READ | CURRENT | no | KEEP athlete surface. |
| `/tournament/my/:tournamentId` | TOURNAMENT | Cổng VĐV (giải) | MainLayout | TOURNAMENT_VIEW | none | MIXED | OK | Player tournament | READ_WRITE | CURRENT | no | |
| `/tournament/teams` | TOURNAMENT | Đội | MainLayout | TOURNAMENT_VIEW | Captain zone | LEGACY_V1 | OK hub | Team | NONE | LEGACY | not on B02 allowlist | Canonical-hidden. |
| `/tournament/teams/presets` | TOURNAMENT | Preset đội | MainLayout | TOURNAMENT_VIEW | teams hub | LEGACY_V1 | OK | Team presets | READ_WRITE | LEGACY | no | Team extension. |
| `/tournament/teams/build/manual` | TOURNAMENT | Dựng đội thủ công | MainLayout | TOURNAMENT_VIEW | teams | LEGACY_V1 | OK | Team | WRITE | LEGACY | no | |
| `/tournament/teams/build/random` | TOURNAMENT | Dựng đội ngẫu nhiên | MainLayout | TOURNAMENT_VIEW | teams | LEGACY_V1 | OK | Team | WRITE | LEGACY | no | |
| `/tournament/teams/build/draft` | TOURNAMENT | Dựng đội draft | MainLayout | TOURNAMENT_VIEW | teams | LEGACY_V1 | OK | Team | WRITE | LEGACY | no | |
| `/tournament/schedule` | TOURNAMENT | Lịch (global hub) | MainLayout | TOURNAMENT_VIEW | Captain | LEGACY_V1 | OK hub | none | NONE | LEGACY | vs per-id schedule | Canonical-hidden. |
| `/tournament/match-reports` | TOURNAMENT | Báo cáo trận | MainLayout | TOURNAMENT_VIEW | none | LEGACY_V2 | TABLE | Reports | READ | LEGACY | no | |
| `/tournament/config` | TOURNAMENT | Cấu hình (hub) | MainLayout | exclude PLAYER | Giải đấu › Cấu hình | LEGACY_V2 | OK hub | none | NONE | LEGACY | PLAYER restricted. |
| `/tournament/config/format` | TOURNAMENT | Thể thức | MainLayout | TOURNAMENT_UPDATE | config hub | LEGACY_V1 | OK | Format | READ_WRITE | LEGACY | no | |
| `/tournament/config/settings` | TOURNAMENT | Thiết lập | MainLayout | TOURNAMENT_UPDATE | config | LEGACY_V1 | OK | Settings | READ_WRITE | LEGACY | vs experience settings | |
| `/tournament/config/age-rules` | TOURNAMENT | Luật tuổi | MainLayout | TOURNAMENT_UPDATE | config | LEGACY_V1 | OK | Rules | READ_WRITE | LEGACY | EN leftovers | |
| `/tournament/config/gender-rules` | TOURNAMENT | Luật giới tính | MainLayout | TOURNAMENT_UPDATE | config | LEGACY_V1 | OK | Rules | READ_WRITE | LEGACY | Whitelist EN | |
| `/tournament/config/fee` | TOURNAMENT | Lệ phí | MainLayout | TOURNAMENT_UPDATE | config | LEGACY_V1 | OK | Fees | READ_WRITE | LEGACY | Early-bird EN | |
| `/tournament/config/regulations` | TOURNAMENT | Điều lệ | MainLayout | TOURNAMENT_UPDATE | config | LEGACY_V1 | OK | Regulations | READ_WRITE | LEGACY | |
| `/tournament/eligibility` | TOURNAMENT | Điều kiện đội | MainLayout | TOURNAMENT_VIEW | teams | LEGACY_V1 | OK | Eligibility | READ | LEGACY | no | |
| `/tournament/eligibility/check` | TOURNAMENT | Kiểm tra điều kiện | MainLayout | TOURNAMENT_VIEW | eligibility | LEGACY_V1 | OK | Eligibility | READ | LEGACY | no | |
| `/tournament/publish-schedule` | TOURNAMENT | Công bố lịch | MainLayout | TOURNAMENT_UPDATE | none | LEGACY_V1 | OK | Schedule publish | WRITE | LEGACY | no | |
| `/tournament/referee-assign` | TOURNAMENT | Phân công trọng tài | MainLayout | TOURNAMENT_UPDATE | none | LEGACY_V1 | TABLE | Referee assign | WRITE | LEGACY | vs experience referees | |
| `/tournament/awards` | TOURNAMENT | Giải thưởng (global) | MainLayout | TOURNAMENT_VIEW | none | LEGACY_V1 | OK | Awards | READ_WRITE | LEGACY | vs per-id awards | |
| `/tournament/withdrawal` | TOURNAMENT | Rút lui | MainLayout | TOURNAMENT_UPDATE | none | LEGACY_V1 | OK | Withdrawal | WRITE | LEGACY | no | |
| `/tournament/bracket` | TOURNAMENT | Nhánh (hub) | MainLayout | TOURNAMENT_VIEW | none | LEGACY_V1 | OVERFLOW bracket | Bracket hub | READ | LEGACY | vs per-id bracket | |
| `/tournament/daily/:tournamentId` | TOURNAMENT | Daily Play setup | MainLayout | TOURNAMENT_VIEW | via launcher | LEGACY_V1 | MIXED | Daily play runtime | READ_WRITE | LEGACY | no | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION. |
| `/tournament/internal/:tournamentId` | TOURNAMENT | Setup nội bộ | MainLayout | TOURNAMENT_UPDATE | via create/club | LEGACY_V1 | MIXED | Internal runtime | READ_WRITE | LEGACY | vs overview | LEGACY_UI_TO_RETIRE. |
| `/tournament/internal/:tournamentId/bracket` | TOURNAMENT | Bracket nội bộ | MainLayout | TOURNAMENT_VIEW | none | LEGACY_V1 | OVERFLOW | Bracket | READ | LEGACY | vs experience bracket | |
| `/tournament/official/:tournamentId` | TOURNAMENT | Setup official | MainLayout | TOURNAMENT_UPDATE | via create | LEGACY_V1 | MIXED | Official runtime | READ_WRITE | LEGACY | vs overview | LEGACY_UI_TO_RETIRE. |
| `/tournament/official/:tournamentId/bracket` | TOURNAMENT | Bracket official | MainLayout | TOURNAMENT_VIEW | none | LEGACY_V1 | OVERFLOW | Bracket | READ | LEGACY | vs experience bracket | |
| `/tournament/team/:tournamentId` | TOURNAMENT | Setup giải đồng đội | MainLayout | TOURNAMENT_UPDATE | via create | LEGACY_V1 | MIXED | Team runtime | READ_WRITE | LEGACY | no | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION. Do not delete. |
| `/tournament/director/:tournamentId` | TOURNAMENT | Director Mode | MainLayout | DIRECTOR_USE | organize hub | LEGACY_V1 | DENSE ops | Director runtime | READ_WRITE | LEGACY | vs experience director | KEEP runtime. |
| `/tournaments` | TOURNAMENT | Giải của tôi | MainLayout | Authenticated | Giải đấu › Giải của tôi | MIXED | OK | My tournaments | READ | CURRENT | Canonical catalog wrongly tagged public portal | |
| `/tournaments/:tournamentId` | TOURNAMENT | Dashboard giải | MainLayout | Authenticated | none | MIXED | OK | Dashboard | READ | MIXED | vs overview | Adapter required. Copy may show “authority”. |
| `/tournaments/:tournamentId/engine` | TOURNAMENT | Tournament Engine | MainLayout | TOURNAMENT_UPDATE | none | LEGACY_V1 | TABLE | Engine runtime | READ_WRITE | LEGACY | 6 sibling tabs | Preserve runtime. EN title. |
| `/tournaments/:tournamentId/seed` | TOURNAMENT | Engine — seed | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ_WRITE | LEGACY | same component | |
| `/tournaments/:tournamentId/draw` | TOURNAMENT | Engine — draw | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ_WRITE | LEGACY | same | |
| `/tournaments/:tournamentId/schedule` | TOURNAMENT | Engine — lịch | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ_WRITE | LEGACY | vs experience schedule | |
| `/tournaments/:tournamentId/courts` | TOURNAMENT | Engine — sân | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ_WRITE | LEGACY | vs experience courts | |
| `/tournaments/:tournamentId/ranking` | TOURNAMENT | Engine — BXH | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ | LEGACY | vs standings | |
| `/tournaments/:tournamentId/logs` | TOURNAMENT | Engine — nhật ký | MainLayout | TOURNAMENT_UPDATE | engine | LEGACY_V1 | TABLE | Engine | READ | LEGACY | no | |
| `/team-portal/:tournamentId` | TEAM | Cổng đội trưởng | MainLayout | TEAM_VIEW | Captain resolvePath | LEGACY_V1 | MIXED | Team portal | READ_WRITE | LEGACY | no | Broken if `user.tournamentId` missing. |
| `/team-referee/:tournamentId` | TEAM | Cổng trọng tài đội | MainLayout | MATCH_UPDATE | none | LEGACY_V1 | MIXED | Team referee | READ_WRITE | LEGACY | no | |
| `/referee` | REFEREE | Trung tâm trọng tài | MainLayout | TOURNAMENT_VIEW + MATCH_UPDATE | Referee zone | MIXED | OK | Referee hub | READ | CURRENT | no | KEEP shared entry. |
| `/referee/:token` | REFEREE | Bảng điểm (token) | Standalone | Token session | none | LEGACY_V2 | MOBILE-FIRST | RPC token-scoped | WRITE score | CURRENT | no | Outside MainLayout. KEEP runtime. |
| `/referee/match/:matchId` | REFEREE | Trận V5 đồng đội | MainLayout | Authenticated (empty perms) | none | MIXED | MOBILE-FIRST | Referee V5 | WRITE | CURRENT | no | Team extension. |

---

## H. TÀI CHÍNH / TỔ CHỨC / CRM / AI / ADMIN / ACCOUNT / SUPPORT / MOBILE / MARKETPLACE

| ROUTE | MODULE | PAGE_TITLE | LAYOUT | ACCESS_ROLE | ACTIVE_MENU_ENTRY | CURRENT_UI_GENERATION | RESPONSIVE_STATUS | DATA_SOURCE | MUTATION_CAPABILITY | LEGACY_OR_CURRENT | DUPLICATE_ROUTE | NOTES |
|-------|--------|------------|--------|-------------|-------------------|----------------------|-------------------|-------------|---------------------|-------------------|-----------------|-------|
| `/billing` | BILLING | Thanh toán / gói | MainLayout | BILLING_VIEW | none (parent) | LEGACY_V2 | OK | Subscription | READ | CURRENT | child views | EN titles on children. |
| `/billing/current-plan` | BILLING | Gói hiện tại | MainLayout | BILLING_VIEW | Tổ chức | LEGACY_V2 | OK | Plan | READ | CURRENT | no | VN title. |
| `/billing/usage` | BILLING | Usage | MainLayout | BILLING_VIEW | none | LEGACY_V2 | OK | Usage | READ | CURRENT | no | EN title in router. |
| `/billing/invoices` | BILLING | Invoices | MainLayout | BILLING_INVOICE_VIEW | none | LEGACY_V2 | TABLE | Invoices | READ | CURRENT | no | EN. |
| `/billing/payment` | BILLING | Payment | MainLayout | BILLING_PAYMENT_VIEW | Tài chính › Thanh toán | LEGACY_V2 | OK | Payments | WRITE | CURRENT | no | EN. |
| `/billing/upgrade` | BILLING | Nâng cấp gói | MainLayout | BILLING_SUBSCRIPTION_VIEW | Tổ chức | LEGACY_V2 | OK | Plans | WRITE | CURRENT | no | |
| `/billing/support` | BILLING | Support | MainLayout | BILLING_VIEW | none | LEGACY_V2 | OK | none | NONE | CURRENT | vs `/support` | EN. |
| `/finance/debt` | FINANCE | Công nợ | MainLayout | FINANCE_VIEW | Tài chính | LEGACY_V2 | TABLE_SCROLL | Finance ledger | READ_WRITE | CURRENT | no | Staging runtime provider. |
| `/finance/receipts` | FINANCE | Phiếu thu | MainLayout | FINANCE_VIEW | Tài chính | LEGACY_V2 | TABLE_SCROLL | Ledger | READ_WRITE | CURRENT | no | |
| `/finance/refunds` | FINANCE | Hoàn tiền | MainLayout | FINANCE_VIEW | Tài chính | LEGACY_V2 | TABLE_SCROLL | Ledger | READ_WRITE | CURRENT | no | |
| `/crm/messages` | CRM | Tin nhắn CRM | MainLayout | CUSTOMER/BOOKING_VIEW | CRM; Captain | MIXED | OK | CRM | READ_WRITE | CURRENT | vs `/messages` | Approved PARTIAL. OD-B01 keep separate. |
| `/crm/templates` | CRM | Mẫu tin | MainLayout | CUSTOMER_VIEW | CRM | MIXED | OK | CRM | READ_WRITE | CURRENT | no | PARTIAL. |
| `/crm/campaigns` | CRM | Chiến dịch | MainLayout | CUSTOMER_VIEW | CRM | MIXED | OK | CRM | READ_WRITE | CURRENT | no | PARTIAL. |
| `/crm/history` | CRM | Lịch sử liên hệ | MainLayout | CUSTOMER_VIEW | CRM | MIXED | TABLE | CRM | READ | CURRENT | no | PARTIAL. |
| `/crm/reminders/booking` | CRM | Nhắc đặt sân | MainLayout | BOOKING/CUSTOMER | CRM | MIXED | OK | CRM | READ_WRITE | CURRENT | no | PARTIAL. |
| `/messages` | COMMS | Giao tiếp | MainLayout | Authenticated (`[]` perms) | Giao tiếp — **hidden except `*` roles** | MIXED | 2/3 pane | Messaging gateway | READ_WRITE | CURRENT | vs CRM messages | ROLE_MENU_MAP omits `messaging`. |
| `/notifications` | NOTIFY | Thông báo | MainLayout | Authenticated | Canonical; not V5 group | LEGACY_V2 | OK | Notification inbox | READ_WRITE | CURRENT | vs `/mobile/notifications` | |
| `/ai` | AI | Trợ lý thông minh | MainLayout | Feature `ai` | Trợ lý thông minh | MIXED | OK hub | AI hub | NONE | CURRENT | no | Flag `VITE_ENABLE_AI_ENGINE`. |
| `/support` | SUPPORT | Hỗ trợ | MainLayout | SUPPORT_TICKET_MANAGE or BILLING_VIEW | Hỗ trợ (all roles) | MIXED | OK hub | Hub | NONE | CURRENT | DUPLICATE zones | Menu vs permission mismatch. Guide exposes env flag names. |
| `/support/guide` | SUPPORT | Hướng dẫn | MainLayout | via support | in-page | LEGACY_V2 | OK | Static | NONE | CURRENT | no | Developer terms. |
| `/support/faq` | SUPPORT | FAQ | MainLayout | via support | in-page | LEGACY_V2 | OK | Static | NONE | CURRENT | no | |
| `/settings` | ADMIN | Cài đặt | MainLayout | SETTINGS_VIEW | Quản trị | LEGACY_V2 | OK | Settings | READ_WRITE | CURRENT | Help icon in legacy Header | |
| `/settings/integrations` | ADMIN | Tích hợp | MainLayout | INTEGRATION_VIEW | Tech zone | LEGACY_V2 | OK | Integrations | READ | CURRENT | no | |
| `/settings/integrations/payments` | ADMIN | Thanh toán tích hợp | MainLayout | INTEGRATION_MANAGE | none | LEGACY_V2 | OK | Payments integration | READ_WRITE | CURRENT | no | |
| `/settings/integrations/zalo-oa` | ADMIN | Zalo OA | MainLayout | INTEGRATION_MANAGE | none | LEGACY_V2 | OK | Zalo | READ_WRITE | CURRENT | Brand token OK | |
| `/marketplace` | MARKET | Cửa hàng | MainLayout | MARKETPLACE_VIEW | Canonical; V5 orders only | LEGACY_V2 | OK | Marketplace | READ | CURRENT | no | Feature flag. |
| `/marketplace/orders` | MARKET | Đơn hàng | MainLayout | MARKETPLACE_VIEW | Tài chính | LEGACY_V2 | TABLE | Orders | READ | CURRENT | no | |
| `/marketplace/:productId` | MARKET | Sản phẩm | MainLayout | MARKETPLACE_VIEW | none | LEGACY_V2 | OK | Product | WRITE (order) | CURRENT | no | |
| `/users` | IDENTITY | Người dùng | MainLayout | USER_VIEW/MANAGE | Quản trị | LEGACY_V2 | TABLE | Identity RPC | READ_WRITE | CURRENT | no | |
| `/users/verification` | IDENTITY | Xác minh VĐV | MainLayout | USER_MANAGE | Quản trị | LEGACY_V2 | TABLE | Verification | WRITE | CURRENT | no | |
| `/admin/roles` | IDENTITY | Vai trò & quyền | MainLayout | ROLE_* | Quản trị | LEGACY_V2 | TABLE | RBAC | READ_WRITE | CURRENT | no | |
| `/audit` | IDENTITY | Nhật ký | MainLayout | USER_MANAGE / ACTIVITY_LOG | Tech zone | LEGACY_V2 | TABLE | audit_logs | READ | CURRENT | no | |
| `/admin/tenants` | ADMIN | Tổ chức | MainLayout | TENANT_VIEW | Admin | LEGACY_V2 | TABLE | Tenants | READ_WRITE | CURRENT | no | |
| `/admin/court-clusters` | ADMIN | Cụm sân | MainLayout | CLUSTER_MANAGE | Admin | LEGACY_V2 | OK | Clusters | READ_WRITE | CURRENT | no | |
| `/admin/hours` | ADMIN | Giờ mở cửa | MainLayout | VENUE | Admin / tech | LEGACY_V2 | OK | Hours | READ_WRITE | CURRENT | no | |
| `/admin/skill-level-requests` | ADMIN | Yêu cầu trình độ | MainLayout | PLAYER_VIEW | Tech | LEGACY_V2 | TABLE | Requests | WRITE | CURRENT | no | |
| `/admin/tournament-certifications` | ADMIN | Chứng nhận giải | MainLayout | TOURNAMENT_CERTIFY | Admin | LEGACY_V2 | TABLE | Cert queue | WRITE | CURRENT | no | |
| `/admin/staff` | ADMIN | Nhân sự | MainLayout | USER_VIEW | Admin | LEGACY_V2 | TABLE | Staff | READ_WRITE | CURRENT | no | |
| `/admin/marketplace` | ADMIN | Marketplace admin | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | Marketplace | READ_WRITE | CURRENT | child views | Shows tenantId. |
| `/admin/marketplace/products` | ADMIN | SP marketplace | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same page | READ_WRITE | CURRENT | same component | |
| `/admin/marketplace/orders` | ADMIN | Đơn marketplace | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same page | READ | CURRENT | same | |
| `/admin/integration-logs` | ADMIN | Nhật ký tích hợp | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | Monitoring page | READ | CURRENT | 5 routes one page | IDs visible. |
| `/admin/payment-transactions` | ADMIN | Giao dịch TT | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/api-clients` | ADMIN | API clients | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | EN API OK as brand. |
| `/admin/api-logs` | ADMIN | API logs | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/webhook-events` | ADMIN | Webhook | MainLayout | PLATFORM | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/billing` | ADMIN | Billing admin | MainLayout | BILLING_MANAGE | Canonical | LEGACY_V2 | TABLE | Billing | READ_WRITE | CURRENT | child views | EN Invoices. |
| `/admin/billing/tenants` | ADMIN | Billing tenants | MainLayout | BILLING_MANAGE | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same component | |
| `/admin/billing/plans` | ADMIN | Billing plans | MainLayout | BILLING_PLAN_VIEW | Canonical | LEGACY_V2 | TABLE | same | READ_WRITE | CURRENT | same | |
| `/admin/billing/invoices` | ADMIN | Billing invoices | MainLayout | BILLING_INVOICE_VIEW | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/billing/payments` | ADMIN | Billing payments | MainLayout | BILLING_PAYMENT_VIEW | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/billing/audit` | ADMIN | Billing audit | MainLayout | BILLING_AUDIT_VIEW | Canonical | LEGACY_V2 | TABLE | same | READ | CURRENT | same | |
| `/admin/ai-pairing/private-rules` | ADMIN | Quy tắc ghép cặp | MainLayout | SUPER_ADMIN | Admin | LEGACY_V2 | TABLE | Private rules | READ_WRITE | CURRENT | no | |
| `/internal/hard-cutover/operator-acceptance` | INTERNAL | Operator acceptance | MainLayout | Operator guard | none | UNKNOWN | n/a | Cutover | READ | CURRENT | no | Not a customer screen. |
| `/mobile/check-in` | MOBILE | Check-in | MainLayout | TOURNAMENT_VIEW; exclude PLAYER | Vận hành sân | LEGACY_V2 | MOBILE-FIRST | Check-in | WRITE | CURRENT | no | |
| `/mobile/qr-scan` | MOBILE | Quét QR | MainLayout | TOURNAMENT/MATCH | Referee zone | LEGACY_V2 | MOBILE-FIRST | QR | WRITE | CURRENT | no | |
| `/mobile/qr-generate` | MOBILE | Tạo QR | MainLayout | TOURNAMENT_UPDATE | Canonical | LEGACY_V2 | MOBILE-FIRST | QR | WRITE | CURRENT | no | |
| `/mobile/player` | MOBILE | Trang VĐV mobile | MainLayout | PLAYER | Player zone | LEGACY_V2 | MOBILE-FIRST | Player home | READ | CURRENT | no | |
| `/mobile/operations` | MOBILE | Dashboard vận hành | MainLayout | BOOKING/COURT/FINANCE | Canonical; bottom-nav rewrite | MIXED | MOBILE-FIRST | Ops | READ | CURRENT | no | EN “Dashboard vận hành”. |
| `/mobile/notifications` | MOBILE | Cài đặt thông báo | MainLayout | Authenticated | CRM “Thông báo” (misleading) | LEGACY_V2 | MOBILE-FIRST | Push settings | WRITE | CURRENT | vs `/notifications` | |

---

## Generation roll-up (user-visible route patterns ≈ 197)

| CURRENT_UI_GENERATION | Approx count | Rule |
|----------------------|-------------:|------|
| CANONICAL_CURRENT | 23 | Frozen Tournament Experience (Center + 21 operator + public). Adjacent `/register` counted MIXED. |
| LEGACY_V1 | 48 | Setup/engine/director/hubs/team portals/select-players/court-engine/club ops. |
| LEGACY_V2 | 86 | v5 venue/club/coaching/finance/billing/admin/identity/mobile/public catalog. |
| MIXED | 32 | Shell + old body, dual paths, dashboard, messaging, tournament list/create. |
| UNKNOWN | 8 | Coming-soon, catalog 404s, court future, operator-acceptance, dev preview. |

Exact screen totals (component-level) are in `MASTER_SCREEN_INVENTORY.md`.
