# TT-5A — Data Model Mapping

**Date:** 2026-07-13  
**Method:** Code + SQL cross-reference (read-only)

---

## Q1 — Team sub-match → Referee V5 match ID

### Finding: **EXTERNAL_SUB_MATCH_ID**

| Layer | Identifier | Column / field |
|-------|------------|----------------|
| Team Tournament RPC/UI | Sub-match key | `team_tournament_sub_matches.external_sub_match_id` (text) |
| Team Tournament internal PK | UUID | `team_tournament_sub_matches.id` — **not used by RPCs** |
| Referee V5 match scope | Opaque text | `match_id` parameter on edge/RPC |
| Referee V5 state PK | Composite string | `buildMatchStateId({ tenantId, tournamentId, matchId })` → `{tenant}::{tournament}::{matchId}` |

**Evidence:**

- `team_tournament_confirm_sub_match` resolves `p_sub_match_id` against `external_sub_match_id` (`PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql`)
- `matchStateSerializer.js` line 22–24: `matchId` is opaque text in composite key
- Sub-match rows expose `id` in `get_setup` as `sm.external_sub_match_id` (`PHASE_TT4_GET_SETUP_PATCH.sql`)

**Recommendation:** V5 `match_id` = **`external_sub_match_id`**. Do **not** use UUID PK — breaks all TT RPC contracts and probe scripts.

---

## Q2 — Bridge table

### Finding: **RECOMMENDED** (not required for ID alone, required for lifecycle)

Direct ID mapping works for happy-path addressing. Bridge table needed for:

- `integration_status` (`pending` / `live` / `finalized` / `failed`)
- `live_state_id` denormalized copy
- `official_result_revision_id` after finalize
- `provisioned_at`, `linked_by`, idempotency of provisioning
- Locking legacy score entry when link active

**Proposed table:** `team_sub_match_referee_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid | RLS scope |
| `team_tournament_id` | uuid FK | |
| `sub_match_uuid` | uuid FK | internal PK |
| `external_sub_match_id` | text | denormalized for queries |
| `match_state_id` | text | `{tenant}::{tournament}::{external_sub_match_id}` |
| `integration_status` | text | state machine |
| `assignment_id` | uuid nullable | FK `referee_assignments` |
| `result_revision_id` | uuid nullable | FK `match_result_revisions` |
| `version` | int | optimistic lock |
| `created_at` / `updated_at` | timestamptz | |

**Unique:** `(team_tournament_id, external_sub_match_id)`

---

## Entity alignment matrix

| Team Tournament | Referee V5 | Mapping |
|-----------------|------------|---------|
| `team_tournaments.tournament_id` (text) | V5 `tournament_id` | Same tournament scope key |
| `team_tournaments.tenant_id` | V5 `tenant_id` | Same tenant |
| `team_tournament_matchups.external_matchup_id` | — | TT-only aggregate; not V5 match |
| `team_tournament_sub_matches.external_sub_match_id` | V5 `match_id` | **1:1** |
| `team_tournament_sub_matches.score` (summary) | `match_live_states` rally state | **Conflict if both write live** |
| `team_tournament_sub_matches.result_confirmed_at` | `match_result_revisions.finalized_at` | Finalize should set TT summary once |
| `team_tournament_standings` | outbox `STANDINGS_RECALC_REQUESTED` | Consumer updates cache |

---

## Participants / lineup mapping (TT-5C design input)

V5 `match_live_states.participants` jsonb must be seeded from:

- Published lineups (`team_tournament_lineups.selections`) for discipline
- `buildOfficialPairings` output (`lineupEngine.js`) — maps sub-match ↔ discipline ↔ player slots

**Precondition:** Both lineups `LINEUP_STATUS.PUBLISHED`, matchup `published|in_progress`.

---

## Tournament context keys

```
tenant_id          ← team_tournaments.tenant_id
tournament_id      ← team_tournaments.tournament_id (text, not uuid header id)
match_id           ← external_sub_match_id
match_state_id     ← buildMatchStateId({ tenantId, tournamentId, matchId })
```
