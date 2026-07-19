# Club API Audit — Phase 2A

**Status:** Architecture audit (read-only)  
**Primary surface:** `src/features/club/index.js`  
**Transport (V2):** `clubStorageV2RpcService.js` → PostgREST `club_*` RPCs

---

## 1. Public API groups

### 1.1 Club entity (`clubTenantService`)

| Export | Purpose |
|--------|---------|
| `getClubsByTenant` | List by tenant |
| `getClubById` | Get one |
| `getClubStats` | Stats |
| `createClub` | Canonical create (V2 → `club_create`) |
| `updateClub` | Canonical update (V2 → `club_update`) |
| `deactivateClub` / `deleteClubSoft` | Soft lifecycle |
| `getTenantPlayers*` | Tenant player listing helpers |

**Certified path (45A.3F):** UI → `clubTenantService` → `clubStorageV2RpcService` → `club_create` / `club_update` → `public.clubs`.

### 1.2 Access (`clubAccessService`)

| Export | Purpose |
|--------|---------|
| `canUserViewClub` | Visibility |
| `getClubsVisibleToUser` / `filterClubsForUser` | List filters |

### 1.3 Governance (`clubGovernanceService` + model)

Authz predicates + mutations: assign/transfer owner, transfer president, assign/set VPs, approve/reject registration, delete as owner, self-register bootstrap, candidate lists, display labels.

Also re-exported: `MAX_VICE_PRESIDENTS`, `getVicePresidentUserIds`, `canReviewMembershipForClub`.

### 1.4 Members (`clubMemberService`)

| Export | Purpose |
|--------|---------|
| `getClubMembers` | Roster |
| `getClubMembersForTournamentInvite` | Spec §5 exception |
| `addMemberToClub` / `removeMemberFromClub` / `restoreMemberToClub` | Mutations |
| `updateClubMemberRole` / `updateClubMemberStatus` | Local role/status |
| `isProtectedGovernanceMember` | Guard deletes |
| `mapV2MemberRowToUi` | V2 → UI |

### 1.5 Membership requests

| Export | Purpose |
|--------|---------|
| `submitClubMembershipRequest` / `cancelClubMembershipRequest` | Athlete flow |
| `approveClubMembershipRequest` / `rejectClubMembershipRequest` | Review |
| `listPending*` / `listMy*` / `listDiscoverableClubs` / `listJoinableClubs` | Queries |
| `getMyClubSummary` / `leaveMyClub` | My Club |
| `probeMembershipReviewAccess` | UI probe |

### 1.6 Active membership / routing / nav

| Area | Exports |
|------|---------|
| Active membership | `resolveMyActiveClubMembership`, cache helpers, `getMyClubSummary` builders |
| Membership phase | `MEMBERSHIP_PHASE`, `resolveMembershipPhase`, … |
| Hooks | `useMyClubMembership`, context providers, `useCanReviewMembership`, `useClubMenuScope` |
| Landing / routes | `resolvePostAuthClubPath`, `CLUB_ROUTE_PATHS`, redirect helpers |
| Nav | `buildClubNavContext`, `isClubNavItemVisible`, tab visibility |

### 1.7 V2 RPC wrappers (exported)

`rpcV2ClubCreate|Update|Get|ListRegistry|ListDiscoverable|ListMembers`, membership request RPCs, owner/VP/president RPCs, member add/remove/restore/leave, `rpcV2GetMyActiveMembership`, `mapV2ClubToUiClub`.

### 1.8 Activity / matches / ratings / tournaments

| Area | Key exports |
|------|-------------|
| Schedule | `list/create/update/deleteClubActivitySession`, `canManageClubActivitySchedule` |
| Matches | `getClubMatches`, `addClubMatch`, `createFriendlyClubMatch` |
| Ratings | `getClubRatings`, `updateClubRating`, history, `applyClubMatchElo*` |
| Tournaments | `getClubTournaments`, `createClubInternalTournament`, player pool helpers |
| Bridge | `processClubInternalMatchCompletion`, tournament clubId resolvers |

### 1.9 Registry / flags / athletes / UI

- Flags: `isClubStorageV2Enabled`, `isClubRegistryCloudEnabled`
- Registry fetch/cache (tenant + platform)
- Cloud sync pull/merge (legacy path)
- Platform athlete helpers
- UI barrel (`ClubCard`, chips, shells, …)

