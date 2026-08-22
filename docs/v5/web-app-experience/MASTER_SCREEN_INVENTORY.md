# MASTER_SCREEN_INVENTORY

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Base:** `e023e0d7521dee052420454a3182a3cfca9d9ded`

## Totals

```
TOTAL_ROUTES=203
TOTAL_USER_VISIBLE_SCREENS=186
CANONICAL_CURRENT_SCREENS=23
TOTAL_CANONICAL_SCREENS=23
LEGACY_SCREENS=118
TOTAL_LEGACY_SCREENS=118
MIXED_SCREENS=32
TOTAL_MIXED_SCREENS=32
TOTAL_UNKNOWN_SCREENS=13
```

**How counted**

- **User-visible screens** = unique page experiences a person can land on, excluding 5 redirects, `/mobile` layout parent, `/dev/pairing-intervention-preview`, `/internal/hard-cutover/operator-acceptance`. Admin/billing **view** routes that share one component but change title/tab are counted as **one screen per distinct user task** (billing 6 views = 6; admin monitoring 5 routes = 1 screen with tabs).
- **Canonical** = frozen Tournament Experience 23-screen Production Cutover only.
- **Legacy** = LEGACY_V1 + LEGACY_V2 page bodies (not Experience visual language).
- **Mixed** = hybrid chrome/body or dual-path.
- **Unknown** = placeholders / 404 stubs / incomplete.

**Matches Experience visual language?** Only the 23 canonical screens (and their in-page nav). All other modules use Slate green, Figure 1 shell chrome, and/or ad-hoc MUI.

Default **App Shell** for authenticated screens: `MainLayout` → `CanonicalAppShell` when Production flag ON (evidence 2026-08-07 on pickvn.app); else `LegacyMainLayoutContent`.

---

## 1. App shell chrome (not screens)

| Surface | Component | Desktop | Tablet | Mobile | Notes |
|---------|-----------|---------|--------|--------|-------|
| Canonical shell | `CanonicalAppShell.jsx` | Sidebar 260/64 + topbar 56 | Drawer | Drawer + `MobileBottomNav` | Canonical candidate. No Help control. |
| Legacy shell | `Sidebar.jsx` + `Header.jsx` | Sidebar 240 + header 64 | Header + `AppContextBar` | Drawer + bottom nav | Rollback path. Help → `/settings`. |
| Public chrome | `PublicLayout` + `PublicHeader` | Top nav | Collapse | Drawer | Separate on purpose. |

---

## 2. Auth / account

| Screen | Route | Component | Shell | Desktop | Tablet | Mobile | Key actions | Empty/loading/error | Role | Data | Writer | Matches Experience? |
|--------|-------|-----------|-------|---------|--------|--------|-------------|---------------------|------|------|--------|---------------------|
| Login / signup | `/login` | `LoginPage` | none | Centered card | Same | Stack | Login, signup, dev picker | Alert errors | Public | Auth | Auth session | No |
| Forgot password | `/forgot-password` | `ForgotPasswordPage` | none | Card | Same | Same | Submit email | Alert | Public | Auth | Password RPC | No |
| Reset password | `/reset-password` | `ResetPasswordPage` | none | Card | Same | Same | Set password | Alert | Token | Auth | Password | No |
| Force change password | `/change-password` | `ForceChangePasswordPage` | none | Card | Same | Same | Change | Alert | Must-change | Auth | Password | No |
| 403 | `/403` | `ForbiddenPage` | none | Message | Same | Same | Go home | n/a | Auth | none | none | No |
| My profile | `/profile` | `SelfProfilePage` | MainLayout | Form | Same | Stack | Save profile | Alert | Non-PLAYER menu | profiles | Identity | No |
| Athlete self profile | `/player/profile` | `AthleteSelfProfilePage` | MainLayout | Form | Same | Stack | Save | Alert | PLAYER | Athlete | Identity | No |

---

## 3. Public

| Screen | Route | Component | Shell | Desktop | Tablet | Mobile | Key actions | Empty/loading/error | Matches Experience? |
|--------|-------|-----------|-------|---------|--------|--------|-------------|---------------------|---------------------|
| Public root | `/` | `PublicRootPage` | PublicLayout | Multi-section | Collapse | Stack | Browse | `PublicPresentationStates` | No (public language) |
| Home | `/home` | `HomePage` | PublicLayout | Same | Same | Same | Browse | Public states | No |
| Public tournaments | `/public/tournaments` | `TournamentsPage` | PublicLayout | Grid | 2-col | 1-col | Open public tournament | Public states | Partial if deep-link to Experience public |
| Public clubs/courts/rankings/news | `/clubs` `/courts` `/rankings` `/news` | matching pages | PublicLayout | Grid/table | Collapse | Stack | Browse | Public 404 pages | No |
| Catalog not found | `/clubs/:id` `/courts/:id` | `PublicCatalogNotFoundPage` | PublicLayout | Message | Same | Same | Back | n/a | No |

