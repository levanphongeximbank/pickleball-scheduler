# TT-6A — Current State Realtime Audit

**Date:** 2026-07-13  
**Branch:** `feature/tt6-realtime-sync`  
**Base SHA:** `63d757118499195688dbb82d121bd98382e31e40`  
**Production impact:** NONE (read-only audit)

---

## 1. Executive summary

| Area | Realtime status | Primary mechanism |
|------|-----------------|-------------------|
| **Referee V5** | **Implemented** (staging) | `postgres_changes` on `match_live_states` + Edge reload |
| **Team Tournament** | **Not implemented** | 5s HTTP polling via `useTeamTournamentPage` |
| **Legacy director** | Partial | `postgres_changes` on `tournament_match_live` (club filter) |
| **Legacy referee token** | Poll only | 4s RPC poll |
| **Court Engine** | Separate stack | Dual `postgres_changes` + 15s poll |
| **TT-5 result propagation** | Server-only | Outbox consumer — clients see updates on poll |

**Competing realtime frameworks today: 4** (Referee V5, legacy match-live, Court Engine, Team Tournament polling-as-fallback). **Zero Supabase `broadcast()` usage** anywhere in `src/`.

---

## 2. Referee V5 (production-grade)

### 2.1 Channel creation (direct)

| File | Channel name | Filter | Events | Cleanup |
|------|--------------|--------|--------|---------|
| `src/features/referee-v5/realtime/refereeV5RealtimeChannel.js` | `referee-v5:match:{matchId}` | `match_live_states.id=eq.{matchStateId}` | UPDATE | `removeChannel`, clear poll/reconnect timers, `disposed` flag |

**Auth:** `getSupabaseAuthClient()` — JWT + RLS.

**Notification handling:** Metadata only (`state_version`, `match_id`, etc.). **Never** applies `state_payload` from WAL row.

### 2.2 Logic layer

| File | Role |
|------|------|
| `src/features/referee-v5/realtime/realtimeSyncLogic.js` | Version gating, reconnect backoff (1s→30s cap), poll enable rules, mutation block |
| `src/features/referee-v5/hooks/useRefereeRealtimeSync.js` | React lifecycle, reload orchestration, `reloadInFlightRef` |
| `src/features/referee-v5/hooks/useRefereeRemoteMatchController.js` | Wires sync; `mutationsBlocked` when disconnected |
| `src/features/referee-v5/constants/realtimeConnectionStates.js` | States + `buildRefereeMatchChannelName` + `extractRealtimeNotification` |

### 2.3 Reconnect / polling

- **Reconnect:** Exponential backoff, remove + re-attach channel on `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`.
- **Poll fallback:** 8s interval when realtime unhealthy; cleared on `SUBSCRIBED`.
- **Dedupe:** `lastReloadVersion`, `shouldReloadFromNotification` (stale/duplicate skip).

### 2.4 Feature flag

`VITE_REFEREE_V5_REALTIME_ENABLED` + `VITE_REFEREE_V5_DATA_MODE=remote` (`flags.js`).

### 2.5 Docs / SQL (staging)

- `docs/v5/referee-v5/V5-E1_REALTIME_ARCHITECTURE.md`
- `docs/v5/referee-v5/V5-E1_REALTIME_SECURITY.md`
- `docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql` — adds `match_live_states` to `supabase_realtime`

---

## 3. Team Tournament (polling only)

### 3.1 Primary refresh hook

| File | Mechanism |
|------|-----------|
| `src/features/team-tournament/ui/useTeamTournamentPage.js` | **5s `setInterval`** → `reload({ silent: true })`; pauses when `document.hidden`; reload on visibility return |

**Consumers (pollingEnabled: true):**

- `src/pages/tournament/TeamPortal.jsx`
- `src/pages/tournament/TeamTournamentSetup.jsx`
- `src/pages/tournament/TeamRefereePortal.jsx`

### 3.2 Repository subscription stub

| File | Behavior |
|------|----------|
| `TeamTournamentRepository.interface.js` | Defines `subscribeTournament(handlers)` contract |
| `cloudTeamTournamentRepository.js` | Returns `notImplementedSubscriptionResult()` |
| `blobTeamTournamentRepository.js` | Same stub |
| `shadowTeamTournamentRepository.js` | Delegates to cloud stub |
| `teamTournamentRepositoryValidation.js` | Code `REPOSITORY_REALTIME_NOT_IMPLEMENTED` + polling hint |
| `teamTournamentRepositoryTypes.js` | `REPOSITORY_REALTIME_FALLBACK`: `{ fallbackMode: "reload", pollingIntervalMs: 5000 }` |

**Handlers designed but unwired:** `onTournamentChange`, `onMatchupChange`, `onLineupChange`, `onStandingsChange`, `onError`.

### 3.3 TT-5 server propagation (no client push)

| Component | Path |
|-----------|------|
| Outbox | `match_integration_outbox` (Referee V5 emits) |
| Consumer | `team_tournament_consume_referee_v5_outbox` (service_role) |
| Inbox dedupe | `team_tournament_referee_event_inbox` (`outbox_event_id` + `payload_hash`) |
| Standings | `team_tournament_recompute_standings_cache` |

