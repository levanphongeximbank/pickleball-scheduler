# Legacy Route Disposition — Canonical Navigation Phase 1 (Review Binding)

Owner decisions B01–B03 bound. Reference: [`CANONICAL_ROUTE_INVENTORY.json`](./CANONICAL_ROUTE_INVENTORY.json)

---

## Disposition Legend

| Action | Meaning |
|--------|---------|
| `RETAIN_CANONICAL` | Keep as primary route in proposed navigation registry |
| `REDIRECT_LEGACY` | Legacy route redirects to canonical; remove from active menu |
| `CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION` | Legacy route family retained for compatibility; new nav does not point here |
| `HIDE_SHADOW` | Remove from all user-facing menus; direct access restricted |
| `REMOVE_DEAD_ROUTE` | Delete orphan page component (route already absent) |

---

## B01 — Messages ✅ RESOLVED

| Path | Classification | Disposition | Menu active |
|------|----------------|-------------|-------------|
| `/crm/messages` | CANONICAL | `RETAIN_CANONICAL` | ✅ Yes |
| `/messages` | LEGACY | `REDIRECT_LEGACY` → `/crm/messages` | ❌ No |

**Menu owner:** CRM & Chăm sóc khách hàng  
**Phase 2 action:** Remove `messaging` group leaf for `/messages`; add redirect in router (Phase 4).

---

## B02 — Tournament Routes ✅ RESOLVED

### Canonical family — `/tournaments/:id/*` (7 routes)

| Path | Disposition | Proposed menu |
|------|-------------|---------------|
| `/tournaments/:tournamentId/engine` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/seed` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/draw` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/schedule` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/courts` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/ranking` | `RETAIN_CANONICAL` | ✅ |
| `/tournaments/:tournamentId/logs` | `RETAIN_CANONICAL` | ✅ |

### Legacy family — `/tournament/*` (43 routes)

All reclassified **LEGACY** with disposition `CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION`.

| Category | Count | Examples | Proposed menu |
|----------|------:|----------|---------------|
| Hub sidebar leaves | 13 | `/tournament`, `/tournament/list`, `/tournament/create` | ❌ |
| In-page hub leaves | 12 | `/tournament/bracket`, `/tournament/teams` | ❌ |
| Config/ops leaves | 16 | `/tournament/config/*`, `/tournament/operations` | ❌ |

**Phase 4 action:** Add controlled redirects from legacy hub paths to canonical `/tournaments/:id/*` equivalents as they are built. No dual active menu.

**Warning W09:** Hub routes lack 1:1 canonical targets today — incremental migration required.

---

## B03 — V5 Skill Assessment ✅ RESOLVED

| Path | Classification | Disposition | Menu | RBAC visibility |
|------|----------------|-------------|------|-----------------|
| `/player/skill-assessment-v5` | SHADOW | `HIDE_SHADOW` | ❌ | SUPER_ADMIN only |
| `/player/skill-assessment` | CANONICAL | `RETAIN_CANONICAL` | ✅ (Rating program) | AUTHENTICATED |

**Rules:**
- Feature flag `VITE_PICK_VN_RATING_V5_ENABLED` must NOT expose route in navigation
- Route retained for technical evaluation
- Canonical assessment under separate Rating consolidation program

---

## Other Legacy Redirects (Pre-existing)

| Path | Redirect to | Disposition |
|------|-------------|-------------|
| `/onboarding/pick-vn-rating` | `/player/skill-assessment` | `REDIRECT_LEGACY` |
| `/clubs/discover` | `/discover-clubs` | `REDIRECT_LEGACY` |
| `/club/activity` | `/my-club?view=schedule` | `REDIRECT_LEGACY` |
| `/courts-ops` | `/court-management/courts` | `REDIRECT_LEGACY` |
| `/tournament/entry-fee` | `/tournament/config/fee` | `REDIRECT_LEGACY` (within legacy family) |

---

## Duplicate Routes (Post-Review)

| Path A | Path B | Disposition |
|--------|--------|-------------|
| `/profile` | `/player/profile` | `RETAIN_CANONICAL` — dual entry by persona (staff vs PLAYER) |
| `/players/skill` | `/player/skill` | `RETAIN_CANONICAL` — staff vs PLAYER scope |

**Resolved:** `/messages` vs `/crm/messages` — see B01.

---

## Dead Orphan Pages — `REMOVE_DEAD_ROUTE` (Phase 4)

| File | Superseded by |
|------|---------------|
| `src/pages/onboarding/PickVnOnboardingPage.jsx` | `/player/skill-assessment` |
| `src/pages/player/ClubActivityPage.jsx` | `/my-club?view=schedule` |
| `src/pages/player/ClubDiscoverPage.jsx` | `/discover-clubs` |
| `src/pages/dev/RefereeV5PreviewPage.jsx` | — |

---

## Summary Counts

| Disposition | Count |
|-------------|------:|
| RETAIN_CANONICAL | 89 |
| REDIRECT_LEGACY | 6 (incl. B01 `/messages`) |
| CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION | 43 (B02 `/tournament/*`) |
| HIDE_SHADOW | 1 (B03) |
| REMOVE_DEAD_ROUTE | 4 orphans |

| Classification | Count |
|----------------|------:|
| CANONICAL | 89 |
| LEGACY | 48 |
| HIDDEN_ACTIVE | 40 |
| SHADOW | 1 |
| DUPLICATE | 1 |
| **Total routes** | **179** |

**Duplicate active canonical menu entries:** 0