---

## 4. Tổng quan

| Screen | Route | Component | Desktop | Tablet | Mobile | Key actions | Empty/loading/error | Role | Data | Writer | Matches Experience? |
|--------|-------|-----------|---------|--------|--------|-------------|---------------------|------|------|--------|---------------------|
| Dashboard | `/dashboard` | `Dashboard` | 3–4 col | 2 col | Stack | Jump to modules | `DashboardEmptyState`; Alert loading | Ops roles | Analytics hook | none | No |
| VPR admin | `/dashboard/rankings` | `RankingManagementPage` | Table | Scroll | Scroll | Certify/manage | Alert | Ranking perms | Ranking | Ranking writer | No |
| Statistics | `/statistics` | `features/statistics` | Tables | Scroll | Scroll | Filter season | Empty copy | STATISTICS_VIEW | Season/Elo | none | No |
| Reports hub | `/reports` | `ReportsHubPage` | Hub cards | Stack | Stack | Open in-page | Honest PARTIAL | Stats/Finance | Hub | none | No |

---

## 5. Vận hành sân

| Screen | Route | Component | Desktop | Tablet | Mobile | Key actions | Empty/loading/error | Role | Data | Writer | Matches Experience? |
|--------|-------|-----------|---------|--------|--------|-------------|---------------------|------|------|--------|---------------------|
| Court home | `/court-management` | `CourtManagementHome` | Tabs | Tabs | Tabs+scroll | Navigate tabs | Alert | COURT_VIEW | Court ops | none | No |
| Calendar | `.../calendar` | `CourtManagementCalendarPage` | Week matrix | **minWidth 900 overflow** | Horizontal scroll | Book/move | Sparse skeleton | BOOKING_VIEW | Calendar | Booking writer | No |
| Calendar preview | `.../calendar/preview` | `CourtCalendarPreviewPage` | Matrix | Overflow | Overflow | Preview | Alert | BOOKING_VIEW | Calendar | none | No |
| Bookings | `.../bookings` | `CourtManagementBookingsPage` | Table | Scroll | Scroll | CRUD booking | Empty row | BOOKING_VIEW | Bookings | Booking writer | No |
| Revenue | `.../revenue` | `CourtManagementRevenuePage` | Table | Scroll | Scroll | Filter | Empty | FINANCE_VIEW | Revenue | none | No |
| Customers / members / groups | `.../customers` `members` `customer-groups` | matching pages | Table | Scroll | Scroll | CRUD | Empty | CUSTOMER_VIEW | CRM-ish | Customer writer | No |
| Courts | `.../courts` | `CourtManagementCourtsPage` | Cards/table | Stack | Stack | CRUD courts | Empty | COURT_VIEW | Courts | Court writer | No |
| Ops log | `.../ops-log` | `CourtOpsLogPage` | Table | Scroll | Scroll | Filter | Empty | COURT_VIEW | Log | none | No |
| Future | `.../future` | `CourtManagementFuturePage` | Placeholder | Same | Same | none | n/a | COURT_UPDATE | none | none | No |
| Waiting list | `/select-players` | `SelectPlayers` | Dense lists | Cramped | Hard | Tick players, run pairing | Engine empty | SCHEDULING_VIEW | Club blob | Pairing engine | No |
| Court engine | `/court-engine` | `CourtEnginePage` | Dense | Cramped | Icon-only | Dispatch courts | Alert | DIRECTOR/SCHEDULING | Engine | Engine | No |

---

## 6. Khách hàng & VĐV / CLB / Coaching

