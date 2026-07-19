# Read / Write Ownership — Club Phase 2A

**Status:** Architecture audit (documentation only)  
**Companion:** [EVENT_OWNERSHIP_MATRIX.md](./EVENT_OWNERSHIP_MATRIX.md), [DEPENDENCY_DIAGRAM.md](./DEPENDENCY_DIAGRAM.md)

---

## Legend

| Term | Meaning |
|------|---------|
| **Authoritative writer** | Only module/service allowed to mutate SoT in Production (V2 ON) |
| **Read consumers** | Modules allowed to read (preferably via public API / RPC) |
| **Cache** | Short-lived or client caches that must invalidate on write |
| **Derived projections** | Computed views — never a second SoT |
| **Forbidden writers** | Must not mutate even if technically possible today |

Dual-stack note: when `VITE_CLUB_STORAGE_V2=false`, local writers may apply — **not** Production authority.

---

## 1. Club entity

| Aspect | Owner / detail |
|--------|----------------|
| **Entity** | Club |
| **SoT** | `public.clubs` |
| **Authoritative writer** | Club → `clubTenantService` → `club_create` / `club_update` |
| **Read consumers** | Club UI/registry, ClubContext, membership summary, platform clubs page, venue-owner bind, subscription limit checks (read count) |
| **Cache** | `clubRegistryCache`; ClubContext active club snapshot; canonical club repository (flagged) |
| **Derived projections** | Discovery cards, stats (`getClubStats`), UI `mapV2ClubToUiClub` |
| **Forbidden writers** | `persistClubToCloud`, `club_upsert_registry`, direct `domain/clubService` save after V2 success, silent blob success after RPC failure, peer modules (Player/Competition/Venue) |

---

## 2. Club membership (`club_members`)

| Aspect | Owner / detail |
|--------|----------------|
| **Authoritative writer** | Club → member services → `club_add_member` / `remove` / `restore` / `leave` / review-approve path |
| **Read consumers** | Members UI, nav matrix, notification bridge, tournament invite pool, active membership resolver, Competition eligibility (read) |
| **Cache** | `resolveMyActiveClubMembership` cache; membership context provider |
| **Derived projections** | `active_member_count`, My Club summary, protected-governance member flags |
| **Forbidden writers** | Player Management, Competition, Venue, Ranking, Identity (except auth elevation side-effects on `profiles.role`), direct table writes, extension `members[]` when V2 authoritative |

---

## 3. Membership requests

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | `club_membership_requests_v42` |
| **Authoritative writer** | Club → `clubMembershipRequestService` + V2 submit/cancel/review RPCs |
| **Read consumers** | Discover, My Club requests, governance review queue |
| **Cache** | List probes / review-access probes (UI-level) |
| **Derived projections** | Pending badges (`MembershipRequestBadge`) |
| **Forbidden writers** | Phase 31 RPC client under V2 ON, peer modules, local extension as cloud authority |

---

## 4. Governance assignments

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | `club_governance_assignments` |
| **Authoritative writer** | Club → `clubGovernanceService` + owner/president/VP RPCs (Phase 1B/1C gates) |
| **Read consumers** | Governance UI, `can*` helpers, nav, Identity elevation |
| **Cache** | Embedded on club UI model (`club.governance`); resolved club record hook |
| **Derived projections** | Title chips, elevated `CLUB_MANAGER`, review rights |
| **Forbidden writers** | Venue staff without assigner rights, President assigning Owner, Competition/Player, local-only `updateClubMeta` as Production SoT |

---

## 5. Roster titles (Captain / Coach / Manager)

| Aspect | Owner / detail |
|--------|----------------|
| **SoT today** | Local extension only — **no V2 SoT yet** |
| **SoT target (Phase 2E)** | `club_roster_assignments` — Captain **0..N** (+ optional primary) · Coach **0..N** |
| **Authoritative writer (target)** | Club roster-assignment command plane |
| **Authoritative writer (today)** | Local `updateClubMemberRole` only |
| **Read consumers** | Local members UI → Club UI + Competition optional |
| **Cache** | None cloud yet |
| **Derived projections** | Labels in `CLUB_MEMBER_ROLE_LABELS`; `is_primary` for Captain |
| **Forbidden writers** | Treating local role as cloud truth; Competition inventing captain without Club SoT; enforcing single-Captain/Coach |

---

## 6. Player (person profile)

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | Player Management (`profiles` / player module write path) |
| **Authoritative writer** | Player → profile write repository / services |
| **Read consumers** | Club pickers, membership display names, Competition, Ranking, Venue CRM (separate customer identity) |
| **Cache** | Player resolution caches; Club `canonicalPlayerRepository` (**mis-homed**) |
| **Derived projections** | Picker rows, athlete cards, `clubMembershipReferences` on profile (reference list) |
| **Forbidden writers** | Club inventing new person SSOT; Competition rewriting demographics; Club blob `players[]` as Production person SoT |

**Club may write:** membership **edges** referencing `player_id` / `user_id` only.

---

## 7. Invitation (outbound)

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | — missing |
| **Authoritative writer** | — |
| **Forbidden writers** | All (entity does not exist). Tournament invite list is **not** an invitation writer. |

---

## 8. Committee

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | — missing |
| **Authoritative writer** | — |
| **Forbidden writers** | All until product GO + schema |

---

