# Phase TT-2B — Server-side lineup deadline

**Scope:** `serverTime`, `canSaveDraft`, `canSubmit`, countdown client, before/at/after deadline tests.

**Out of scope:** randomize, publish, gender/MLP validation, forfeit, realtime, TT-2C, Production.

## Server SoT

PostgreSQL `now()` inside `team_tournament_get_setup` and existing `save_lineup_draft` / `submit_lineup` RPCs decides captain permissions.

### SQL patch

`docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql`

- Helper: `team_tournament_lineup_deadline_fields(lock_at, matchup_status, lineup_status, lineup_locked_at)` — **VOLATILE** (must not be `STABLE`; `now()` would be cached)
- Extended `team_tournament_get_setup` returns:
  - Top-level: `serverTime`, `lineupDeadline`, `canSaveDraft`, `canSubmit`, `deadlineStatus`, `viewerTeamId`
  - Per-matchup (viewer team): `lineupDeadline`, `canSaveDraft`, `canSubmit`, `deadlineStatus`
- Resolves `viewerTeamId` from auth when `p_viewer_team_id` is null (captain/deputy)

### deadlineStatus semantics

| Status | Condition | canSaveDraft / canSubmit |
|--------|-----------|--------------------------|
| `before` | `now() < lineup_lock_at` (or no lock) | `true` (if lineup editable) |
| `at` | `now() >= lock` AND `now() < lock + 1s` | `false` |
| `past` | `now() >= lock + 1s` | `false` |
| `locked` | lineup/matchup already locked or published | `false` |

Mutations use `now() >= lineup_lock_at` (blocked at `at` and `past`).

## Client

- `lineupDeadlineService.js` — map setup meta; cloud uses **server flags only** for permissions
- `useLineupDeadlineClock.js` — server clock offset for **countdown display**; reload on expiry
- `TeamPortal.jsx` — disable Lưu nháp / Xác nhận nộp from server flags; no `Date.now()` permission checks on cloud_primary
- `CaptainPortalSummary.jsx` — synced countdown display

Blob/shadow fallback uses `evaluateLineupDeadline()` from TT-2A state machine.

## Apply (staging only)

```powershell
node scripts/apply-phase-tt2b-staging-sql.mjs
```

Manual: Supabase SQL Editor on ref `qyewbxjsiiyufanzcjcq` → run `PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql`.

## Verify

```powershell
# Unit
node --test tests/team-tournament-lineup-deadline.test.js

# TT-2A regression
node --test tests/team-tournament-lineup-state-machine.test.js tests/team-tournament-portal.test.js tests/team-tournament.test.js

# Staging RPC (after SQL apply)
node scripts/verify-phase-tt2b-deadline.mjs
```

Evidence: `docs/v5/qa-evidence/phase-tt2/TT2B_DEADLINE_REPORT.json`

## Test matrix

| Case | Method |
|------|--------|
| Before deadline | Staging: lock_at +2h → `before`, can save/submit |
| At deadline | lock_at −500ms → `at`, blocked |
| After deadline | lock_at −5m → `past`, blocked |
| Client clock fast/slow | Unit: server flags win over synced display offset |
| Refresh page | Staging: restore lock → `before` after reload |
| Two devices | TT-1C polling + versionConflict (unchanged); permissions from server |
| Retry after deadline | Staging: save_draft → `LOCKED` |

## Verdict

**READY FOR TT-2C** — staging RPC verification passed (2026-07-12). See `TT2B_DEADLINE_REPORT.json`.

**Stop here for owner review.** Do not start TT-2C without approval.