**Explicitly not public (45A.3F):** `persistClubToCloud` / sync-to-legacy writers — import only for V2-OFF rollback.

---

## 2. RPC inventory (Club Storage V2)

| RPC | Domain |
|-----|--------|
| `club_create` | Entity |
| `club_update` | Entity |
| `club_get` | Entity read |
| `club_list_registry` | Registry |
| `club_list_discoverable` | Discovery |
| `club_list_members` | Members |
| `club_submit_membership_request` | Join |
| `club_cancel_membership_request` | Join |
| `club_list_my_requests` | Join |
| `club_list_pending_requests` | Review |
| `club_review_membership_request` | Review |
| `club_assign_owner` / `club_clear_owner` | Governance |
| `club_transfer_president` | Governance |
| `club_assign_vice_president` / `club_clear_vice_president` | Governance |
| `club_add_member` / `club_remove_member` / `club_restore_member` | Members |
| `club_get_my_active_membership` / `club_leave_membership` | Membership |
| Helpers | `phase42_is_*`, `phase42_has_gov_role`, `phase42_write_audit`, idempotency, can_* gates |

### Legacy RPCs (rollback / V2-OFF)

| RPC | Era |
|-----|-----|
| `club_upsert_registry` | Phase 38–41 |
| `club_claim_self_registration` | Phase 39 |
| Phase 31 membership request RPCs | Pre-V2 signatures |

Client: `clubRegistryRpcService.js`, `clubMembershipRequestRpcService.js` (Phase 31 — **wrong for V2**).

---

## 3. Duplicated entry points

| Concern | Canonical (V2 ON) | Parallel / legacy |
|---------|-------------------|-------------------|
| Create/update club | `clubTenantService` | `domain/clubService` via `clubOfflineCommandAdapter`; retired `persistClubToCloud` |
| Registry list | `club_list_*` | `clubRegistryRpcService` |
| Membership review RPC | `clubStorageV2RpcService` | `clubMembershipRequestRpcService` (Phase 31) |
| Governance read | Assignments via RPC | Local `club.governance` + old `club_governance` table |
| Active membership | `club_get_my_active_membership` | `profiles.club_id` / athlete link store |
| Member roster | `club_list_members` | `clubExtensionStorage.members` |
| Ratings | Club-extension services | Competition blob Elo |

---

## 4. Missing APIs (product / architecture)

| Gap | Notes |
|-----|-------|
| Invitation CRUD | No entity |
| Committee CRUD | No entity |
| Roster title cloud update | `updateClubMemberRole` not V2-authoritative |
| Certified archive/hard-delete | Deferred under V2 |
| Stable Notification port | Bridge only |
| Player picker owned by Player module | Lives under Club repositories |
| Single “getClubRatingsCanonical” | Dual Elo |
| Explicit Version Conflict error UX contract | Present in RPC patterns; document client mapping fully |
| Cross-module Club SDK package | Consumers import barrel ad hoc |

---

## 5. Internal adapters / guards

| Module | Role |
|--------|------|
| `clubLegacyWriteGuard` | Blocks legacy writers when V2 authoritative |
| `clubOfflineCommandAdapter` | UI-facing offline / V2-OFF |
| `clubCommandErrorMap` | RPC → UI error codes |
| `canonicalClubRepository` | Read gateway (flagged) |
| `canonicalMembershipRepository` | Membership read gateway |
| `canonicalPlayerRepository` | **Mis-homed** player read gateway |

---

## 6. API quality assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Discoverability | Good | Strong `index.js` barrel |
| Dual-path clarity | Fair | Flags + comments; still easy to call wrong service |
| Certification coverage | Partial | Create/update locked; membership/governance partial |
| Stability for peers | Fair | Competition/Player still reach into storage |
| Completeness vs product | Fair | Missing invite/committee/roster cloud |

---

## 7. Recommendations

1. Publish a short **Club Public API.md** (or section in module ARCHITECTURE) listing allowed imports for other features.  
2. Stop exporting raw `rpcV2*` from public barrel long-term — keep behind services.  
3. Delete or hard-gate Phase 31 RPC client when V2 is Production default.  
4. Certify membership + governance command planes like 45A.3F.  
5. Move player repositories out of Club public API.
