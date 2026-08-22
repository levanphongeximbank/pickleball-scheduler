# 03 — Public Navigation and CTA Matrix

**Phase:** Wave 1 Audit / Plan  
**Shell:** One canonical public shell — `PublicLayout` → `PublicHeader` + `Outlet` + `PublicFooter`  
**Mobile:** Drawer inside `PublicHeader` (same `NAV_ITEMS`) — no separate public bottom nav  
**#23 chrome:** Separate mini header inside `IndividualPublicExperiencePage` (not PublicHeader) — keep for freeze

Duplicate public nav components: **none** found beyond unused `EcosystemCard` / latent `ECOSYSTEM_ITEMS`.

---

## Nav item matrix

| Item | Current target | Correct target | Change required? | Evidence |
|------|----------------|----------------|------------------|----------|
| Logo / PICK_VN | `/home` | `/home` (or `/`) | No | `PublicHeader.jsx` |
| Trang chủ | `/home` | `/home` | No | `NAV_ITEMS` |
| Giải đấu | `/tournaments` | `/public/tournaments` | **YES** | `NAV_ITEMS` L35 |
| CLB | `/clubs` | `/clubs` | No | |
| Sân | `/courts` | `/courts` | No (Wave 5 semantics) | |
| BXH | `/rankings` | `/rankings` | No | |
| Tin tức | `/news` | `/news` | No | |
| Đăng nhập | `/login` | `/login` | No | |
| Đăng ký miễn phí | `/login` (signin default) | `/login` keep | **No for Wave 1** | Label implies signup; mode not URL-driven — defer Wave 8 |
| Mobile drawer items | Same as `NAV_ITEMS` | Same fixes | **YES** (inherits Giải đấu) | |
| Footer “Ban tổ chức giải” | `/tournaments` | `/public/tournaments` **or** `/login` | **YES** | Prefer discovery; organizer onboarding = `/login` if Owner prefers |
| Footer other columns | `/home`, `/news`, `/login`, `/clubs`, `/courts`, `/rankings` | Keep | No | Placeholder legal→`/news` defer |
| Home “Xem tất cả” tournaments | `/public/tournaments` | Keep | No | `HomePage` section header |
| Home TournamentCard CTA | `/tournaments/:id` | `/tournament/:id/public` | **YES** | via card |
| Discovery TournamentCard CTA | `/tournaments/:id` | `/tournament/:id/public` | **YES** | via card |
| Hero primary CTA | `/login` | Keep | No | `HeroSection` |
| Hero secondary | `/courts` | Keep | No | |
| Authed header “Tạo giải” | `/tournament/create` | Keep (auth) | No | |

---

## Tournament link classification (all occurrences)

| Location | Current | Classification |
|----------|---------|----------------|
| PublicHeader Giải đấu | `/tournaments` | **REPOINT_TO_PUBLIC_DISCOVERY** |
| PublicFooter Ban tổ chức giải | `/tournaments` | **REPOINT_TO_PUBLIC_DISCOVERY** (Owner may choose `/login`) |
| TournamentCard detail | `/tournaments/:id` | **REPOINT_TO_CANONICAL_PUBLIC_DETAIL** |
| TournamentCard missing id | `/tournaments` | **REPOINT_TO_PUBLIC_DISCOVERY** |
| Home section “Xem tất cả” | `/public/tournaments` | **KEEP** |
| Router `/public/tournaments` | catalog | **KEEP** |
| Router `/tournament/:id/public` | #23 | **KEEP** |
| Router `/tournaments` MainLayout | hub | **AUTHENTICATED_ONLY_KEEP** |
| Router `/tournaments/:id/*` | engine | **AUTHENTICATED_ONLY_KEEP** |
| Optional anon hit `/tournaments` | — | **REDIRECT_REQUIRED** (optional) → `/public/tournaments` |
| `ECOSYSTEM_ITEMS` paths | `/tournaments?type=` | **REMOVE_LEGACY** or repoint if re-enabled |
| `EcosystemCard` | unused | **REMOVE_LEGACY** (defer delete) |
| Organizer `individualPublicTournamentPath` | `/tournament/:id/public` | **AUTHENTICATED_ONLY_KEEP** (already correct outbound) |
| MyTournamentsHub local TournamentCard | `item.href` | **AUTHENTICATED_ONLY_KEEP** (different component) |
| Registry stale `/tournaments` as public | metadata | Fix in Wave 1A docs/registry only if touched |

---

## TournamentCard deep audit

| Question | Answer |
|----------|--------|
| Variants | **1** public export: `src/components/public/cards/TournamentCard.jsx` |
| Auth variant | Separate local card in `MyTournamentsHubPage.jsx` — **do not change** for guests |
| Usages | `HomePage`, `TournamentsPage` |
| Link construction | `tournament.id ? `/tournaments/${id}` : `/tournaments`` |
| Proposed | `tournament.id ? individualPublicTournamentPath(id) : '/public/tournaments'` |

### ID semantics

| Source | `id` meaning |
|--------|----------------|
| Catalog DTO | `public_catalog_tournaments.id` text PK (opaque; may be synthetic) |
| Live local blob | `t.id` or invented `` `${club.id}-${t.name}` `` |
| Mock | `"t1"`, `"t2"`, … |

```text
TOURNAMENT_CARD_ID_SEMANTICS=OPAQUE_PORTAL_CARD_ID_FROM_SOURCE
PUBLIC_DETAIL_ID_COMPATIBLE=PARTIAL
```

**Plan rule:** Wave 1A may rewire URL shape. If id cannot resolve on #23, show honest not-found (fail closed). Do not invent crosswalk without SQL/projection contract (1B).

---

## Registration route decision

```text
REGISTER_ROUTE_DECISION=KEEP_EXISTING_SIGNUP_MODE
```

| Option | Chosen? |
|--------|---------|
| KEEP_EXISTING_SIGNUP_MODE | **YES** (Wave 1) |
| ADD_ALIAS_LATER | Optional later |
| ADD_ROUTE_IN_WAVE_8 | Preferred if dedicated `/register` wanted |
| BROKEN_AND_MUST_FIX_WAVE_1 | **NO** — `/login` works; label mismatch is Wave 8 polish |

Header “Đăng ký miễn phí” → `/login` without auto signup mode: **not a routing integrity blocker** for tournaments.

---

## Legacy public tournament page

`src/pages/tournament/IndividualTournamentPublicPage.jsx`

| Check | Result |
|-------|--------|
| Mounted in router | No |
| Imports | Only self + stale registry string |
| Live replacement | `IndividualPublicExperiencePage` |

```text
LEGACY_PUBLIC_TOURNAMENT_PAGE_CLASSIFICATION=DEAD_CODE_SAFE_TO_REMOVE
```

Wave 1 recommendation: **LEGACY_REFERENCE_KEEP_TEMPORARILY** (do not delete in Wave 1A unless Owner wants cleanup PR); fix registry note if editing registry anyway.

---

## Machine flags

```text
PUBLIC_HEADER_CHANGE_REQUIRED=YES
PUBLIC_MOBILE_NAV_CHANGE_REQUIRED=YES
TOURNAMENT_CARD_CHANGE_REQUIRED=YES
```
