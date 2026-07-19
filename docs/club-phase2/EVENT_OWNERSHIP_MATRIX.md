# Event Ownership Matrix — Club Phase 2A

**Status:** Architecture audit (documentation only)  
**Scope:** Major business events touching Club and adjacent modules  
**Companion:** [READ_WRITE_OWNERSHIP.md](./READ_WRITE_OWNERSHIP.md), [DEPENDENCY_DIAGRAM.md](./DEPENDENCY_DIAGRAM.md)

---

## How to read this matrix

| Column | Meaning |
|--------|---------|
| **Event owner** | Module that defines the event contract and lifecycle rules |
| **Producer** | Code/service that emits or performs the state change |
| **Consumers** | Modules/UI that react or read after the event |
| **Source of truth** | Authoritative store after the event succeeds (V2 target first; legacy noted) |
| **Downstream** | Modules that must stay consistent or may side-effect |

**Status tags:** `LIVE` · `PARTIAL` · `LEGACY` · `MISSING` · `MISPLACED`

---

## 1. Club lifecycle

### Club Created

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `clubTenantService.createClub` → `club_create` (V2); offline: `clubOfflineCommandAdapter` |
| **Consumers** | Club registry UI, ClubContext, My Club landing, Subscription guard (pre-check), Venue owner bind |
| **Source of truth** | `public.clubs` (V2) · legacy: local registry / `club_upsert_registry` |
| **Downstream** | Subscription (plan limit), Identity (optional elevation later), Notification (none by default) |
| **Status** | `LIVE` (V2 certified 45A.3F) |

### Club Updated

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `clubTenantService.updateClub` → `club_update` (Phase 1B authz gate) |
| **Consumers** | Manage club UI, registry cards, discovery summary |
| **Source of truth** | `public.clubs` (+ `version`) |
| **Downstream** | Nav labels, governance display (if name/status), Venue cluster link if `registered_cluster_id` patched |
| **Status** | `LIVE` |

---

## 2. Membership lifecycle

### Member Invited

| Field | Value |
|-------|--------|
| **Event owner** | Club (**target**) — **not implemented as entity** |
| **Producer** | *None* for outbound invite. Closest: tournament wizard uses `getClubMembersForTournamentInvite` (ephemeral list, not an invite record) |
| **Consumers** | — |
| **Source of truth** | — (gap) |
| **Downstream** | Would be Notification, Player |
| **Status** | `MISSING` — inbound flow is **Membership Request**, not Invite |

**Related live event — Membership Request Submitted / Reviewed**

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `clubMembershipRequestService` → `club_submit_*` / `club_review_membership_request` |
| **Consumers** | Discover UI, My Club requests, governance review queue |
| **Source of truth** | `club_membership_requests_v42` (V2) |
| **Downstream** | On approve → Member Joined; optional Notification (not always wired) |
| **Status** | `LIVE` |

### Member Joined

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | Approve request → membership row; or `club_add_member` / `addMemberToClub` |
| **Consumers** | Members tab, active membership cache, nav matrix, notification recipient lists, tournament player pool |
| **Source of truth** | `public.club_members` (V2) · legacy: `clubExtensionStorage.members` |
| **Downstream** | Player (reference only), Notification, Competition (roster eligibility) |
| **Status** | `LIVE` / `PARTIAL` dual-path |

### Member Left

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `leaveMyClub` → `club_leave_membership` |
| **Consumers** | My Club home → Discover redirect, membership cache invalidate |
| **Source of truth** | `club_members.status = left` |
| **Downstream** | Nav, governance protection checks (cannot leave if protected title — product rules) |
| **Status** | `LIVE` |

### Member Removed

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `removeMemberFromClub` → `club_remove_member` (Owner/President; not VP) |
| **Consumers** | Members UI, restore flows |
| **Source of truth** | `club_members.status = removed` |
| **Downstream** | Same as Left; audit via `phase42_write_audit` |
| **Status** | `LIVE` |

---

## 3. Governance & roster titles

### Governance Changed

| Field | Value |
|-------|--------|
| **Event owner** | Club |
| **Producer** | `assignClubOwner`, `transferClubOwnership`, `transferClubPresident`, `assignClubVicePresident` / `setClubVicePresidents`, `updateClubGovernance` → V2 RPCs (`club_assign_owner`, `club_clear_owner`, `club_transfer_president`, VP RPCs) |
| **Consumers** | Governance panel, role chips, auth elevation (`governanceRoleElevation`), nav matrix, membership review rights |
| **Source of truth** | `club_governance_assignments` (V2) · legacy: `club.governance` JSON / `club_governance` table |
| **Downstream** | Identity (effective `CLUB_MANAGER`), Notification (optional schedule/gov alerts) |
| **Status** | `LIVE` / `PARTIAL` (write certification incomplete vs create/update) |

### Captain Assigned

| Field | Value |
|-------|--------|
| **Event owner** | Club (**Phase 2 GO** — cloud SoT in 2E) |
| **Producer (target)** | `roster.assignCaptain` / primary APIs → `club_roster_assignments` |
| **Producer (today)** | `updateClubMemberRole(..., captain)` — **local extension only** |
| **Consumers** | Members UI; Competition optional roster metadata |
| **Source of truth (target)** | `club_roster_assignments` (`captain`) · cardinality **0..N** · optional primary |
| **Downstream** | Membership leave/remove clears assignment |
| **Status** | `LEGACY` today · target `LIVE` in 2E |

### Coach Assigned

