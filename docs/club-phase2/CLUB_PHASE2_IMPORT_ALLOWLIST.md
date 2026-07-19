# Club Phase 2B — Import Allow-List

**Status:** FROZEN / **LOCKED** (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Phase status:** 2A CLOSED · 2B LOCKED · Next: **2C** (not started)  
**Related:** [DEPENDENCY_DIAGRAM.md](./DEPENDENCY_DIAGRAM.md), [CLUB_PHASE2_API_FREEZE.md](./CLUB_PHASE2_API_FREEZE.md)

---

## 1. Global rules

1. Peer modules import **only** from Club **public** APIs / ports listed below (eventually `src/features/club` public barrel subsets or explicit `ports/`).  
2. **No** peer may import Club internal services for mutation.  
3. **No** peer may read/write `pickleball-club-data-v3::*` / `club_data_v3` for Club-owned concerns **after cutover** (Phase 2G). During transition, blob access is debt tracked in writer policy — not an allow-list right.  
4. **No** peer may call Supabase Club tables with direct INSERT/UPDATE/DELETE.  
5. **No** peer may call Phase 31 / legacy registry writers.  
6. Raw `rpcV2*` exports are **transitional**; peers should not depend on them long-term.

---

## 2. Allow-list by module

### 2.1 Player

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| `club.get` (own club context) | **None** against Club SoT | Write membership / governance / invitations |
| Membership **references** about self (`resolveMyActive…` style reads) | | Direct blob player rows as person SoT |
| | | Hosting Club’s canonical membership writers |

**Rule:** Player owns person profile. Player **must not** write Club-owned membership state. Club will call Player for person hydration; Player may call Club **reads** for “my clubs”.

---

### 2.2 Competition

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| `membership.listActiveRoster` | **None** | Write membership or governance |
| `governance.get` (officer refs) | | Write invitations / join requests |
| `roster.listCaptains` / `listCoaches` (optional) | | Direct club blob tournament/membership writes as Club SoT |
| `club.get` (clubId scope) | | |

**Rule:** Competition may read active roster and governance references. Competition may **not** write Club membership or governance. Tournament/match SoT stays in Competition.

**Transitional debt:** `clubTournamentBridge` / blob tournament create under Club — remove under Phase 2F; not an allow-list grant.

---

### 2.3 Notification

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| Recipient resolution via Club **read** helpers / events | **None** on Club SoT | Mutate Club entities |
| Event payloads: schedule/gov/invite/membership | | Direct table access |

**Rule:** Notification **consumes Club events** (or is invoked by Club bridge) and **does not mutate Club**.

---

### 2.4 Subscription / Billing (Finance plan limits)

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| Club count / plan check inputs as defined by Subscription APIs | **None** on Club SoT | Membership/governance writes |
| | Club may call Subscription `guardMaxClubs` on create | Ledger posts keyed as Club ownership |

**Rule:** Subscription owns plan math. Club create **reads** guard. Billing does not own Club domain.

---

### 2.5 Ranking

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| `club.get`, active membership existence, roster ids (privacy-safe) | **None** | Any Club mutation |
| Captain/Coach lists optional | | Club blob as ranking SoT |

**Rule:** Ranking is **read-only** toward Club.

---

### 2.6 AI

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| Same read class as Ranking (roster size, officers, club metadata) | **None** | Persist Club SoT |
| | | Bypass authz |

**Rule:** AI is **read-only** toward Club.

---

### 2.7 Venue

| Allowed reads | Allowed commands | Forbidden |
|---------------|------------------|-----------|
| `club.get` (registered_cluster_id / venue binding) | **None** on Club membership/governance | Write Club blob fields (courts/bookings/players) after cutover |
| Member **summary** only if venue staff ≠ club owner (existing privacy matrix) | Link updates happen via **Club** `club.update` / governance by authorized Club actors | Assign Owner/President |
| | | Direct `club_members` writes |

**Rule:** Venue may **link venue references** (cluster/courts owned by Venue). Venue must **not** write Club blob fields. Club stores only `registered_cluster_id` (and legacy court id list until retired).

---

## 3. Club → peer (outbound) allow-list

Club **may** call:

| Peer | Purpose |
|------|---------|
| Player | Resolve/hydrate person for members, invitees, officers |
| Notification | Deliver club events |
| Subscription | `guardMaxClubs` / plan limits |
| Identity | Role elevation / permission checks |

Club **must not** call Ranking/AI writers. Club **must not** own Venue booking APIs.

---

## 4. Cutover rule — blob

| Phase | Peer blob access |
|-------|------------------|
| Now (dual-stack) | Exists as debt; not endorsed |
| After 2F plans | Replacement ports required |
| After 2G | **Forbidden:** “No peer module may read legacy Club blob directly after cutover.” |

---

## 5. Enforcement (documentation expectation for later code)

- Prefer lint/path allow-lists or ARCHITECTURE.md import rules in implementation phases.  
- Code review checklist: reject new `loadClubData` / `saveClubData` from non-Venue/Competition transitional owners without ticket.  
- Reject new peer imports of `clubGovernanceService` mutation exports.

**Import allow-list is LOCKED for Phase 2B exit.**
