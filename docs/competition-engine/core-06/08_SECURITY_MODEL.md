# CORE-06 — Security Model (Phase 1B Scope Freeze)

**Status:** Documentary freeze from Phase 1A security/privacy findings + TT-1B/TT-2/TT-3 behavior  
**Rule:** Fail closed. Never trust UI for opponent selections or mutations.

---

## 1. Actor classes

| Actor | Typical identity / role | Lineup powers |
|-------|-------------------------|---------------|
| **Captain** | Team captain (own team) | Draft / submit / withdraw (pre-lock) on own team |
| **Manager** | Team manager / deputy (Format-defined) | Same as captain within team scope when authorized |
| **Tournament Director (BTC)** | Competition admin | Lock, publish, randomize, override; elevated override after start |
| **Referee** | Assigned match official | **Read** published lineups for assigned matchups only |
| **Automation (System)** | Deadline expire / randomize-at-lock | Explicit `SYSTEM` actor; lock/void/randomize only as policy allows |
| **Player (non-captain)** | Roster member | No lineup mutation by default |

Permission code alignment (existing identity constants):

- `team.lineup.submit` / `lock` / `publish` / `randomize` / `override`
- `team_lineup.view` / `submit` / `update_before_lock` / `approve` / `lock`

Core `LineupAuthorizationPort` must align to these codes — not invent a parallel permission universe.

---

## 2. Captain permissions

| Allowed | Denied |
|---------|--------|
| `save_draft` / `submit` on **own** team before lock | Any edit after `LOCKED` / `PUBLISHED` |
| Withdraw (`void`) while `DRAFT` / `SUBMITTED` | Opponent lineup view before publish |
| View own selections | Override, lock, publish, randomize (unless also Manager/TD) |

Scope: captain_scope_denied on cross-team attempts (TT-2C code).

---

## 3. Manager permissions

| Allowed | Notes |
|---------|-------|
| Same draft/submit as captain for managed team | Format defines manager vs captain |
| May assist BTC workflows when TT `can_manage` | Product-specific |
| Not a substitute for TD override after matchup start | Elevated rules apply |

---

## 4. Tournament Director (BTC)

| Allowed | Notes |
|---------|-------|
| Lock / publish / randomize | Matchup ops |
| Override locked or published | Mandatory reason; TT-3 |
| Elevated override after matchup started | Super-admin / `tournament.update` class; reason length ≥15 (TT-3) |
| Blocked if any sub-match result confirmed | `lineup_override_blocked_confirmed_result` |

Captain blocked from edit while `requires_republish` after override.

---

## 5. Referee

| Allowed | Denied |
|---------|--------|
| View published lineup for **assigned** matchups | Pre-publish opponent (or any) lineup |
| — | Mutate lineup |
| — | Proceed when `requiresRepublish` (product gate) |

---

## 6. Automation (System)

| Action | When |
|--------|------|
| `expire` → Core `VOIDED` | Deadline / policy |
| `randomize` → fill + `LOCKED` | Missing lineup at lock |
| Actor must be explicit `SYSTEM` | Audited |

No silent privilege escalation via client clocks.

---

## 7. Visibility rules

| Rule | Behavior |
|------|----------|
| Opponent hidden pre-reveal | Selections null until both sides published (Format policy) |
| Own team | Visible to authorized captain/manager/TD |
| Re-hide on override | After override of published lineup, opponent hidden until republish |
| Realtime | Must not leak selections outside VisibilityPort rules |
| Server SoT | `LineupVisibilityPort` / TT `get_visible_lineups` — UI never authoritative |

Risk **R-05**: visibility leak under dual-write/shadow — Critical; shadow must compare redaction parity.

---

## 8. Deadline rules

| Rule | Behavior |
|------|----------|
| Server time SoT | `LineupClockPort` / TT server now |
| Client countdown | UX only — not authorization |
| Past deadline | Captain submit/draft denied; BTC/System may lock/randomize per policy |
| Error codes (TT) | `deadline_passed`, `lineup_locked` |

---

## 9. Override rules

| Case | Rule |
|------|------|
| Locked, matchup not started | BTC with override permission + reason |
| Matchup started, no confirmed result | Elevated role + longer reason |
| Any confirmed sub-match | Block override |
| Effect | Prior revision `SUPERSEDED`; new revision; audit + version + idempotency |
| Visibility | `requires_republish` until publish |

Captain cannot override. Referee cannot override.

---

## 10. Tenant isolation

| Rule | Behavior |
|------|----------|
| Cross-tenant | Denied (`cross_tenant_denied`) |
| Competition mismatch | Fail closed |
| Team scope | Captain/manager limited to own `teamId` |
| RLS / RPC | Production enforcement remains TT until Core persistence cutover |

Core authz predicates must include `tenantId` + `competitionId` + `teamId` + `contextId`.

---

## 11. Audit requirements

Every successful mutation (and denied elevated attempt where product requires) must record:

- Actor id + role (`CAPTAIN` / `BTC` / `SYSTEM` / …)
- Action
- From status → to status
- Lineup identity key / id
- Revision / expectedVersion
- Reason (required for override)
- Idempotency / request id
- Timestamp (server)

TT today: `team_tournament_lineup_revisions` + audit writers. Core `AuditPort` must be capable of equivalent evidence before write cutover.

---

## 12. Concurrency & idempotency (security-adjacent)

| Control | Requirement |
|---------|-------------|
| Optimistic lock | `expectedVersion` / revision — conflict fails closed |
| Idempotency | Same key + payload → safe replay; mismatch → conflict |
| Client trust | Never trust client-sent player gender/team scope for cloud mutation |

---

## 13. Phase 1B non-goals

- No RLS/SQL changes
- No authz implementation
- No permission catalog edits
- Documentary freeze only
