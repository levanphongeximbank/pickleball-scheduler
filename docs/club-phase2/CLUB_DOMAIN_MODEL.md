# Club Domain Model — Phase 2A

**Status:** Architecture audit (read-only)  
**Sources:** `src/features/club/models/*`, `src/models/club.js`, `docs/v5/CLUB_GOVERNANCE_SPEC.md`, Phase 42B schema docs, membership/governance services.

---

## 1. Entity map

```text
Tenant / Venue
    └── Club
          ├── GovernanceAssignment (owner | president | vice_president)
          ├── ClubMember (membership edge)
          │     └── RosterTitle (member | captain | coach | manager)  ← local-only today
          ├── MembershipRequest (join request)
          ├── ActivitySession (schedule)
          ├── ClubMatch / ClubRating / RatingHistory  ← club-extension
          └── InternalTournament (via club blob + bridge)
```

**Not present today:** Committee, Invitation (outbound).

---

## 2. Club

| Aspect | Detail |
|--------|--------|
| **UI / model** | `src/models/club.js` — `normalizeClub` / `createClubRecord` |
| **V2 mapping** | `mapV2ClubToUiClub` in `clubStorageV2RpcService.js` |
| **Core fields** | `id`, `name`, `code`, `description`, `status`, `slug`, `note`, `tenantId` / `venueId`, `createdByUserId`, `timezone`, `governance`, timestamps |
| **V2 extras** | `version`, labels, `activeMemberCount` |
| **Statuses** | `active` \| `inactive` \| `pending_setup` \| `pending_approval` (`constants/clubStatus.js`) |

### Lifecycle

```text
create
  → pending_approval (self-register) OR pending_setup (no president) OR active
  → active (president required per G1)
  → inactive / soft delete
```

### Persistence

| Mode | Store |
|------|--------|
| **V2 SSOT** | `public.clubs` |
| **Legacy** | Local registry `pickleball-clubs-v1` + optional `club_governance` / `club_upsert_registry` |
| **Blob (ops)** | `pickleball-club-data-v3::{clubId}` / `club_data_v3` — players, courts, seasons, tournaments |

---

## 3. Membership (ClubMember)

| Aspect | Detail |
|--------|--------|
| **Local model** | `models/clubMember.js` |
| **V2 table** | `public.club_members` |
| **Local fields** | `id`, `tenantId`, `clubId`, `playerId`, `role`, `status`, `joinedAt`, `leftAt` |
| **V2 fields** | `user_id`, `athlete_id`, `membership_type` (default `regular`), `status` (`active` \| `left` \| `removed`), versioning |

### Lifecycle

```text
membership request approved OR club_add_member
  → active
  → leave (club_leave_membership) | remove | restore
```

**SSOT intent:** `club_members` when V2 on. `profiles.club_id` is **deprecated** as membership SSOT (Phase 42).

### Consumers

- My Club home, members tabs, nav matrix, tournament invite pool, notification recipient resolution, active membership cache.

---

## 4. Governance

| Aspect | Detail |
|--------|--------|
| **Model** | `models/clubGovernance.js` → nested `club.governance` |
| **Fields** | `ownerUserId`, `presidentUserId`, `vicePresidentUserId` + `vicePresidentUserIds[]` (max **2**), `registeredClusterId`, `registeredCourtIds` (legacy), `approvedByUserId`, `approvedAt` |
| **V2 SSOT** | `club_governance_assignments` with `role_code`: `club_owner` \| `president` \| `vice_president` |

### Rules (from governance spec)

| ID | Rule |
|----|------|
| G1 | President required before `active` |
| G3 | Owner and President may be the same person |
| G4 | Owner optional at create |
| G5 | VP optional; max 2 |
| G7 | No president → `pending_setup`; no internal tournaments |

---

## 5. Owner (Chủ sở hữu)

| Aspect | Detail |
|--------|--------|
| **Storage** | `ownerUserId` / assignment `club_owner` |
| **Assigners** | Tenant owner (`TENANT_OWNER` / venue owner) and platform global roles; Phase 1C narrows server `club_assign_owner` |
| **Powers** | Full members; change president; delete club; transfer ownership (UI may gate under V2) |
| **Cannot** | Self-assign as Owner when only President (spec D3 / §4.2) |

Services: `assignClubOwner`, `transferClubOwnership`, `canAssignClubOwner`, RPCs `club_assign_owner` / `club_clear_owner`.

---

## 6. President (Chủ tịch)

| Aspect | Detail |
|--------|--------|
| **Storage** | `presidentUserId` / assignment `president` |
| **Required** | For `active` |
| **Powers** | Day-to-day club ops, full member management (not delete club), review joins, internal tournaments |
| **Cannot** | Assign owner; delete club; change president (except relinquish flows where allowed) |

Services: `transferClubPresident`, `bootstrapSelfRegisteredPresident`, `canChangeClubPresident`, RPC `club_transfer_president`.

---

## 7. Vice President (Phó chủ tịch)