| Screen | Route | Component | Desktop | Tablet | Mobile | Key actions | Empty/loading/error | Role | Data | Writer | Matches Experience? |
|--------|-------|-----------|---------|--------|--------|-------------|---------------------|------|------|--------|---------------------|
| Players | `/players` | `Players` | Card grid | 2-col | 1-col | Add/edit, open profile | Alert stack | PLAYER_VIEW | Club players | Player writer | No |
| Skill levels | `/players/skill` | `SkillLevelsPage` | Table | Scroll | Scroll | Edit levels | Empty | PLAYER_VIEW | Skill | Skill writer | No |
| Player profile | `/players/profile/:id` | `PlayerProfile` | Header+tabs | Stack | Stack | History | Empty history | PLAYER_VIEW | History engine | none | No |
| Directory | `/athletes` | `PublicPlayerDirectoryPage` | List | Stack | Stack | Search | Empty | Authenticated | Directory | none | No |
| Club ops | `/club` | `ClubManagement` | Legacy panels | Cramped | Hard | Season/league | Mixed | CLUB_VIEW | Club blob v3 | Club blob | No |
| Club list/detail | `/manage/clubs` `/:clubId` | `ClubListPage` `ClubDetailPage` | `ClubPageShell` | Stack | Stack | Create, open | `ClubEmptyState` | CLUB_VIEW | Registry | Club registry | Partial (own tokens) |
| Platform clubs | `/platform/clubs` | `PlatformClubsPage` | Table | Scroll | Scroll | Admin clubs | Empty | PLATFORM_ADMIN | Platform | Platform writer | No |
| My club / discover / requests | `/my-club*` `/discover-clubs` | matching | Cards | Stack | Stack | Join, schedule | Empty | Authenticated | Membership | Membership | Partial |
| Coaching suite (8 screens) | `/coaching/*` | coaching pages | Tables/cards | Scroll | Scroll | CRUD class/package/attendance | Feature empty | Club group (over-broad for COACH/REFEREE) | Coaching | Coaching writers | No |
| Daily play launcher | `/daily-play` | `DailyPlayLauncher` | Cards | Stack | Stack | Start session | Empty | TOURNAMENT_VIEW | Daily | Daily writer | No |

---

## 7. Giải đấu — CANONICAL 23 (frozen)

Shared operator shell: MainLayout + `TournamentExperienceWorkspace` / `ExperienceBatchBFrame` / `ExperienceDrawRoomShell`.  
Desktop: header + optional 300px rail. Tablet: rail stacks. Mobile: primary CTA full-width; some secondary hidden.

| # | Screen | Route | Component | Key actions | Empty/loading/error | Role (intended) | Data | Writer | Matches Experience? |
|---|--------|-------|-----------|-------------|---------------------|-----------------|------|--------|---------------------|
| Hub | Trung tâm | `/tournament` | `TournamentCenterExperiencePage` | Open/create | Center empty | Organizer | List | none | **Yes** |
| 1 | Tổng quan | `.../overview` | `IndividualOverviewPage` | Continue workflow | Alert “Đang tải…” (no skeleton) | Organizer | Canonical read | none | **Yes** |
| 2 | Cài đặt | `.../settings` | `IndividualSettingsPage` | Save settings | Frame states | Organizer | Settings | Settings adapter | **Yes** |
| 3 | Đăng ký/công bố | `.../registration` | `IndividualRegistrationPublicationPage` | Publish | Frame | Organizer | Registration | Registration adapter | **Yes** |
| 4 | VĐV | `.../participants` | `IndividualParticipantsPage` | Add/remove | Frame | Organizer | Participants | Participant adapter | **Yes** |
| 5 | Cặp | `.../pairs` | `IndividualPairFormationPage` | Form pairs | Frame | Organizer | Pairs | Pairing authority | **Yes** |
| 6 | Bốc thăm cặp | `.../pair-draw` | `IndividualPairDrawRoomPage` | Draw | Draw empty | Organizer | Draw | Draw runtime | **Yes** |
| 7 | Bốc thăm bảng | `.../group-draw` | `IndividualGroupDrawRoomPage` | Draw | Draw empty | Organizer | Draw | Draw runtime | **Yes** |
| 8 | Bảng | `.../groups` | `IndividualGroupStagePage` | Manage groups | Frame | Organizer | Groups | Group adapter | **Yes** |
| 9 | Lịch | `.../schedule` | `IndividualSchedulePage` | Build schedule | Frame | Organizer | Schedule | Schedule adapter | **Yes** |
| 10 | Trận | `.../matches` | `IndividualMatchCenterPage` | Open match | Frame | Organizer | Matches | Match adapter | **Yes** |
| 11 | BXH | `.../standings` | `IndividualStandingsPage` | View | Frame | Organizer | Standings | none | **Yes** |
| 12 | Knockout | `.../knockout` | `IndividualKnockoutPage` | Advance | Frame | Organizer | Knockout | Knockout adapter | **Yes** |
| 13 | Nhánh | `.../bracket` | `IndividualBracketPage` | View bracket | Frame | Organizer | Bracket | none | **Yes** |
| 14 | Điều hành | `.../director` | `IndividualDirectorOpsPage` | Ops actions | Frame | Organizer | Director ops | Parallel to Director Mode | **Yes** |
| 15 | Sân | `.../courts` | `IndividualCourtBoardPage` | Assign courts | Frame | Organizer | Courts | Court adapter | **Yes** |
| 16 | Trọng tài | `.../referees` | `IndividualRefereeBoardPage` | Assign | Frame | Organizer | Referees | Referee adapter | **Yes** |
| 17 | Ngoại lệ | `.../exceptions` | `IndividualExceptionCenterPage` | Resolve | Frame | Organizer | Exceptions | Exception adapter | **Yes** |
| 18 | Truyền thông | `.../communications` | `IndividualCommunicationsPage` | Send | Frame | Organizer | Comms | Comms adapter | **Yes** |
| 19 | Media | `.../media` | `IndividualMediaPresentationPage` | Present | Frame | Organizer | Media | none | **Yes** |
| 20 | Giải thưởng | `.../awards` | `IndividualAwardsExperiencePage` | Award | Frame | Organizer | Awards | Awards adapter | **Yes** |
| 21 | Kết thúc | `.../complete` | `IndividualCompleteTournamentPage` | Complete | Frame | Organizer | Complete | Complete adapter | **Yes** |
| 22 | Public | `.../public` | `IndividualPublicExperiencePage` | Browse | Public empty | Public | Public read | none | **Yes** |

