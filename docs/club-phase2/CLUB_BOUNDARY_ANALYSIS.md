# Club Boundary Analysis — Phase 2A

**Status:** Architecture audit (read-only)  
**Official intent:** `docs/player-management/phase-1a/01_MODULE_BOUNDARIES.md`  
**Venue intent:** `docs/venue-court/PHASE_1A_MODULE_BOUNDARY.md`

---

## 1. Principle

Each concern has **one owner**. Other modules may **read or reference**, not redefine.

| Module | Owns |
|--------|------|
| Identity | Login, RBAC, session |
| Player | Person / athlete profile SSOT |
| **Club** | Membership edges, governance, club entity |
| Venue & Court | Courts, bookings, customers |
| Competition | Brackets, matches, competition rating apply |
| Rating / Ranking | Performance measures linked to `player_id` |
| Notification | Delivery channels |
| Finance / Subscription | Ledger / plan limits |

---

## 2. Boundary scorecard

| Peer module | Coupling today | Misplaced in Club? | Risk |
|-------------|----------------|--------------------|------|
| Player Management | High | Yes — player repo + athlete services | High |
| Competition Engine | Medium–High | Partial — tournament create + Elo bridge | High |
| Venue & Court | High (via blob) | Courts/bookings in club blob | High |
| Notification | Low–Medium | Bridge OK; fan-out embedded | Low |
| Ranking / Elo | High | Parallel club-extension Elo | High |
| Finance / Subscription | Low–Medium | `clubId` as finance partition | Medium |

---

## 3. Player Management

### Intended

- Player owns demographics and `player_id`.
- Club stores membership references only.

### Actual

| Direction | Evidence |
|-----------|----------|
| Club → Player | Little direct import of `features/player` services for CRUD; still operates legacy blob players |
| Player → Club | `playerSourceRepository` → `loadPlayersForClub`; `resolveByAuthUser` → Club `canonicalPlayerRepository` |
| Misplaced | `canonicalPlayerRepository.js`, `canonicalPlayerPickerAdapter.js` live under Club; `platformAthleteService`, `accountOnlyAthleteService` in Club |
| UI inversion | `ClubAvatar` imports styles from `pages/player/myClub/` |

### Recommendation

- Relocate canonical player read/write gateways to `src/features/player/`.
- Club consumes Player APIs for pickers and profile hydration.
- Keep membership writes exclusively in Club.

---

## 4. Competition Engine

### Intended

- Competition owns tournament/match engines.
- Club may supply roster pool and receive completion callbacks.

### Actual

| Concern | Location |
|---------|----------|
| Create/list club_internal tournaments | `clubTournamentService.js` (blob) |
| Match completion → club match + club Elo | `clubTournamentBridge.js` ← `tournamentLifecycle.js` |
| Competition Elo writes | `competition-core/rating/*` → `loadClubData` / `saveClubData` |

### Misplaced

- Club module owns too much tournament entity lifecycle.
- Two Elo side-effects on the same completion path (club-extension vs blob).

### Recommendation

- Club exposes **ports**: `getEligibleRoster(clubId)`, `onInternalMatchCompleted(event)`.
- Competition owns tournament CRUD and rating apply.
- Single rating sink decision for internal club matches.

---

## 5. Venue & Court

### Intended

- Venue owns court inventory and bookings (docs).
- Club may register a **court cluster** for activity (`registeredClusterId`).

### Actual

- Court inventory / bookings / customers still in **club blob**.
- Court Engine scoped by `clubId` (`pickleball-court-engine-v1::{clubId}`).
- `venueOwnerClubService` auto-binds venue owners to a writable club.

### Misplaced

- Physical court ops living under Club storage key while governance only needs cluster registration.

### Recommendation

- Phase 2E: extraction plan for courts/bookings out of `club_data_v3`.
- Keep `registeredClusterId` as Club→Venue **reference** only.
- Venue owner ↔ club binding remains a Club concern (tenant provisioning).

---

## 6. Notification

### Actual

