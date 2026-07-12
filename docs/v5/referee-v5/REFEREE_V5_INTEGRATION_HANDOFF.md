# Referee V5 — Integration Handoff

**Purpose:** Runtime and operational boundary for Team Tournament integration (TT-5).  
**Status:** SOURCE CAPTURE COMPLETE — not Production GO.  
**Date:** 2026-07-13

---

## Source snapshot (official)

| Field | Value |
|-------|-------|
| Repository | `c:\Users\Le Phong\pickleball-scheduler` |
| Remote | `https://github.com/levanphongeximbank/pickleball-scheduler.git` |
| **Source branch** | `feature/referee-v5-platform` |
| **Source HEAD SHA** | `3bc8a7e615cfbdc120b11dc6fd48f8292e16bf05` |
| **Worktree** | `C:\Users\Le Phong\pickleball-scheduler-referee-v5` |
| Base branch | `feature/competition-core-standardization` |
| Base SHA | `23462878782726b9f933380071126245bd767dec` |
| Capture method | Manifest hash copy into clean worktree (7+1 commits) |
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production project | `expuvcohlcjzvrrauvud` (Referee V5 objects **not** present) |
| Edge Function | `referee-v5-match` (deployed staging; not redeployed in capture) |

---

## Source snapshot (preparation audit — superseded)

| Field | Value |
|-------|-------|
| Repository | `c:\Users\Le Phong\pickleball-scheduler` |
| Remote | `https://github.com/levanphongeximbank/pickleball-scheduler.git` |
| Logical branch | Working tree on `feature/competition-core-standardization` (no isolated Referee V5 branch) |
| Git HEAD (parent branch) | `23462878782726b9f933380071126245bd767dec` |
| Referee module git status | Was **UNCOMMITTED** before source capture |
| Partial committed stub | `824a639` — `/dev/referee-v5` route in `src/router.jsx` only |

---

## Runtime modules cần tích hợp

### Domain engines

| Module | Path |
|--------|------|
| Match state engine | `src/features/referee-v5/engines/matchStateEngine.js` |
| Command dispatcher | `src/features/referee-v5/engines/matchCommandDispatcher.js` |
| Serve rotation | `src/features/referee-v5/engines/serveRotationEngine.js` |
| Receiver resolver | `src/features/referee-v5/engines/receiverResolver.js` |
| Court position | `src/features/referee-v5/engines/courtPositionEngine.js` |
| Side-out / rally / singles scoring | `engines/sideOutScoringEngine.js`, `rallyScoringEngine.js`, `singlesScoringEngine.js` |
| Switch ends / undo / replay | `switchEndsEngine.js`, `undoEngine.js`, `stateReplayEngine.js` |
| Initialize state | `engines/initializeMatchState.js` |

### Contracts / selectors

| Module | Path |
|--------|------|
| State schema | `constants/stateSchema.js` |
| Event types | `constants/eventTypes.js` |
| Match types / scoring formats | `constants/matchTypes.js`, `scoringFormats.js` |
| Selectors | `selectors/scoreboardSelector.js`, `serveContextSelector.js`, `courtScreenPositionSelector.js`, `timelineSelector.js`, `serveArrowSelector.js` |
| Domain validation | `domain/matchValidation.js`, `domain/matchEvents.js`, `domain/matchState.js` |

### Court Visualizer

| Module | Path |
|--------|------|
| UI | `components/CourtVisualizer.jsx`, `ServeDirectionArrow.jsx`, `PlayerPositionCard.jsx` |
| Hook | `hooks/useCourtVisualizerState.js` |
| Styles | `styles/refereeV5.css` |

### RemotePersistenceAdapter

| Module | Path |
|--------|------|
| Adapter contract | `adapters/RemotePersistenceAdapter.js` |
| Local prototype adapter | `adapters/LocalPrototypeAdapter.js` |
| Repository | `persistence/RefereeV5SupabaseRepository.js` |
| Serialization / hash | `persistence/matchStateSerializer.js`, `canonicalStateHash.js` |
| Authorization / trust | `persistence/refereeV5Authorization.js`, `refereeV5TrustBoundary.js` |
| Atomic commit services | `RefereeV5AtomicCommitService.js`, `RefereeV5RpcAtomicCommitService.js` |

