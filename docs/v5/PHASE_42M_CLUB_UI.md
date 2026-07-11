# Phase 42M — Professional Club UI

**Status:** Implementation complete — **Preview QA required** before GO DEPLOY 42M Production  
**Blueprint:** [PHASE_42X_CLUB_UX_BLUEPRINT.md](./PHASE_42X_CLUB_UX_BLUEPRINT.md)  
**Depends on:** Phase 42L navigation matrix PASS (Production smoke rebaseline PASS)

---

## Scope delivered

UI-only polish for the Club module. **No changes** to schema, RPC contract, RLS/RBAC, membership logic, registry read model, route structure, or menu permissions (42L matrix).

| Area | Before (42L) | After (42M) |
|------|--------------|-------------|
| My Club home | Plain cards, mixed spacing | `ClubPageShell`, `MyClubSummaryCard` + `MyClubHomeInsights`, confirm leave |
| Discover | Ad-hoc layout | `ClubCard` variants, skeleton, empty states, `ClubFeedbackAlert` |
| Members | Basic table + generic chips | `GovernanceRoleChip`, mobile card layout, `ClubEmptyState` |
| Requests | Table-only, instant reject | Confirm reject dialog, mobile cards, skeleton |
| Manage registry | Raw MUI header/table | `ClubPageShell`, breadcrumbs, `ClubStatusBadge`, registry empty/filter states |
| Platform registry | Inline typography header | Same shell pattern, pagination, skeleton/error/empty |
| Design system | Per-page styles | `src/features/club/ui/*` tokens + shared components |

---

## Component map

```
src/features/club/ui/
├── clubUiTokens.js          # spacing, card/paper sx
├── clubCardCtaLogic.js      # pure CTA rules (testable, 42L contract)
├── ClubAvatar.jsx
├── ClubStatusBadge.jsx
├── GovernanceRoleChip.jsx
├── MembershipRequestBadge.jsx
├── ClubCard.jsx             # Discover grid
├── ClubEmptyState.jsx
├── ClubFeedbackAlert.jsx
├── ClubConfirmDialog.jsx
├── ClubPageShell.jsx        # breadcrumb + h1 + actions
├── ClubDiscoverSkeleton.jsx
├── ClubRegistrySkeleton.jsx
├── MyClubHomeInsights.jsx
└── index.js

Pages wired:
├── src/pages/player/MyClubPage.jsx
├── src/pages/player/DiscoverClubsPage.jsx
├── src/pages/player/myClub/MyClubDiscoverPanel.jsx
├── src/pages/player/myClub/MyClubSummaryCard.jsx
├── src/pages/player/myClub/MyClubMembersPanel.jsx
├── src/pages/player/myClub/MyClubMembershipRequestsPanel.jsx
├── src/pages/clubs/ClubListPage.jsx
└── src/pages/platform/PlatformClubsPage.jsx
```

---

## Tests

```bash
node --test tests/phase42m-club-ui.test.js
node --test tests/phase42l-navigation-matrix.test.js
npm run build
```

Coverage:

- UI module exports + layout tokens
- `resolveClubCardCta` — no unauthorized join/cancel CTAs
- 42L nav matrix regression (Discover vs Manage list, menu labels)

---

## Preview QA checklist (required before Production)

### Desktop

- [ ] `/my-club` — member home: header, insights tiles, quick actions by role
- [ ] `/my-club?view=discover` — search/filter, card states (joinable / pending / your-club)
- [ ] `/my-club` — president: pending requests queue, approve + reject confirm
- [ ] `/manage/clubs` — tenant context, filters, status badges, empty/filter states
- [ ] `/platform/clubs` — cross-tenant table, pagination, SA-only guard

### Mobile (375px)

- [ ] My Club summary + insights readable
- [ ] Discover cards stack; CTAs correct per state
- [ ] Members + requests use card layout (not cramped table)
- [ ] TenantSwitcher reachable (42L behavior unchanged)

### Accessibility / regression

- [ ] Keyboard: Discover card focus + Enter/Space does not fire wrong CTA when pending
- [ ] `aria-live` feedback after approve/reject/leave
- [ ] Contrast on status chips (active / pending / rejected)
- [ ] All role menus identical to 42L matrix (PLAYER / VENUE_OWNER / SA)

### Build

- [ ] `npm run build` PASS
- [ ] `npm test` PASS (or at minimum phase42l + phase42m + club-* suites)

---

## Rollback

Revert the Phase 42M commit(s). No migration or env change required.

1. `git revert <commit-hash>`
2. Redeploy Preview from previous commit
3. Re-run 42L smoke if menu/routing touched (42M should not alter matrix)

---

## Evidence

| Artifact | Path |
|----------|------|
| Mockups (reference) | `docs/v5/mockups/my-club-*-redesign.png` |
| Unit tests | `tests/phase42m-club-ui.test.js` |
| 42L baseline | `tests/phase42l-navigation-matrix.test.js` |

Screenshots: capture during Preview QA → `docs/v5/qa-evidence/phase42m-preview/` (after Preview deploy).

---

## Stop line

**Do not deploy Production** until Preview QA checklist above is PASS and signed off for **GO DEPLOY 42M**.

Commit hash: `13955f9b5ba0b5c28955246fea9ae1379ec931b9`

Preview URL: `https://pickleball-scheduler-my4caxq8l-pickleball-scheduler.vercel.app`

Deployment ID: `dpl_Ev83SXFLFwQsCxonbfETyMSL92ZT`