## 9. Team / registration (competition)

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | Competition Core registrations / teams |
| **Authoritative writer** | Competition |
| **Read consumers** | Tournament UI, adapters, Club (roster check only) |
| **Cache** | Resolver caches inside competition-core |
| **Derived projections** | Lineups, brackets |
| **Forbidden writers** | Club creating team SoT; Club mutating registration identity |

---

## 10. Tournament

| Aspect | Owner / detail |
|--------|----------------|
| **SoT (target)** | Competition / tournament domain |
| **Authoritative writer (target)** | Competition |
| **Authoritative writer (today, club_internal)** | **Partial Club** via `clubTournamentService` → club blob |
| **Read consumers** | Club tournaments tab, Director, lifecycle |
| **Derived projections** | Club extension matches via `clubTournamentBridge` |
| **Forbidden writers (target)** | Club blob tournament CRUD; Club Elo as second competition rating |

---

## 11. Venue link (registered cluster)

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | Club field `registered_cluster_id` (+ legacy court id list) |
| **Authoritative writer** | Club (governance/update) |
| **Read consumers** | Club summary, venue staff views |
| **Forbidden writers** | Venue rewriting club governance; Club inventing court inventory |

---

## 12. Court inventory & bookings

| Aspect | Owner / detail |
|--------|----------------|
| **SoT (target)** | Venue & Court |
| **Authoritative writer (target)** | Venue & Court |
| **Authoritative writer (today)** | Often club blob via venue-court services (`loadCourtsForClub`, bookings) — **misplaced** |
| **Read consumers** | Court Engine, scheduling, Finance |
| **Cache** | Court-engine per `clubId` keys |
| **Forbidden writers (target)** | Club feature services; Competition (except `match.courtId` reference) |

---

## 13. Rating

| Aspect | Owner / detail |
|--------|----------------|
| **SoT (target)** | One plane per product surface (Competition internal vs platform) — **decision pending** |
| **Writers today** | Club extension Elo · Competition blob Elo · Pick_VN sync · verification services |
| **Read consumers** | Club Ratings tab, Statistics, membership UI, VPR |
| **Derived projections** | Rating history (extension), season points (separate) |
| **Forbidden writers (target)** | Multiple modules writing the same player rating without contract; Club writing platform rank |

---

## 14. Ranking

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | Ranking modules (VPR / season standings / platform) |
| **Authoritative writer** | Ranking |
| **Read consumers** | Leaderboards, Club display (read-only) |
| **Cache** | Ranking feature caches |
| **Derived projections** | Public rank cards |
| **Forbidden writers** | Club, Venue, Notification |

---

## 15. Notification

| Aspect | Owner / detail |
|--------|----------------|
| **SoT** | Notification / mobile notification store |
| **Authoritative writer** | Notification service (`createLocalNotification` etc.) |
| **Producer adapter** | Club `clubScheduleNotificationBridge` (allowed to **call** writer, not own store) |
| **Read consumers** | Mobile shell, role-filtered notification lists |
| **Forbidden writers** | Club writing foreign notification tables directly; Ranking/Finance bypassing notification API |

---

## 16. Finance / subscription

| Aspect | Detail |
|--------|--------|
| **Subscription limits** | Subscription owns plan rules; Club create **reads** guard (`guardMaxClubs`) — Club must not redefine plan math |
| **Finance ledger** | Finance owns ledger; may key by `clubId` today — **forbidden** for Club to post ledger entries |
| **Payment events** | Payments / tenant — not Club |

---

## 17. AI

| Aspect | Detail |
|--------|--------|
| **SoT** | AI assistant / scheduling engines (feature-flagged) |
| **Authoritative writer** | AI module for its own artifacts |
| **Allowed** | AI **reads** Club roster / courts via published ports |
| **Forbidden** | AI writing membership, governance, or club entity; Club embedding AI engine ownership |

---

## 18. Cross-cutting: club blob (`club_data_v3`)

| Aspect | Detail |
|--------|--------|
| **Role today** | Shared operational mega-store |
| **Authoritative for Club V2 entity?** | **No** |
| **Writers today** | Many modules (Club ops, Competition rating, Venue courts, season stats, …) |
| **Phase 2 stance** | Treat as **legacy shared disk**, not module SoT; forbid new SoT claims on blob fields already owned elsewhere |

---

## 19. Quick “who may write?” cheat sheet

| Entity / concern | May write | Must not write |
|------------------|-----------|----------------|
| Club row | Club RPC path | Everyone else |
| Membership edge | Club RPC path | Player, Competition, Venue |
| Governance title | Club RPC path | Venue manager without assigner rights |
| Person profile | Player | Club (except legacy blob debt) |
| Team / registration | Competition | Club |
| Booking | Venue | Club |
| Platform ranking | Ranking | Club |
| Notification record | Notification | Club (except via API) |
| Plan limit definition | Subscription | Club |
| Captain/Coach (cloud) | Club roster RPCs (2E) · 0..N | Local role field; single-* enforcement |

---

## 20. Cache invalidation expectations (target)

After successful authoritative write:

| Write | Invalidate |
|-------|------------|
| Club create/update | Registry cache, resolved club record |
| Membership join/leave/remove | Active membership cache, member lists, nav scope |
| Governance change | Governance UI model, elevation, review probes |
| Membership request review | Pending lists, badges |