**Role restriction gap:** router/auth currently allows any authenticated user with `TOURNAMENT_VIEW` (prefix `/tournament/`). PLAYER can open organizer screens by URL.

---

## 8. Giải đấu — legacy / team / engine / referee (do not delete)

See `LEGACY_UI_INVENTORY.md` for classification.

High-traffic legacy screens: `TournamentListPage`, `TournamentCreatePage`, hubs (`TournamentNavHubPages` / `TournamentHubPages`), `InternalTournamentSetup`, `OfficialTournamentSetup`, `TeamTournamentSetup`, `DailyPlaySetup`, `TournamentDirectorMode`, `TournamentEnginePage` (7 tabs), `TournamentDashboardPage`, `TeamPortal`, `TeamRefereePortal`, `RefereeHub`, `RefereeScoreboard`.

Desktop: usable. Tablet/mobile: tables and director/engine dense; icon-only list actions.

Writers: existing tournament/domain runtimes — **must be preserved**. UI may later adapt into Experience, not be rewritten as new authorities.

---

## 9. Tài chính / CRM / Giao tiếp / AI / Hỗ trợ

| Screen | Route | Component | Desktop | Mobile | Key actions | Empty/loading/error | Matches Experience? |
|--------|-------|-----------|---------|--------|-------------|---------------------|---------------------|
| Billing views | `/billing*` | `BillingPage` | Cards/tables | Stack | Pay, upgrade | `BillingStateViews`; EN copy | No |
| Finance debt/receipts/refunds | `/finance/*` | finance-ledger pages | Tables | Scroll | Record | `FinanceLedgerStateViews` | No |
| CRM suite | `/crm/*` | CRM pages | Lists | Stack | Send/campaign | Honest PARTIAL | No |
| Messaging | `/messages` | `MessagingExperiencePage` + `MessagingShell` | 2/3 pane | Stack | Chat | `MessagingStateViews` | Partial (own shell) |
| Notifications | `/notifications` | `NotificationCenterPage` | List | Stack | Mark read | Empty inbox | No |
| AI hub | `/ai` | `AiHubPage` | Hub | Stack | Open tools | Flag off → empty/hidden | No |
| Support hub/guide/faq | `/support*` | Support pages | Hub/article | Stack | Read | Static | No |

---

## 10. Quản trị / Marketplace / Mobile

| Screen | Route | Component | Desktop | Mobile | Key actions | Role | Matches Experience? |
|--------|-------|-----------|---------|--------|-------------|------|---------------------|
| Users / roles / audit / tenants / clusters / hours / staff / certs / skill requests | `/users*` `/admin/*` `/audit` | admin pages | Tables | Scroll | CRUD | Admin/tech | No |
| Integration monitoring (5 routes) | `/admin/integration-logs` etc. | `AdminIntegrationMonitoringPage` | Tabs+table | Scroll | Inspect IDs | Platform | No |
| Admin billing (6 views) | `/admin/billing*` | `AdminBillingPage` | Tabs | Scroll | Manage | BILLING_MANAGE | No |
| Marketplace store/orders/product | `/marketplace*` | marketplace pages | Grid | Stack | Buy/order | MARKETPLACE_VIEW | No |
| Mobile check-in / QR / player / ops / notif settings | `/mobile/*` | mobile pages | Also in desktop shell | Native-sized | Scan/check-in | Mobile ACL | No |

---

## Visual language match

| Bucket | Screens | Match Experience language |
|--------|--------:|---------------------------|
| Tournament Experience 23 | 23 | Yes — frozen |
| All other user-visible | 163 | No (Slate / Figure 1 chrome / ad-hoc) |

Unifying the rest of the Web App to Experience language is **Wave 2–7 work**, not a Tournament Experience rewrite.
