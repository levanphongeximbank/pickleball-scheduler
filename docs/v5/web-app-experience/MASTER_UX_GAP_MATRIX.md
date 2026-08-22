# MASTER_UX_GAP_MATRIX

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Base SHA:** `e023e0d7521dee052420454a3182a3cfca9d9ded`

## Language / terminology (spot)

```
ENGLISH_USER_FACING_COUNT=48
DEVELOPER_TERMS_VISIBLE_COUNT=18
TERMINOLOGY_CONFLICTS=6
```

High-signal English leftovers: Billing router titles Usage / Invoices / Payment / Support; Admin Invoices; Tournament Engine; Early-bird / Seed # / Whitelist / Buffer / Entry ID; Locked/Unlocked chips; “Dashboard vận hành”.

Developer terms visible: “không phải authority”; “rulesVersion canonical”; billing “Trial RPC… staging…”; tables showing `tenantId` / `matchId`; tooltip “Engine 4.0”; Support guide `VITE_ENABLE_AI_ENGINE`.

Conflicts: Tổng quan vs Dashboard; Bảng điều khiển vs Portal vs Director; Usage vs tài chính Việt; Engine 4.0 vs Experience workspace; Locked vs Nháp.

---

## Accessibility spot

**ACCESSIBILITY_CRITICAL**

1. ~35 of ~60 `IconButton`s without `aria-label` (TournamentListTable Engine/Portal, CourtEngine, coaching rows, TeamRefereePortal, MyClubWeeklySchedule).  
2. Billing error copy can surface RPC / staging / docs paths.

**ACCESSIBILITY_MAJOR**

1. `size="small"` IconButtons — touch &lt;40px vs Figure 1 44px.  
2. Dense tables without consistent mobile card alternative.  
3. Muted greys `#64748B` / `#8B9CB3` on navy shell — contrast risk.

**ACCESSIBILITY_MINOR**

1. Mixed EN chips for VN screen readers.  
2. Modal focus mostly MUI default (OK).  
3. Login fields generally labeled (good).  
4. Canonical menu button has `aria-label="Mở menu điều hướng"` (good).

```
ACCESSIBILITY_CRITICAL_GAPS=2
```

---

## Performance / UX quality (observation)

HIGH_IMPACT_UX_PERFORMANCE_GAPS:

1. Sparse skeletons (~16); Experience overview uses Alert “Đang tải…” → flicker.  
2. Banner/alert stacks (subscription + offline + PWA + page alerts) → layout shift.  
3. Club/tenant selector can leave tournament Experience on stale club (overview warns to pick club).  
4. Dual search indexes / dual menus → extra work when Canonical ON.  
5. Court calendar large minWidth matrices — paint/scroll cost.  
6. Lazy routes (~175) are good; Suspense fallback is a lone CircularProgress (no shared skeleton).

---

## Gap register

Every item: **P0_SECURITY_OR_AUTH | P1_BROKEN_CORE_UX | P2_CANONICAL_CONVERGENCE | P3_VISUAL_CONSISTENCY | P4_POLISH**  
Ownership: APP_SHELL | NAVIGATION | MODULE_UI | DOMAIN | BACKEND | AUTH | DESIGN_SYSTEM | RESPONSIVE | PUBLIC

### P0_SECURITY_OR_AUTH

**P0 (security/authorization gap — record only; do not fix in this audit baseline):**  
Organizer Experience routes under `/tournament/:id/*` are currently protected too broadly by `TOURNAMENT_VIEW`.  
A PLAYER with direct URL knowledge may reach organizer surfaces.

| ID | Issue | Owner |
|----|-------|-------|
| P0-01 | Organizer Experience routes (`/tournament/:id/{overview,settings,…}`) inherit only `TOURNAMENT_VIEW` via `/tournament/` prefix. PLAYER and other view-only roles can open organizer screens by URL. Frozen UI is exposed beyond intended organizer roles. | AUTH |

```
P0_GAPS=1
```

### P1_BROKEN_CORE_UX

