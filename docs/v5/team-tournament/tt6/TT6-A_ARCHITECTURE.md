# TT-6A — Target Realtime Architecture

**Date:** 2026-07-13  
**Status:** Design proposal — **not implemented in TT-6A**

---

## 1. Design goal

One client-side boundary for all Team Tournament + integrated Referee V5 live updates. Pages **must not** call `supabase.channel()` directly.

**Proposed name:** `TeamTournamentRealtimeService`  
**Location (TT-6B):** `src/features/team-tournament/realtime/`

Referee V5 keeps its specialized match-scoped stack but exposes a **thin adapter** implementing the same connection-state and reload contract.

---

## 2. Layer diagram

```text
┌─────────────────────────────────────────────────────────────┐
│ Pages: TeamPortal, TeamTournamentSetup, TeamRefereePortal,  │
│        RefereeV5TeamMatchPage (via adapter)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ TeamTournamentRealtimeService (singleton per tab)           │
│  - subscribeTournament / subscribeMatchup / ...             │
│  - connection state machine                                 │
│  - dedupe + version gate                                    │
│  - polling fallback coordinator                             │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
    ┌───────────▼──────────┐   ┌──────────▼──────────┐
    │ TT postgres_changes   │   │ RefereeV5Realtime   │
    │ (scoped publications) │   │ Adapter (existing)  │
    └───────────┬──────────┘   └──────────┬──────────┘
                │                         │
    ┌───────────▼─────────────────────────▼──────────┐
    │ Snapshot reload RPCs (authoritative)            │
    │  - team_tournament_get_setup                    │
    │  - team_tournament_get_visible_lineups          │
    │  - team_tournament_referee_match_access_ops     │
    │  - Edge get-state (Referee V5)                  │
    └─────────────────────────────────────────────────┘
```

**Rule:** Realtime notification → enqueue reload → snapshot RPC → render. Never apply WAL row as domain state.

---

## 3. Public contract

```typescript
// Conceptual — TT-6B implementation
interface TeamTournamentRealtimeService {
  subscribeTournament(tenantId, tournamentId, handlers): SubscriptionHandle;
  subscribeMatchup(tenantId, tournamentId, matchupId, handlers): SubscriptionHandle;
  subscribeSubMatch(tenantId, tournamentId, subMatchId, handlers): SubscriptionHandle;
  subscribeRefereeMatch(tenantId, tournamentId, externalSubMatchId, handlers): SubscriptionHandle;

  unsubscribe(handle): void;
  reconnect(scope?): void;
  refreshSnapshot(scope, reason): Promise<SnapshotResult>;
  getConnectionState(scope?): RealtimeConnectionState;
}
```

### 3.1 `SubscriptionHandle`

```typescript
{
  id: string;           // internal subscription id
  scope: SubscriptionScope;
  unsubscribe(): void;
  getConnectionState(): RealtimeConnectionState;
}
```

### 3.3 Handlers (extend repository types)

Reuse `TournamentSubscriptionHandlers` from `teamTournamentRepositoryTypes.js` plus:

- `onBridgeChange` — provision/revoke/reprovision_required
- `onAssignmentChange` — referee assignment lifecycle
- `onConnectionChange` — unified state machine

Each handler receives a **normalized envelope** (see `TT6-A_EVENT_CONTRACT.md`), not raw Supabase payload.

---

## 4. Internal modules (TT-6B)

| Module | Responsibility |
|--------|----------------|
| `realtimeService.js` | Facade + subscription registry |
| `subscriptionRegistry.js` | Ref-count channels; one channel per scope key |
| `channelFactory.js` | Build `postgres_changes` filters from scope |
| `eventNormalizer.js` | WAL row → envelope |
| `dedupeStore.js` | `eventId` + `entityVersion` memory (per tab) |
| `connectionStateMachine.js` | Unified states (see reconnect doc) |
| `pollingCoordinator.js` | Single poll timer per scope — no duplicate with realtime |
| `refereeV5Adapter.js` | Wrap `subscribeRefereeMatchRealtime` |
| `observability.js` | Metrics hooks (see observability plan) |

---

## 5. Channel naming convention (proposed)

| Scope | Channel name pattern | WAL filter |
|-------|---------------------|------------|
| Tournament | `tt:{tenantId}:{tournamentId}` | Narrow — see SQL proposal |
| Matchup | `tt:matchup:{tenantId}:{matchupId}` | Matchup row UPDATE |
| Sub-match | `tt:sub:{tenantId}:{subMatchId}` | Sub-match summary UPDATE |
| Referee match | `referee-v5:match:{externalSubMatchId}` | **Existing** — no rename in TT-6B |
| Bridge | `tt:bridge:{tenantId}:{subMatchId}` | Link row UPDATE |

**Never:** club-wide or tenant-wide unfiltered subscriptions for TT.

---

## 6. Relationship to repository

`cloudTeamTournamentRepository.subscribeTournament()` becomes a **thin delegate**:

```text
subscribeTournament(clubId, tournamentId, handlers)
  → TeamTournamentRealtimeService.subscribeTournament(...)
  → returns { unsubscribe, fallbackMode: 'realtime', pollingIntervalMs: degradedOnly }
```

When Realtime unavailable at startup (flag off, anon, blob provider):

- Return `fallbackMode: 'polling'` with `REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs` (5000).
- Service still owns the timer — not duplicated in `useTeamTournamentPage`.

---

## 7. Referee V5 integration

**Do not reimplement** Referee V5 match sync. `refereeV5Adapter.js`:

1. Calls existing `subscribeRefereeMatchRealtime`.
2. Maps Referee V5 connection states → unified enum.
3. Emits envelopes with `source: 'referee_v5'` on reload-required.
4. TT pages listening to sub-match scope receive bridge/propagation hints from TT channels; referee workspace uses adapter directly.

**Ownership unchanged:** Official result still V5 revision → outbox → consumer.

---

## 8. Legacy match-live (director)

**Out of TT-6B initial scope.** Document as **deprecated path** for Team Tournament integration.

Director Mode may continue using `matchLiveSync` until a separate migration phase. TT-6 must **not** add new dependencies on `tournament_match_live` Realtime for team sub-matches.

---

## 9. Feature flags (TT-6B)

| Flag | Default | Effect |
|------|---------|--------|
| `VITE_TT_REALTIME_ENABLED` | `false` | Master switch for TT Realtime |
| `VITE_REFEREE_V5_REALTIME_ENABLED` | existing | Referee adapter |
| `VITE_TT_REALTIME_DEGRADED_POLL_MS` | `5000` | Fallback interval |

When `VITE_TT_REALTIME_ENABLED=false`: service operates in polling-only mode with same API (no channel creation).

---

## 10. Non-goals (TT-6A / frozen)

- Changing TT-5 result ownership
- Incremental standings calculation on client
- Offline command queue production rollout
- Supabase `broadcast()` for lineup payloads
- Wiring pages (TT-6B)

---

## 11. Architecture acceptance criteria (for TT-6B entry)

| Criterion | This doc |
|-----------|----------|
| Single boundary | YES — `TeamTournamentRealtimeService` |
| No page-level channels | YES — enforced via repository delegate |
| Snapshot reload pattern | YES — same as V5-E1 |
| Referee V5 reuse | YES — adapter, not rewrite |
| Legacy isolation | YES — director path unchanged |