### Realtime controller

| Module | Path |
|--------|------|
| Hook | `hooks/useRefereeRealtimeSync.js` |
| Channel | `realtime/refereeV5RealtimeChannel.js` |
| Logic | `realtime/realtimeSyncLogic.js` |
| Connection states | `constants/realtimeConnectionStates.js` |
| Remote controller | `hooks/useRefereeRemoteMatchController.js` |
| Flag | `flags.js` → `VITE_REFEREE_V5_REALTIME_ENABLED` |

### Edge Function

| Artifact | Path |
|----------|------|
| Entry | `supabase/functions/referee-v5-match/index.ts` |
| Shared handler | `supabase/functions/_shared/refereeV5Server.mjs` |
| Client | `services/refereeV5EdgeClient.js`, `refereeV5RemoteEdgeService.js` |

**Actions:** `get-state`, `apply-command`, `finalize`

### Database objects (staging)

| Object | Role |
|--------|------|
| `match_live_states` | Current match snapshot (realtime publication member) |
| `match_events` | Append-only event log |
| `match_game_states` | Per-game snapshots |
| `match_participant_positions` | Court positions |
| `match_result_revisions` | Finalization audit |
| `match_integration_outbox` | Result outbox (writers exist; **no TT consumer yet**) |
| `match_sync_mutations` | Idempotency / mutation tracking |
| `match_disputes`, `match_incidents` | Incident tracking |

### RPC signatures (public, JWT)

| RPC | Purpose |
|-----|---------|
| `referee_v5_get_match_state` | Read authoritative state |
| `referee_v5_apply_match_command` | Apply scored command (Edge-preferred in client) |
| `referee_v5_finalize_match_result` | Finalize match |
| `referee_v5_commit_match_transition` | Internal transition commit |
| `referee_v5_commit_match_finalization` | Internal finalize commit |

Helpers: `referee_v5_current_user_has_assignment`, `referee_v5_is_super_admin`, `referee_v5_match_state_id`, `referee_v5_deny_match_events_mutation`

### RLS requirements

- Tenant-scoped read via assignment helper (`referee_v5_current_user_has_assignment`)
- Append-only enforcement on `match_events` (triggers)
- Client cannot mutate scores directly — commands only
- Outbox not readable by authenticated clients
- Internal commit RPCs service-role only
- Realtime delivery scoped by RLS on `match_live_states`

Spec: `docs/v5/referee-v5/V5-D_RLS_SECURITY_SPECIFICATION.md`

---

## Không mang sang runtime Production

| Item | Reason |
|------|--------|
| `/dev/referee-v5` prototype route | Staging/dev only; SuperAdmin guard |
| `RefereeV5PrototypePage.jsx` | Fixture dropdown, local mode |
| `refereeV5StagingFixtures.js`, `refereeV5PrototypeFixtures.js` | Test data |
| Staging fault injection hooks | QA only |
| `REFEREE_V5_TEST_*` seed rows | Staging harness |
| QA passwords (`.env.staging-qa.local`) | Secrets |
| `scripts/verify-referee-v5-*`, `seed-referee-v5-*` | CI/staging closure — not app bundle |
| `docs/v5/qa-evidence/phase-v5d*`, `phase-v5e1/` | Evidence only |
| `LocalPrototypeAdapter` default in production paths | Must gate behind flags |
| Preview deploy scripts | Ops only |

---

## Environment requirements

Variable names only — **do not commit values**:

| Variable | Purpose |
|----------|---------|
| `VITE_REFEREE_V5_ENABLED` | Master feature gate |
| `VITE_REFEREE_V5_DATA_MODE` | `remote` for staging/production path |
| `VITE_REFEREE_V5_REALTIME_ENABLED` | Realtime sync (default on when remote) |
| `VITE_REFEREE_V5_EDGE_BASE_URL` | Optional override; falls back to `VITE_SUPABASE_URL` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client JWT auth |
| Edge runtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