| ID | Issue | Owner |
|----|-------|-------|
| P1-01 | `messaging` not in `ROLE_MENU_MAP` — Giao tiếp hidden except platform admin | NAVIGATION |
| P1-02 | `/support` in every role menu but route needs SUPPORT_TICKET_MANAGE or BILLING_VIEW → 403 | AUTH |
| P1-03 | CASHIER menu includes rankings / waiting list / court-engine → likely 403 | NAVIGATION |
| P1-04 | Team captain `resolvePath` null without `tournamentId` | MODULE_UI |
| P1-05 | Post-create and hub resolvers still land on legacy setup/director/engine, not Experience `/overview` | NAVIGATION |
| P1-06 | Dual menus: Production Canonical shell vs V5 `MENU_GROUPS` tell different IA | APP_SHELL |
| P1-07 | Club deep-link still `/tournament/internal/:id` | MODULE_UI |
| P1-08 | Billing/RPC staging copy in operator errors | AUTH |
| P1-09 | Court calendar horizontal overflow ≤1024 (high-traffic) | RESPONSIVE |

```
P1_GAPS=9
```

### P2_CANONICAL_CONVERGENCE

| ID | Issue | Owner |
|----|-------|-------|
| P2-01 | V5 Giải đấu sidebar is legacy hubs, not 23 screens | NAVIGATION |
| P2-02 | `canonicalRouteCatalog` stale (179 routes; Experience family missing; public marked LEGACY) | NAVIGATION |
| P2-03 | `/manage/clubs` triple entry; dual HLV labels | NAVIGATION |
| P2-04 | `/club` vs `/manage/clubs` vs `/my-club` | MODULE_UI |
| P2-05 | `/coaching/coaches` vs `/coach-list` | MODULE_UI |
| P2-06 | CRM “Thông báo” → `/mobile/notifications` | NAVIGATION |
| P2-07 | Experience `/director` vs Director Mode runtime (adapter, not rewrite) | DOMAIN |
| P2-08 | Team / Daily Play have no Experience family | DOMAIN |
| P2-09 | Help missing on CanonicalTopBar; legacy Help → Settings | APP_SHELL |
| P2-10 | Two search indexes | APP_SHELL |
| P2-11 | `/tournaments` catalogued as public portal (wrong) | NAVIGATION |

```
P2_GAPS=11
```

### P3_VISUAL_CONSISTENCY

| ID | Issue | Owner |
|----|-------|-------|
| P3-01 | Three primaries (Slate green / Figure 1 blue / Experience blue) | DESIGN_SYSTEM |
| P3-02 | DM Sans vs Inter | DESIGN_SYSTEM |
| P3-03 | 8+ empty-state families; no shared PageHeader outside tournament | DESIGN_SYSTEM |
| P3-04 | ~453 hardcoded hex | DESIGN_SYSTEM |
| P3-05 | Status chips EN Locked/Unlocked vs Experience VN | MODULE_UI |
| P3-06 | Inconsistent radius 8/10/12 and form density | DESIGN_SYSTEM |
| P3-07 | Non-tournament modules do not match Experience language (expected until Wave 3–4) | MODULE_UI |

```
P3_GAPS=7
```

### P4_POLISH

| ID | Issue | Owner |
|----|-------|-------|
| P4-01 | ~48 English user-facing strings (billing, engine, config) | MODULE_UI |
| P4-02 | ~18 developer terms in UI | MODULE_UI |
| P4-03 | IconButton aria-label / 44px touch | APP_SHELL |
| P4-04 | Alert-as-loading flicker | MODULE_UI |
| P4-05 | Banner stack layout shift | APP_SHELL |
| P4-06 | MobileBottomNav overflow on 360 | RESPONSIVE |
| P4-07 | Dialogs not fullScreen on xs | RESPONSIVE |
| P4-08 | Public catalog 404 stubs for club/court detail | PUBLIC |
| P4-09 | Coming-soon tech placeholders | MODULE_UI |
| P4-10 | Canonical breadcrumbs vs ClubPageShell breadcrumbs | APP_SHELL |

```
P4_GAPS=10
```

---

## What is explicitly out of scope for later implementation waves

- Redesign of frozen Tournament Experience 23 screens  
- New App Shell from scratch (converge on CanonicalAppShell)  
- New writers / SQL / Staging or Production mutation  
- Duplicate domain authorities
