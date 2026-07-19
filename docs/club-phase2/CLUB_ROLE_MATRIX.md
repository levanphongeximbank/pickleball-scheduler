# Club Role Matrix — Phase 2A

**Status:** Architecture audit (read-only)  
**Sources:** `docs/v5/CLUB_GOVERNANCE_SPEC.md`, `clubGovernanceService.js`, `clubMemberRoles.js`, `clubNavMatrix.js`, `identity/constants/permissions.js`, Phase 1B/1C gates.

---

## 0. Critical rule — three layers

Do **not** conflate:

| Layer | Examples | Purpose |
|-------|----------|---------|
| **A. Auth RBAC** | `TENANT_OWNER`, `CLUB_MANAGER`, `PLAYER` | Login, routes, `can()` permissions |
| **B. Club governance** | Owner, President, VP | Business titles on the club |
| **C. Roster labels** | member, captain, coach, manager | Local roster titles (not V2-backed) |

Terminology trap: auth `CLUB_OWNER` UI label ≈ “Quản lý CLB” ≈ business **President**, **not** business Owner (`club_owner`).

---

## 1. Layer A — Auth RBAC (club-relevant)

| Auth role | Club relevance |
|-----------|----------------|
| `SUPER_ADMIN` / platform global | Registry / override; should not auto-become club member (Phase 42 policy) |
| `TENANT_OWNER` (`VENUE_OWNER` / `COURT_OWNER`) | Assign owner, approve registration, update club (with server gates) |
| `VENUE_MANAGER` / `COURT_MANAGER` | Club summary only unless also governance owner |
| `CLUB_MANAGER` (alias `CLUB_OWNER`) | Elevated when acting as president/VP/owner |
| `PLAYER` | Discover, join request, self-register; elevates when governance requires |

### Permissions (`permissions.js`)

| Permission | Code |
|------------|------|
| View | `club.view` |
| Create | `club.create` |
| Update | `club.update` |
| Delete | `club.delete` |
| Assign owner | `club.governance.assign_owner` |
| Approve registration | `club.governance.approve` |
| Review membership | `club.membership.review` |

Client gates often short-circuit on governance title even when permission exists (e.g. SA without governance cannot review membership UI — Phase 42L).

---

## 2. Layer B — Club governance

| Title (VI) | Code / field | Required? | Max |
|------------|--------------|-----------|-----|
| Chủ sở hữu | `club_owner` / `ownerUserId` | No at create | 1 |
| Chủ tịch | `president` / `presidentUserId` | Yes for `active` | 1 |
| Phó chủ tịch | `vice_president` / `vicePresidentUserIds` | No | 2 |

### Capability matrix (business)

| Capability | Owner | President | VP | Tenant owner ≠ club owner | Venue manager ≠ club owner | Member |
|------------|:-----:|:---------:|:--:|:-------------------------:|:--------------------------:|:------:|
| View full member list | ✓ | ✓ | ✓ | Summary only | Summary only | Limited |
| Manage club profile | ✓ | ✓ | Limited | ✗ | ✗ | ✗ |
| Add/remove members | ✓ | ✓ | Propose / no delete | ✗ | ✗ | ✗ |
| Review join requests | ✓ | ✓ | ✓ | ✗* | ✗ | ✗ |
| Create internal tournament | ✓ | ✓ | ✓ | Venue/official only | Venue/official only | ✗ |
| Change president | ✓ | Relinquish only | ✗ | ✓ (assign path) | ✗ | ✗ |
| Assign / clear owner | ✗ (transfer if current owner) | ✗ | ✗ | ✓ | ✗ | ✗ |
| Delete club | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Change registered cluster | ✓ | ✓ | ✗ | — | — | ✗ |

\* Tenant staff historically over-broad on some RPCs — Phase 1C narrows owner assign to SA + tenant_owner.

### Client helpers (`clubGovernanceService`)

| Helper | Meaning |
|--------|---------|
| `isClubOwner` / `isClubPresident` / `isClubVicePresident` | Title checks |
| `canViewFullClubMembers` | Full roster vs summary |
| `canAssignClubOwner` | Global or `TENANT_OWNER` |
| `canChangeClubPresident` | Owner / assigner / global |
| `canDeleteClub` | Owner / assigner / global |
| `canDeleteClubMembers` | Full view **and not** VP |
| `canApproveClubMembershipRequests` | Owner / President / VP (+ permission path) |
| `canReviewMembershipForClub` | Blocks bare global without governance |
| `canManageClubGovernance` | President / Owner / assigner |
| `canTransferClubOwnership` | Assigner path / current owner rules |
| `canSelfRegisterClub` | `PLAYER` or `CLUB_MANAGER` |

### Server helpers (authoritative under V2)

| Helper / gate | Purpose |
|---------------|---------|
| `phase42_has_gov_role` | Owner / president / VP |
| `phase42_can_update_club` | Phase 1B update gate |
| `phase42_can_manage_vice_presidents` | Phase 1B VP |
| `phase42_can_assign_club_owner` | Phase 1C owner assign/clear |

---

## 3. Layer C — Roster labels

| Role | Label | Cloud V2 | Permissions |
|------|-------|----------|-------------|
| `member` | Thành viên | Default UI role | None beyond membership |
| `captain` | Đội trưởng | **Not stored** | None |
| `coach` | Huấn luyện viên | **Not stored** | None |
| `manager` | Quản lý CLB | **Not stored** | Collides with auth wording |

V2 returns governance separately (`governanceRoles[]`); roster `role` forced to `member`.

---

## 4. Member visibility matrix (spec §5)

| Viewer | Full member list + profiles | Summary (name, count, president, cluster) | Tournament invite wizard exception |
|--------|----------------------------|--------------------------------------------|------------------------------------|
| Club Owner / President / VP | ✓ | ✓ | ✓ |
| Tenant owner / venue manager **without** club ownership | ✗ | ✓ | ✓ (controlled) |
| Active member (non-gov) | Limited / roster view per UI | — | — |
| Discoverable public | ✗ | Discovery card fields | ✗ |

---

## 5. Nav visibility (summary)

From `clubNavMatrix.js` (conceptual):

| Audience | Typical unlocked areas |
|----------|------------------------|
| Governance (O/P/VP) | Membership requests, governance manage, club ops, daily play |
| Player member | My Club home, schedule, members (read), discover |
| SA without governance | No membership-review UI |
| No membership | Discover + create/self-register CTAs per flags |

---

## 6. Elevation rules

| Condition | Effect |
|-----------|--------|
| PLAYER is President or VP | Elevate effective auth toward `CLUB_MANAGER` for club scopes |
| SA on club without gov assignment | Not treated as membership reviewer |
| Venue staff ≠ club owner | No full member dump |

Implementation: `governanceRoleElevation.js`, `governanceScopeResolver` (identity).

---

## 7. Gaps for Phase 2

1. Document **server** matrix next to client helpers in one table (this file is the start).  
2. Captain/Coach cloud SoT: cardinality **0..N**; optional primary Captain (Owner locked Phase 2B).  
3. Resolve auth label `CLUB_OWNER` vs business Owner to reduce operator error.  
4. Committee roles — **excluded** from Phase 2 (DEFER).  
5. Invitation acceptor / create-actor — finalize in **Phase 2E**.