| Field | Value |
|-------|--------|
| **Event owner** | Club (**Phase 2 GO** — cloud SoT in 2E) |
| **Producer (target)** | `roster.assignCoach` → `club_roster_assignments` |
| **Producer (today)** | `updateClubMemberRole(..., coach)` — local only |
| **Consumers** | Members UI; Competition optional |
| **Source of truth (target)** | `club_roster_assignments` (`coach`) · cardinality **0..N** |
| **Downstream** | Clear on leave/remove; future specialization as metadata only |
| **Status** | `LEGACY` today · target `LIVE` in 2E |

---

## 4. Competition & team

### Team Registered

| Field | Value |
|-------|--------|
| **Event owner** | **Competition** (competition-core teams / registrations) |
| **Producer** | Competition team/registration resolvers & adapters (not Club command surface) |
| **Consumers** | Tournament UI, draw/matchmaking |
| **Source of truth** | Competition registration/team contracts (+ legacy tournament blob data) |
| **Downstream** | Club supplies **roster eligibility** only (`player_id` / membership proof); must not own team entity |
| **Status** | `LIVE` outside Club · Club role = **reference provider** |

### Tournament Registered / Created (club-internal)

| Field | Value |
|-------|--------|
| **Event owner** | **Competition** (target) · **Club** (current partial producer) |
| **Producer today** | `clubTournamentService.createClubInternalTournament` writes club blob; Competition lifecycle later calls `processClubInternalMatchCompletion` |
| **Consumers** | Club Tournaments tab, Director/tournament pages, Elo bridges |
| **Source of truth today** | Club blob tournaments · target: Competition store |
| **Downstream** | Rating (dual Elo risk), Club extension matches |
| **Status** | `MISPLACED` / `PARTIAL` — Club should emit/consume ports, not own engine |

---

## 5. Venue & booking

### Venue Linked (registered cluster / courts)

| Field | Value |
|-------|--------|
| **Event owner** | Club (link metadata) + Venue (cluster/court inventory) |
| **Producer** | Governance / `club_update` / create payload `registeredClusterId` · `registeredCourtIds` (legacy) |
| **Consumers** | Club summary cards, venue staff visibility, scheduling context |
| **Source of truth** | Club: `registered_cluster_id` on club/governance · Venue: `court_clusters` / courts |
| **Downstream** | Venue & Court, Court Engine (often still keyed by `clubId`) |
| **Status** | `PARTIAL` — link on Club; inventory still often in club blob (`MISPLACED`) |

### Booking Created

| Field | Value |
|-------|--------|
| **Event owner** | **Venue & Court** |
| **Producer** | Venue-court / booking services → historically `loadBookingsForClub` / club blob |
| **Consumers** | Court availability, Finance (optional), Court Engine guard |
| **Source of truth (target)** | Venue booking store · **today:** club blob bookings |
| **Downstream** | Club should **not** own; may read for schedule display if product requires |
| **Status** | `MISPLACED` in club blob |

---

## 6. Rating & ranking

### Rating Updated

| Field | Value |
|-------|--------|
| **Event owner** | **Ambiguous — multi-producer** |
| **Producers** | (a) `clubEloService` / club-extension after club match · (b) Competition `ratingServiceV2` → club blob players · (c) Pick_VN sync into club players · (d) rating verification services |
| **Consumers** | Club Ratings tab, Statistics, membership request display (`pickVnRating`), VPR |
| **Source of truth** | **No single SoT** — extension ratings vs blob Elo vs platform ratings |
| **Downstream** | Ranking, Competition, Player profile projections |
| **Status** | `MISPLACED` / dual-write risk — Phase 2E decision required |

### Ranking Updated

| Field | Value |
|-------|--------|
| **Event owner** | **Ranking** (VPR / season standings / platform rank programs) |
| **Producer** | `vpr-ranking`, `seasonStandingsService`, Pick_VN rank pipelines |
| **Consumers** | Leaderboards, athlete cards, club summary displays |
| **Source of truth** | Ranking module stores · may **read** Club membership + Player ids |
| **Downstream** | Club UI may display; Club must not recompute platform rank |
| **Status** | `LIVE` for Ranking · Club = consumer only |

---

## 7. Summary matrix

| Event | Owner | SoT (target) | Status |
|-------|-------|--------------|--------|
| Club Created | Club | `public.clubs` | LIVE |
| Club Updated | Club | `public.clubs` | LIVE |
| Member Invited | Club | *(missing)* | MISSING |
| Member Joined | Club | `club_members` | LIVE / PARTIAL |
| Member Left | Club | `club_members` | LIVE |
| Member Removed | Club | `club_members` | LIVE |
| Governance Changed | Club | `club_governance_assignments` | LIVE / PARTIAL |
| Captain Assigned | Club | `club_roster_assignments` (0..N + optional primary) | LEGACY → 2E |
| Coach Assigned | Club | `club_roster_assignments` (0..N) | LEGACY → 2E |
| Team Registered | Competition | Competition team/registration | LIVE (non-Club) |
| Tournament Registered | Competition | Competition | MISPLACED partial in Club |
| Venue Linked | Club + Venue | cluster id on club; courts in Venue | PARTIAL |
| Booking Created | Venue | Venue bookings | MISPLACED in blob |
| Rating Updated | Rating / Competition | Single rating plane TBD | Ambiguous |
| Ranking Updated | Ranking | Ranking stores | LIVE |

---

## 8. Implications for Phase 2

1. Do **not** build UI for Captain/Coach/Invite until cloud SoT exists (Phase 2E).  
2. Treat Tournament/Booking/Rating events as **boundary cutover** work (**Phase 2F**), not Club feature adds in 2C–2E.  
3. Membership + Governance events are Club’s core event bus — certify producers (2C/2D) before Invite/Roster (2E).  
4. Ranking may subscribe to Member Joined/Left later via Notification or domain events — Club should not call Ranking writers.  
5. Captain/Coach cardinality after Phase 2B lock: **0..N**; optional primary Captain only.
