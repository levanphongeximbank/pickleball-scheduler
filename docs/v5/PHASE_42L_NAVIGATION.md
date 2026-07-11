# Phase 42L — Role-Based Club Navigation

**Status:** Implementation complete — **await GO DEPLOY 42L**  
**Blueprint:** `PHASE_42X_CLUB_UX_BLUEPRINT.md` §6, §805–817  
**Depends on:** Phase 42K registry read model (CLOSED)

---

## Summary

Phase 42L enforces the **role × membership** menu matrix on desktop sidebar, mobile drawer, and global search — without schema/RPC/registry changes.

| Area | Change |
|------|--------|
| SSOT | `src/features/club/navigation/clubNavMatrix.js` |
| Menu scope hook | `useClubMenuScope()` — shared desktop + mobile |
| SA tenant picker | Desktop header `TenantSwitcher` — hydrates `public.venues` from Supabase; no auto-pick |
| Review guard | SA without governance assignment cannot review membership |
| Label | `Lịch sinh hoạt` → **Vận hành CLB** (`/club`) for governance/staff |

---

## Audit — menu before 42L

| Issue | Before |
|-------|--------|
| Membership state | Menu filtered by RBAC role only; `clubNav` ignored membership RPC |
| Discover | Hard-coded `roles: [PLAYER, CUSTOMER]` |
| President items | Partial via `excludeRoles` bypass only |
| SA review | Global role + `ALL_PERMISSIONS` could show review UI |
| SA tenant | Mobile-only switcher; desktop Select defaulted to `tenants[0]` display |
| Mobile parity | `resolveScope()` dropped `clubNav` from menu scope |
| Missing leaves | No sidebar **Tạo CLB**, **Yêu cầu gia nhập**, **Quản trị CLB**, **Tất cả CLB** |

---

## Menu matrix — after 42L

| Menu key | Label | PLAYER no club | PLAYER member | President/Owner/VP | Tenant staff | SA no member | SA + member |
|----------|-------|----------------|---------------|-------------------|--------------|--------------|-------------|
| `discover-clubs` | Khám phá CLB | ● | ● | ● | ○ | ○ | ○ |
| `club-create` | Tạo CLB | ●* | ○ | ○ | ●* | ●* | ○ |
| `my-club` | CLB của tôi | ○ | ● | ● | ● | ○ | ● |
| `club-membership-requests` | Yêu cầu gia nhập | ○ | ○ | ● | ●*** | ○ | ●*** |
| `club-governance-manage` | Quản trị CLB | ○ | ○ | ● | ● | ○ | ● |
| `club-activity` | Vận hành CLB | ○ | ○ | ● | ● | ○ | ○ |
| `club-list` | Quản lý CLB | ○ | ○ | ○ | ● | ● | ● |
| `club-platform-all` | Tất cả CLB | ○ | ○ | ○ | ○ | ● | ● |
| `club-daily-play` | Vui chơi mỗi ngày | ○ | ○ | ● | ● | ○ | ○ |

\* `club.create` permission  
\*** governance assignment or scoped `club.membership.review`

---

## File diff (primary)

| File | Change |
|------|--------|
| `src/features/club/navigation/clubNavMatrix.js` | **New** — matrix + `buildClubNavContext` |
| `src/features/club/navigation/useClubMenuScope.js` | **New** — shared scope for nav |
| `src/features/club/hooks/useCanReviewMembership.js` | **New** — hook + re-export |
| `src/config/v5Menu/clubCoachingMenu.js` | New leaves + rename Vận hành CLB |
| `src/auth/menuAccess.js` | `clubNav` override in `isMenuItemVisible` |
| `src/components/Header.jsx` | Desktop SA `TenantSwitcher` |
| `src/components/Sidebar.jsx` | `useClubMenuScope` |
| `src/features/mobile/layout/MobileDrawer.jsx` | `useClubMenuScope` |
| `src/features/mobile/services/mobileNavAccess.js` | Preserve `clubNav` in scope |
| `src/components/GlobalSearch.jsx` | `useClubMenuScope` |
| `src/components/nav/navPathMatchers.js` | `/my-club/requests` matcher |
| `src/features/club/services/clubGovernanceService.js` | SA review guard + `canReviewMembershipForClub` |
| `src/features/tenant/services/profileVenueService.js` | `hydrateSupabaseVenuesToLocalRegistry` — cloud → local mirror for SA picker |
| `src/context/TenantContext.jsx` | Hydrate venues on SA/platform login; bump `revision` |
| `src/components/TenantSwitcher.jsx` | Empty until explicit pick; re-render after hydrate |
| `tests/phase42l-navigation-matrix.test.js` | **New** — 7 personas + parity |
| `tests/phase42l-tenant-hydrate.test.js` | **New** — cloud hydrate, empty state, A→B→A cache, scope guard |

---

## Tests

```bash
node --test tests/phase42l-navigation-matrix.test.js
node --test tests/phase42l-tenant-hydrate.test.js
npm run test:unit   # includes phase42l + rbac + club-governance
npm run build
```

Coverage:

- PLAYER no membership / active member  
- President / Owner governance leaves  
- Tenant owner manage list  
- Super Admin no membership / with membership  
- SA cannot review without governance  
- Desktop vs mobile `isMenuItemVisible` parity  
- **Cloud tenant hydrate** (`venue-staging-a`, `venue-staging-b`)  
- **No auto-pick** — empty “Chọn tenant…” until explicit selection  
- **A→B→A** registry cache isolation (no leak / stale / duplicate)  
- **Scope guard** — venue owner blocked from other tenant  

---

## Preview QA checklist (before Production)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1 | PLAYER no membership | Login player without club | Khám phá CLB + Tạo CLB (if permitted); no CLB của tôi |
| 2 | PLAYER member | Active member | CLB của tôi + Khám phá CLB |
| 3 | President | Active + president | + Yêu cầu gia nhập, Quản trị CLB, Vận hành CLB |
| 4 | Tenant owner | `/manage/clubs` | Quản lý CLB visible |
| 5 | SA no membership | Clear tenant pick | Tất cả CLB + Quản lý CLB; no CLB của tôi; no review |
| 6 | SA + membership | SA with active club | CLB của tôi + platform items |
| 7 | SA tenant switch desktop | Header picker A→B | `/manage/clubs` registry refreshes tenant scope |
| 8 | Mobile drawer | Same accounts | Same menu keys as desktop |
| 9 | Unauthorized | Player → `/platform/clubs` | 403 / route guard |
| 10 | No page errors | Reload manage + my-club | Console clean |

**Do not deploy Production until Preview QA PASS.**

---

## Rollback

1. Redeploy previous Vercel deployment (UI-only; no DB migration).  
2. No Supabase SQL rollback required.  
3. Git revert commit implementing 42L if hotfix needed.

---

## Stop line

**Phase 42L — await `GO DEPLOY 42L` after Preview QA PASS.**  
Phase 42M (Professional UI) not started.