| Aspect | Detail |
|--------|--------|
| **Storage** | Up to 2 IDs / multiple `vice_president` assignment rows |
| **Powers** | Limited edit; review joins; create internal tournaments; view ratings |
| **Cannot** | Delete club; delete members; change president; assign owner; change registered cluster (spec §4.1.1) |

Services: `assignClubVicePresident`, `setClubVicePresidents`, RPCs `club_assign_vice_president` / `club_clear_vice_president`.  
Auth elevation: PLAYER with VP/President → effective `CLUB_MANAGER` (`governanceRoleElevation.js`).

---

## 8. Coach / Captain / Manager (roster titles)

| Aspect | Detail |
|--------|--------|
| **Constants** | `CLUB_MEMBER_ROLES`: `member` \| `captain` \| `coach` \| `manager` |
| **Labels** | Thành viên / Đội trưởng / Huấn luyện viên / Quản lý CLB |
| **Persistence** | Local extension `clubMember.role` only |
| **V2** | `mapV2MemberRowToUi` hardcodes `role: "member"`; governance returned separately as `governanceRoles[]` |
| **Authz** | **No** dedicated permission gates |

**Phase 2 decision required:** promote to cloud columns/table **or** retire from product UI.

---

## 9. Committee

| Aspect | Detail |
|--------|--------|
| **Status** | **Not implemented** — no model, table, RPC, or service |
| **Related UI** | Org-chart style views may show governance officers only |
| **Phase 2** | Explicit product GO/NO-GO before modeling |

---

## 10. Invitations

| Aspect | Detail |
|--------|--------|
| **Status** | **No Invitation entity** |
| **Closest** | (1) Membership requests (inbound); (2) tournament invite member list bypass (`getClubMembersForTournamentInvite`) — ephemeral, not stored invites |

**Phase 2:** design outbound invite (token, expiry, accept) **or** document as non-goal.

---

## 11. Join Requests (Membership Requests)

| Aspect | Detail |
|--------|--------|
| **Model** | `models/clubMembershipRequest.js` |
| **Statuses** | `pending` \| `approved` \| `rejected` \| `cancelled` |
| **Fields** | `id`, `tenantId`, `clubId`, `userId`, `displayName`, `pickVnRating`, `message`, review metadata, `approvedPlayerId` |
| **V2 store** | `club_membership_requests_v42` |
| **Legacy** | Phase 31 `club_membership_requests` + local extension |

### Lifecycle

```text
submit → pending → approve (creates membership) | reject | cancel
```

Reviewers: Owner / President / VP (client + server gov role helpers).  
RPCs: `club_submit_membership_request`, `club_cancel_membership_request`, `club_review_membership_request`, list variants.

---

## 12. Supporting domain objects (club-scoped)

| Entity | Model / service | Persistence | Notes |
|--------|-----------------|-------------|--------|
| Activity session | `clubActivitySession.js` / schedule service | Extension | Triggers notification bridge |
| Club match | `clubMatch.js` | Extension | Friendly / bridged from tournament |
| Club player rating | `clubPlayerRating.js` | Extension | Parallel Elo |
| Rating history | `clubRatingHistory.js` | Extension | History of club Elo |
| Internal tournament | `clubTournamentService.js` | Club blob | Competition concern; Club creates/lists |

---

## 13. Data ownership summary

| Entity | System of Record (target / V2) | Consumers | Ownership | Cross-module deps |
|--------|--------------------------------|-----------|-----------|-------------------|
| Club | `public.clubs` | Registry, My Club, manage UI, guards | Club | Subscription plan limit; tenant |
| Membership | `public.club_members` | Nav, members UI, notifications, tournaments | Club | Player `player_id` / athlete |
| Governance | `club_governance_assignments` | Auth elevation, UI chips, authz | Club | Identity roles |
| Membership request | `club_membership_requests_v42` | Discover / review UI | Club | Player display; Pick_VN rating read |
| Roster title | *(undefined in V2)* | Local members UI | Club (local) | None server-side |
| Committee | — | — | — | — |
| Invitation | — | — | — | — |
| Courts / bookings | **Should be Venue** | Court engine, venue-court | Misplaced in blob | Heavy |
| Person profile | **Should be Player** | Pickers, athletes | Misplaced blob / Club repos | Heavy |
| Competition Elo | **Should be Competition / Rating** | Statistics | Dual with club Elo | Heavy |

---

## 14. Identity keys (do not conflate)

| Key | Meaning |
|-----|---------|
| `auth.users.id` / `user_id` | Login account |
| `profiles.player_id` | Link alias to Player |
| Blob `player.id` | Legacy operational player row |
| `athlete_id` | V2 athlete linkage |
| `club.id` | Club entity |
| `tenantId` / `venueId` | Multi-tenant scope (often aliased in UI) |

Resolution helpers live in `clubActiveMembershipService`, `resolveV2AthleteProfileService`, `platformAthleteService` — high dual-path complexity.
