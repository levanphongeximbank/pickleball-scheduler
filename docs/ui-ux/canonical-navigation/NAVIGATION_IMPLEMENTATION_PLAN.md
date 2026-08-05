# Navigation Implementation Plan — Phase 2+

**Phase 1 review verdict:** `CANONICAL_NAVIGATION_PHASE1_REVIEW_PASS_READY_FOR_COMMIT`  
**Owner decisions B01–B03:** Bound and resolved  
**Phase 1 constraint:** No runtime code changes until commit approved

---

## Owner Decisions — Implementation Binding

### B01 — Messages ✅

| Item | Action | Phase |
|------|--------|-------|
| Remove `/messages` from `messaging` menu group | Config change | P3 |
| Add router redirect `/messages` → `/crm/messages` | Router | P4 |
| Update `MESSAGING_MENU_LEAF` to point to `/crm/messages` or remove group | Config | P3 |
| Global search indexes `/crm/messages` only | Search | P5 |

### B02 — Tournament Routes ✅

| Item | Action | Phase |
|------|--------|-------|
| Remove all `/tournament/*` from proposed canonical menu registry | Done (inventory) | P1 ✅ |
| Build tournament context resolver (active tournamentId) | New utility | P3 |
| Point sidebar/mobile tournament items to `/tournaments/:id/*` | Config | P3 |
| Add controlled redirects from legacy `/tournament/*` hubs | Router | P4 |
| Deprecation telemetry on legacy hits | Analytics | P4 |

**Warning W09:** Hub routes lack 1:1 canonical targets — build incrementally per tournament workflow.

### B03 — V5 Skill Assessment ✅

| Item | Action | Phase |
|------|--------|-------|
| Remove `player-skill-assessment-v5` from PLAYER_ZONE | Config | P3 |
| Remove from `MOBILE_BOTTOM_NAV_PROFILES.player` | Config | P3 |
| Ensure `isMenuItemVisible` ignores flag for this key | Guard | P3 |
| Keep route registered; SUPER_ADMIN direct URL only | No deletion | — |
| Canonical assessment remains `/player/skill-assessment` | Rating program | Separate |

---

## Phase Sequence

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Inventory + owner review binding | ✅ Complete |
| **2** | Figure 1 shell visual redesign | Ready to start |
| **3** | Canonical menu registry + B01/B02/B03 config | Blocked on P2 |
| **4** | Legacy redirects + telemetry | Blocked on P3 |
| **5** | Global search + breadcrumbs from registry | Blocked on P3 |
| **6** | Mobile parity + 10-role QA | Blocked on P5 |

---

## Phase 2 — Shell Visual Redesign

Apply [`FIGURE_1_DESIGN_SYSTEM.md`](./FIGURE_1_DESIGN_SYSTEM.md) tokens. No route/RBAC changes.

**Exit criteria:**
- [ ] Dark navy sidebar, white workspace, compact topbar
- [ ] All 10 roles render without regression
- [ ] Private pairing rules still hidden from non-super-admin

---

## Phase 3 — Canonical Menu Registry

### Core deliverable

Create `src/config/canonicalNavigationRegistry.js` derived from inventory JSON:

```javascript
// Proposed shape (Phase 3 implementation)
export const CANONICAL_NAV_REGISTRY = {
  routes: [/* 82 proposedCanonicalMenu=true entries */],
  ownerDecisions: { B01, B02, B03 },
  level1Groups: [/* 13 groups */],
};
```

### Tasks

| ID | Task |
|----|------|
| P3-01 | Create canonical registry module from inventory JSON |
| P3-02 | Wire `NavMenuShell` to filter by `proposedCanonicalMenu` |
| P3-03 | B01: Remove `/messages` menu leaf; CRM owns messaging |
| P3-04 | B02: Replace tournament sidebar leaves with canonical family |
| P3-05 | B03: Remove V5 from PLAYER_ZONE + mobile bottom nav |
| P3-06 | Align `ROLE_MENU_MAP` to 13 Level-1 group IDs |
| P3-07 | Demote PARTIAL items with honest badge (not generally available) |

**Exit criteria:**
- [ ] `duplicateActiveCanonicalMenuEntries === 0`
- [ ] Desktop and mobile derive from same registry
- [ ] B01/B02/B03 binding verified per role QA matrix

---

## Phase 4 — Legacy Redirects

| ID | Task | Owner decision |
|----|------|----------------|
| P4-01 | Redirect `/messages` → `/crm/messages` | B01 |
| P4-02 | Telemetry on all legacy redirects | — |
| P4-03 | Controlled redirects `/tournament/*` → canonical equivalents | B02 |
| P4-04 | Delete 4 orphan page files | — |
| P4-05 | Remove deprecated `sidebarMenu.js` re-export | — |

**No route deletion** for B03 `/player/skill-assessment-v5`.

---

## Phase 5 — Search & Breadcrumbs

| ID | Task |
|----|------|
| P5-01 | Flatten canonical registry for `GlobalSearch` |
| P5-02 | Index only `proposedCanonicalMenu=true` paths |
| P5-03 | Create `BreadcrumbProvider` from registry |
| P5-04 | Use canonical paths (not legacy `/tournament/*` or `/messages`) |

---

## Phase 6 — QA Matrix

10 roles × desktop + mobile:

- [ ] B01: No `/messages` in any role menu
- [ ] B02: No `/tournament/*` hub in proposed menu; canonical family works
- [ ] B03: No V5 in PLAYER menus; SUPER_ADMIN direct URL works
- [ ] Private pairing hidden from 9 non-super-admin roles
- [ ] PARTIAL items not presented as generally available
- [ ] 0 duplicate active canonical menu entries

---

## Blockers

**None.** B01, B02, B03 resolved.

## Warnings (9 — non-blocking)

See [`CANONICAL_ROUTE_INVENTORY.md`](./CANONICAL_ROUTE_INVENTORY.md) warnings W01–W09.

---

## Approvals

- [x] Phase 1 inventory complete
- [x] Owner decisions B01–B03 bound
- [x] Independent review pass
- [ ] Owner approves commit of documentation
- [ ] Go/No-Go for Phase 2 implementation PR

---

## Safety Attestation

| Check | Status |
|-------|--------|
| Runtime files changed | **0** |
| Production mutations | **0** |
| Deployments | **0** |
| Commit | **NO** |
| Push | **NO** |

**File scope:** `docs/ui-ux/canonical-navigation/**`, `scripts/generate-canonical-nav-inventory.mjs`
