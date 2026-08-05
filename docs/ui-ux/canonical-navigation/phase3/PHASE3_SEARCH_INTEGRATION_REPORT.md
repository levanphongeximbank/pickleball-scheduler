# Phase 3 Search Integration Report

## W02 — CLOSED

Canonical shell global search no longer uses legacy `MENU_GROUPS` under the Figure 1 top bar.

| Item | Detail |
|------|--------|
| Component | `CanonicalGlobalSearch.jsx` |
| Trigger | `CanonicalGlobalSearchTrigger.jsx` |
| Index builder | `buildCanonicalSearchIndex.js` |
| Source | Filtered canonical menu tree (same registry as sidebar/drawer) |
| Desktop | Yes |
| Mobile | Yes (shared component) |

## Guarantees

- Search results respect RBAC + permissions via `isCanonicalMenuNodeVisible`
- Hidden / shadow / legacy routes do not leak
- Private Pairing absent for unauthorized roles
- V5 shadow `/player/skill-assessment-v5` absent
- B01: `/crm/messages` once; `/messages` never indexed
- Parameterized deep-links excluded from normal search (no unresolved `:id` navigation)
- Legacy `GlobalSearch.jsx` unchanged for flag-OFF legacy shell

## Evidence

Unit: `phase3 W02 — canonical search respects RBAC and hides shadow/legacy`  
UI: `canonical-shell-phase3.ui.test.jsx` search mount assertion
