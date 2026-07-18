# Phase 1C — Club Management Integration & UI Validation

**Branch:** `feature/club-phase-1c-integration-ui`  
**Flag:** `VITE_CLUB_STORAGE_V2`  
**Scope:** UI integration only — no Production SQL / deploy / push until Owner review.

## Environments

| Surface | Desktop | Mobile |
|---------|---------|--------|
| My Club Home | ☐ | ☐ |
| My Club Members | ☐ | ☐ |
| My Club Governance | ☐ | ☐ |
| My Club Org Chart | ☐ | ☐ |
| Manage Club Detail | ☐ | ☐ |
| Manage Members tab | ☐ | ☐ |

---

## A. Flag ON (`VITE_CLUB_STORAGE_V2=true`)

### Unified club record
- [ ] My Club Home, Governance, Org Chart share the same V2 club identity/governance/count
- [ ] Manage Club Detail loads cloud-only clubs (no false 404 from empty local registry)
- [ ] Identity/governance/count are **not** read from local registry/blob

### Governance candidates
- [ ] Owner / President / VP selectors list **active** V2 members with `user_id` only
- [ ] Left / removed members do not appear as candidates
- [ ] Cloud-only members (no blob player) appear in selectors

### Dual VP
- [ ] Manage Governance shows two VP slots
- [ ] My Club Governance shows two VP slots
- [ ] Assign slot 1 only — slot 2 unchanged
- [ ] Clear slot 1 only — slot 2 unchanged
- [ ] Clear-all clears both
- [ ] President cannot be selected as VP
- [ ] Third VP assignment is rejected (max two)
- [ ] After every mutation, canonical governance reloads

### Org Chart
- [ ] Shows Owner, President, up to 2 VPs, active member count
- [ ] Count matches Home and Members active count (`active_member_count`)
- [ ] No blob-only / left / removed / QA-orphans under V2

### Members restore & filters
- [ ] Filters: Active / Left / Removed / All
- [ ] Restore button on left/removed rows (authorized roles only)
- [ ] Confirm dialog before restore
- [ ] After add / remove / restore: roster + club + Home count + Org Chart refresh

### Conflict / Forbidden UX
- [ ] VERSION_CONFLICT → reload guidance, no silent overwrite
- [ ] FORBIDDEN → permission message (no stack trace)
- [ ] Duplicate add → deterministic conflict message

### Authorization visibility (UI)
| Actor | Mutation buttons |
|-------|------------------|
| Owner | ☐ Visible / allowed |
| President | ☐ Visible / allowed |
| Authorized tenant admin/owner | ☐ Visible / allowed |
| Ordinary tenant member | ☐ Hidden/disabled |
| Ordinary club member/player | ☐ Hidden/disabled |
| VP alone | ☐ Hidden/disabled |

RPC remains final enforcement.

### Version
- [ ] Club version shown where useful (detail / governance / members)
- [ ] Mutations send expected version when available

---

## B. Flag OFF (`VITE_CLUB_STORAGE_V2=false`)

- [ ] My Club / Manage use legacy registry/blob behavior
- [ ] Governance candidates come from local members/players
- [ ] Restore member UI is not the V2 cloud path (or clearly unavailable)
- [ ] No regression: notifications recipients, member lifecycle, governance, responsive layouts

---

## C. Regression smoke

- [ ] Notification recipients still resolve active members
- [ ] Member add/remove still works for authorized roles
- [ ] Governance transfer president still works
- [ ] My Club / Manage Club responsive layout intact

---

## Sign-off

| Item | Result |
|------|--------|
| Flag ON QA | ☐ Pass / ☐ Fail |
| Flag OFF QA | ☐ Pass / ☐ Fail |
| No Production SQL | ☐ Confirmed |
| No Production deploy | ☐ Confirmed |
| No push / PR until Owner review | ☐ Confirmed |
| Tester | |
| Date | |
