# TT-6A — Subscription Scope Design

**Date:** 2026-07-13  
**Status:** Design specification

---

## 1. Principles

1. **Smallest scope** that satisfies the role's UI needs.
2. **RLS is authoritative** — Realtime filter is defense-in-depth, not primary security.
3. **One channel per scope key** — ref-counted; shared across components.
4. **No table-wide subscriptions** for TT domain tables.

---

## 2. Role matrix

### 2.1 BTC / Director / Organizer (`team_tournament_can_manage()`)

| Subscription | Scope key | Events needed | Channel filter (proposal) |
|--------------|-----------|---------------|---------------------------|
| `subscribeTournament` | `{tenantId}:{tournamentId}` | Matchup status, standings version, tournament version | Tournament header + aggregate version signal (see SQL proposal) |
| `subscribeMatchup` | `{tenantId}:{matchupId}` | Lineup lock/publish, sub-match results | `team_tournament_matchups.id=eq.{id}` |
| `subscribeSubMatch` | `{tenantId}:{subMatchId}` | Sub-match score/status | `team_tournament_sub_matches.id=eq.{id}` |
| Bridge state | via sub-match scope | provision/revoke/sync_error | `team_sub_match_referee_links.sub_match_id=eq.{id}` |

**Receives:** All lineups (including pre-publish), all bridge states, correction workflow signals (via setup reload).

### 2.2 Team Captain

| Subscription | Scope | Allowed events | Restrictions |
|--------------|-------|----------------|--------------|
| Own team lineup | `{tenantId}:{matchupId}:{ownTeamId}` | draft/submit confirmations | Own mutations + server ack |
| Matchup status | `{tenantId}:{matchupId}` | lock/publish/complete | No opponent lineup pre-publish |
| Opponent lineup | **None via Realtime pre-publish** | `lineup.published` only | Reload via `get_visible_lineups` after publish event |

**Captain A must NOT receive Captain B lineup selections before publish.**

Implementation:

- Realtime on lineup rows uses RLS policy: captain sees **only own team row** until matchup `status >= published`.
- On `lineup.published` event → captain calls `getVisibleLineups(matchupId)` — server returns both sides.

**Do not** publish raw lineup table broadly with client-side hide.

### 2.3 Referee (assigned)

| Subscription | Scope | Filter |
|--------------|-------|--------|
| `subscribeRefereeMatch` | `{externalSubMatchId}` | Existing V5: `match_live_states.id=eq.{stateId}` |
| Assignment gate | same | RLS: active, non-expired, non-revoked assignment |

**Receives:** Live match state hints only for assigned match. No other tournament rows via Realtime.

**Expired/revoked:** RLS denies → channel silent → access guard RPC returns blocked → UI degraded/polling stops.

### 2.4 Generic player / spectator

| Subscription | Scope |
|--------------|-------|
| Published matchup results | Optional read-only tournament scope |
| Lineups | **No Realtime** — use public setup RPC if ever exposed |
| Referee payload | **Never** |

Default: polling/public bracket paths only — out of TT-6B MVP unless owner expands.

---

## 3. Scope API mapping

```text
subscribeTournament(tenantId, tournamentId, handlers)
  → registers ref-count on tt:{tenantId}:{tournamentId}
  → handlers: onTournamentChange, onStandingsChange, onMatchupChange (coarse)

subscribeMatchup(tenantId, tournamentId, matchupId, handlers)
  → tt:matchup:{tenantId}:{matchupId}
  → handlers: onMatchupChange, onLineupChange (filtered by RLS)

subscribeSubMatch(tenantId, tournamentId, subMatchId, handlers)
  → tt:sub:{tenantId}:{subMatchId}
  → handlers: onMatchupChange (sub-match slice)

subscribeRefereeMatch(tenantId, tournamentId, externalSubMatchId, handlers)
  → refereeV5Adapter → existing V5 channel
  → handlers: onRefereeMatchChange (version bump)
```

---

## 4. Subscription registry rules

| Rule | Behavior |
|------|----------|
| Duplicate subscribe same scope | Increment ref-count; share one channel |
| Last unsubscribe | `removeChannel` + clear timers |
| Tab hidden | Keep channel; pause polling coordinator only |
| Role change / logout | `unsubscribeAll()` + clear dedupe store |
| Tournament switch | Unsubscribe old tournament scopes before new |

---

## 5. Tables — subscribe vs never

| Table | Subscribe? | Role filter |
|-------|------------|-------------|
| `team_tournament_sub_matches` | YES (scoped) | Tenant + participation RLS |
| `team_tournament_matchups` | YES (scoped) | Tenant + role RLS |
| `team_tournament_lineups` | YES (scoped) | **Captain own row only** pre-publish |
| `team_sub_match_referee_links` | YES (scoped) | BTC manage + assigned referee read |
| `referee_assignments` | YES (scoped) | Own assignment rows |
| `match_live_states` | YES (V5 existing) | Assignment RLS |
| `team_tournament_standings_cache` | Optional version row | Read via manage/participant |
| `match_integration_outbox` | **NEVER client** | service_role only |
| `team_tournament_referee_event_inbox` | **NEVER client** | service_role only |
| `team_tournament_command_log` | **NEVER client** | internal audit |

---

## 6. Lineup visibility flow (Captain)

```text
Pre-publish:
  Captain A subscribes matchup scope
  → receives lineup events for team A row only (RLS)
  → opponent events NOT delivered

Publish transition:
  → matchup.status = published (WAL event)
  → envelope eventType = lineup.published
  → both captains call getVisibleLineups
  → server returns both lineups

Post-publish:
  → sub-match / V5 events via normal scopes
```

---

## 7. Bridge / provision scope (BTC + referee)

| Actor | Bridge events | Mechanism |
|-------|---------------|-----------|
| BTC | provision, revoke, reprovision_required, sync_error | sub-match link row subscription OR tournament reload |
| Referee | link status `live/finalized` only | access guard + optional link row (read-only) |

Provision UI (`TeamSubMatchRefereeProvisionRow`) continues manual actions; Realtime triggers resync banner — TT-6B wiring.

---

## 8. Anti-patterns (explicitly forbidden)

- `filter: tenant_id=eq.X` without tournament/matchup predicate on lineup tables
- Subscribing to all sub-matches in club
- Sharing director `match-live-{clubId}-{tournamentId}` channel for TT sub-matches
- Client `viewerTeamId` parameter trusted for Realtime filter (cloud repo already rejects — keep same)

---

## 9. Acceptance

| Criterion | Status |
|-----------|--------|
| BTC scope documented | YES |
| Captain scope documented | YES |
| Referee scope documented | YES |
| No whole-table subscribe | YES |
| Aligns with repository interface | YES |