Clients observe V5-finalized results on **next poll reload** — not via Realtime.

### 3.4 Bridge / assignment (no realtime)

- `teamRefereeV5BridgeEngine.js` — identity/routing helpers
- `teamRefereeV5SafetyEngine.js` — access guard client helpers
- `TeamSubMatchRefereeProvisionRow.jsx` — manual provision/resync UI

No Supabase channels for bridge state, assignments, or corrections.

### 3.5 UI timers (not data sync)

| File | Interval | Purpose |
|------|----------|---------|
| `useLineupDeadlineClock.js` | 1s | Countdown display |
| `CaptainPortalSummary.jsx` | 1s | Captain deadline display |

---

## 4. Legacy tournament match-live

### 4.1 Director path (direct channel)

| File | Channel | Filter | Risk |
|------|---------|--------|------|
| `src/domain/matchLiveSync.js` → `subscribeTournamentMatchLive` | `match-live-{clubId}-{tournamentId}` | `club_id=eq.{clubId}` only | Tournament scoped **client-side** — potential cross-tournament row delivery within club |
| `src/tournament/useMatchLiveScores.js` | Uses above | Merges by `matchId` | Consumer hook |
| `src/features/tournament/director/hooks/useDirectorState.js` | Consumer | — | — |
| `src/features/tournament/director/hooks/useDirectorSync.js` | Watches `liveByMatchId` | Dedupe via `processedIdsRef` Set | Finalize queue |

### 4.2 Legacy referee token path

| File | Mechanism |
|------|-----------|
| `matchLiveSync.js` → `subscribeMatchLiveByToken` | **4s RPC poll** — no Realtime |
| `src/pages/referee/RefereeScoreboard.jsx` | Poll consumer |

---

## 5. Court Engine (out of TT-6 scope but duplicate pattern)

| File | Channel | Filter |
|------|---------|--------|
| `src/features/court-engine/storage/courtEngineRealtime.js` | `court-engine-rt-{tenantId}-{clubId}` | `tenant_id=eq.{tid}` on two tables |
| `src/features/court-engine/hooks/useCourtEngine.js` | Realtime + **15s poll** (30s hidden) | Debounced 250ms pull |

---

## 6. Inventory summary

### 6.1 Files that create Supabase channels directly

| # | File | Abstraction? |
|---|------|--------------|
| 1 | `referee-v5/realtime/refereeV5RealtimeChannel.js` | Module-level (Referee V5 only) |
| 2 | `domain/matchLiveSync.js` | Legacy domain |
| 3 | `court-engine/storage/courtEngineRealtime.js` | Court Engine only |
| 4 | `scripts/check-supabase-referee.mjs` | Test script only |

**Team Tournament: 0 channel creators.**

### 6.2 Realtime framework count

| Framework | Scope | Maturity |
|-----------|-------|----------|
| Referee V5 Realtime | Single match | High — reconnect, dedupe, poll fallback |
| Legacy match-live | Club/tournament director | Medium — weak filter |
| Court Engine RT | Tenant/club | Medium |
| TT repository polling | All TT pages | Low — full snapshot reload |

### 6.3 Duplicate logic

| Concern | Locations |
|---------|-----------|
| Version dedupe | Referee V5 only; TT has none on client |
| Reconnect backoff | Referee V5 only |
| Poll fallback | Referee V5 (8s), TT page (5s), legacy referee (4s), court engine (15s) |
| Connection state UI | Referee V5 `RefereeConnectionStatus.jsx` only |
| Hidden-tab pause | TT page + court engine; Referee V5 poll continues via channel status |

### 6.4 Data leakage risks (current)

| Risk | Severity | Detail |
|------|----------|--------|
| Legacy club-wide match-live filter | P1 | Rows for other tournaments in same club may hit channel; filtered client-side |
| TT full `get-setup` poll | P2 | Entire tournament snapshot reload — over-fetch but RLS/RPC scoped |
| Realtime on unpublished lineup tables | P0 if mis-published | **No TT tables in publication today** — must not add without RLS |
| Client lineup filtering as security | P0 | Must remain server RPC (`team_tournament_get_visible_lineups`) |

---

## 7. Gap vs TT-5 ownership (frozen)

TT-5 established:

- Referee V5 owns live/official result revisions.
- Team Tournament owns aggregates/standings.
- Integration via outbox/inbox — **not** Realtime.

TT-6 must **extend delivery** without changing ownership. Realtime events are **hints to reload snapshot RPC**, not authoritative state patches (same pattern as Referee V5-E1).

---

## 8. Audit verdict (current state)

| Criterion | Status |
|-----------|--------|
| Single unified TT realtime layer | **MISSING** |
| Referee V5 pattern reusable | **YES** |
| TT subscription contract stubbed | **YES** |
| Competing frameworks | **YES — 4** (blocker for TT-6B unless consolidated behind one manager) |
| Production Realtime on TT tables | **NO** (safe) |

**Finding:** TT-6B must implement `TeamTournamentRealtimeService` and **adapt** Referee V5 through a shared interface — not add a fifth ad-hoc channel pattern on pages.