Edge endpoint pattern: `{SUPABASE_URL}/functions/v1/referee-v5-match`

---

## Database requirements

| Migration | File | Staging | Production | Dependency | Cần cho TT-5 |
|-----------|------|--------:|-----------:|------------|-------------:|
| V5A | `PHASE_V5A_REFEREE_FOUNDATION.sql` | Applied | No | — | **Yes** |
| V5D | `PHASE_V5D_REFEREE_PERSISTENCE.sql` | Applied | No | V5A | **Yes** |
| V5D1 | `PHASE_V5D1_REFEREE_HARDENING.sql` | Applied | No | V5D | **Yes** |
| V5D32 | `PHASE_V5D32_IDEMPOTENCY_UNDO.sql` | Applied | No | V5D1 | **Yes** |
| V5D4 | `PHASE_V5D4_ATOMIC_ROLLBACK.sql` | Applied | No | V5D32 | **Yes** |
| V5E1 | `PHASE_V5E1_REALTIME_SYNC.sql` | Applied | No | V5D4 | **Yes** (multi-device TT referee) |

Evidence: `docs/v5/qa-evidence/phase-v5d2/VERIFY_REPORT.json`, `phase-v5d3/EDGE_DEPLOY_REPORT.json`, `phase-v5e1/`

---

## API contract

### get-state

- **Transport:** Edge POST `referee-v5-match` action `get-state`
- **Input:** `tenant_id`, `tournament_id`, `match_id`
- **Output:** `{ ok, state, stateVersion, lastEventSequence, status }`

### apply-command

- **Transport:** Edge POST action `apply-command`
- **Input:** command type, payload, expected version/sequence, idempotency keys
- **Commands:** `START_MATCH`, `TEAM_A_WON_RALLY`, `TEAM_B_WON_RALLY`, `SWITCH_ENDS`, `UNDO_LAST_EVENT`, `PAUSE_MATCH`, `RESUME_MATCH`, `START_TIMEOUT`, `END_TIMEOUT`, `DECLARE_FORFEIT`

### finalize

- **Transport:** Edge POST action `finalize`
- **Output:** locked state + outbox write

### Realtime notification

- **Mechanism:** Supabase Realtime `postgres_changes` on `match_live_states`
- **Channel:** `referee-v5:match:{matchId}`
- **Recovery:** Edge `get-state` reload on version gap

### Result outbox

- **Table:** `match_integration_outbox`
- **Status:** Writers active; **no downstream consumer** wired to `team_tournament_sub_matches` yet
- **TT-5B must define:** mapping `match_id` ↔ `sub_match_id`, consumer idempotency

Full spec: `docs/v5/referee-v5/V5-D_RPC_SPECIFICATION.md`

---

## Recommended TT integration identity key

| TT object | V5 object | Notes |
|-----------|-----------|-------|
| `team_tournament_sub_matches.id` | V5 `match_id` | Proposed bridge — confirm in TT-5A |
| `team_tournaments.id` | V5 `tournament_id` | Direct |
| Club / tenant id | V5 `tenant_id` | Must align with TT header tenant |

---

## Known limitations

| Limitation | Status |
|------------|--------|
| Offline queue | **Not implemented** (V5-E2 planned) |
| MLP / Dreambreaker formats | **Not in V5 engine** |
| Production deployment | **Not GO** |
| Legacy `/team-referee` portal | **Not deprecated** — still SSOT for TT scoring today |
| Match provisioning API | **Missing** — TT must create V5 match row before remote scoring |
| Outbox consumer | **Missing** — sub_match result not auto-synced |
| Referee V5 git history | **Missing** — module uncommitted on working tree |

---

## Handoff checklist for TT-5A

- [ ] Referee V5 committed to dedicated branch (not working tree only)
- [ ] Integration branch created from verified TT base
- [ ] Owner approves `sub_match_id` ↔ `match_id` mapping
- [ ] Staging migrations confirmed (this handoff: PASS on staging)
- [ ] Production explicitly out of scope until TT-5F

**Handoff author:** TT-5 Preparation audit  
**Next phase:** TT-5A read-only integration audit on `feature/tt5-referee-v5-integration`