- `clubScheduleNotificationBridge.js` → mobile `notificationService.createLocalNotification`.
- Types: `CLUB_SCHEDULE`, `CLUB_ANNOUNCEMENT`.
- Writer registered via `PlatformRuntimeProvider` / `registerClubNotificationWriter`.
- `features/notifications/` (email/SMS/Zalo) — no Club imports found.

### Assessment

- Adapter pattern is acceptable.
- Recipient resolution (V2 members vs blob) is correctly Club-owned.

### Recommendation

- Formalize a Notification **port** (`notifyClubMembers(event)`).
- Avoid embedding channel-specific logic deeper into Club services.

---

## 7. Ranking / Elo / season stats

| System | Path | Relation to Club |
|--------|------|------------------|
| Club-extension Elo | `clubEloService` / `clubRatingService` | Club-owned parallel store |
| Competition / blob Elo | `domain/eloService` → competition-core | Writes club blob players |
| Season standings | `seasonStandingsService` | Club blob leagues |
| Pick_VN | `features/pick-vn-rating` | Sync into club players; Club reads for governance/membership |
| VPR | `features/vpr-ranking` | Links via `clubId` + `playerId` |

### Misplaced

- Club maintaining a second Elo for “Club Ratings” while competition already writes Elo into the same club world.

### Recommendation

- Product decision: Club Ratings tab = view of competition/internal rating **or** separate “friendly Elo” with clear labeling.
- Stop dual-writing without a documented split.

---

## 8. Finance / Subscription

### Subscription

- Club create calls `guardMaxClubs(tenantId)` via `auth/subscriptionGuard.js`.
- Server helper `phase42_check_club_plan_limit` (Phase 42K docs).
- Subscription module does not import Club feature code.

### Finance ledger

- Scoped by `activeClubId` from Club context — partition key only.
- Boundary docs classify debts as **venue commerce**.

### Recommendation

- Keep plan-limit check at Club create (OK).
- Long-term: finance partition by `tenantId`/`venueId` with optional `clubId` tag, not Club module ownership.

---

## 9. Shared substrate risk (highest)

```text
domain/clubStorage.js  →  pickleball-club-data-v3::{clubId}
        ▲
        │ used by Club, Player (legacy), Venue-Court, Court-Engine,
        │ Competition rating, season stats, VPR, Pick_VN sync
```

Until this blob is decomposed, **module boundaries remain aspirational**.

Secondary dual stack:

```text
VITE_CLUB_STORAGE_V2
  ON  → public.clubs / club_members / RPCs
  OFF → local registry + extension + legacy registry RPCs
```

---

## 10. Feature flags (boundary-relevant)

| Flag | Effect |
|------|--------|
| `VITE_CLUB_STORAGE_V2` | Cloud membership/governance SSOT |
| `VITE_CLUB_REGISTRY_CLOUD` | Legacy registry sync (ignored when V2 on) |
| `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED` | Canonical club read gateway |
| `VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED` | Membership-backed player picker |
| `VITE_CLUB_CLOUD_SYNC` | Blob pull/push |
| `VITE_RBAC_ENABLED` | Client authz gates |

---

## 11. UI surface split

| Route family | Audience |
|--------------|----------|
| `/my-club`, `/discover-clubs` | Player / member |
| `/manage/clubs` | Tenant / governance ops |
| `/platform/clubs` | Platform admin |
| `/club` | Legacy ClubManagement ops |

Nav visibility: `clubNavMatrix.js` × governance × membership phase.

---

## 12. Misplaced responsibilities — checklist

| Item | Owner should be | Today |
|------|-----------------|-------|
| Person demographics | Player | Club blob `players[]` |
| Canonical player repository | Player | `features/club/repositories` |
| Court inventory | Venue | Club blob |
| Bookings | Venue | Club blob |
| Tournament engine | Competition | Partial Club services |
| Competition Elo apply | Competition / Rating | Blob + club extension |
| Membership edge | Club | Club (OK; dual store) |
| Governance titles | Club | Club (OK; dual store) |
| Plan max clubs | Subscription + Club gate | OK pattern |
| Notify on schedule | Notification port + Club recipients | Bridge in Club (acceptable) |
