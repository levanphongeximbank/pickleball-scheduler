# Team Tournament — TT-2 Lineup Workflow

**Phase:** TT-2  
**Status:** IN PROGRESS  
**Prerequisite:** TT-1C PASS (cloud_primary Preview)  
**Production impact:** NONE — Staging/Preview only  
**Out of scope:** TT-3 (BTC override chuyên sâu), Production deploy, modules khác

---

## Goal

Hoàn thiện vòng đời lineup trên Staging/Preview với Supabase **cloud_primary** làm SSOT.

Pilot tournament: `phase23d-probe-tournament` @ `club-staging-demo` / `venue-staging-a`.

---

## 1. State machine (lineup per team per matchup)

### Canonical statuses (DB + client)

| Status | Constant | Alias (spec) | Terminal? |
|--------|----------|----------------|-----------|
| `not_submitted` | `LINEUP_STATUS.NOT_SUBMITTED` | `not_started` | no |
| `draft` | `LINEUP_STATUS.DRAFT` | — | no |
| `submitted` | `LINEUP_STATUS.SUBMITTED` | — | no |
| `locked` | `LINEUP_STATUS.LOCKED` | — | no |
| `published` | `LINEUP_STATUS.PUBLISHED` | — | yes* |
| `withdrawn` | `LINEUP_STATUS.WITHDRAWN` | — | yes |
| `overridden` | `LINEUP_STATUS.OVERRIDDEN` | — | yes (TT-3 prep) |
| `expired` | `LINEUP_STATUS.EXPIRED` | — | yes |

\* Lineup `published` is terminal for captain edits; matchup may still move to `in_progress` / `completed`.

Matchup-level lifecycle (separate): `scheduled → lineup_open → locked → published → in_progress → completed`.

### Transition matrix (authoritative)

Implemented in `src/features/team-tournament/engines/lineupStateMachine.js`.

| Action | From | To | Roles | Server conditions |
|--------|------|-----|-------|-------------------|
| `save_draft` | not_submitted, draft, submitted | draft / not_submitted | captain (own team), BTC | before lock deadline; not locked/published |
| `submit` | not_submitted, draft, submitted | submitted | captain (own team), BTC | before lock deadline; full validation |
| `lock` | draft, submitted, not_submitted* | locked | BTC | matchup lock; *missing → random/forfeit policy |
| `publish` | locked | published | BTC | matchup must be locked |
| `randomize` | not_submitted, draft | locked | BTC (auto at lock) | missing lineup policy |
| `withdraw` | draft, submitted | withdrawn | captain, BTC | before lock; policy allows |
| `override` | locked | overridden | BTC | TT-3 — stub only |
| `expire` | draft, submitted, not_submitted | expired | system | past deadline without submit |

Audit action mapping: `TEAM_AUDIT_ACTIONS` + SQL `team.lineup.*`.

---

## 2. Permission rules

| Actor | Allowed | Denied |
|-------|---------|--------|
| **Captain** | draft/submit own team before lock | edit after lock; opponent pre-publish; other team |
| **BTC** | view both teams; lock; publish; randomize (policy) | — (override deep = TT-3) |
| **Referee** | read published matchups assigned | lineup before publish |
| **Player** | — | all lineup mutations |
| **Cross-tenant** | — | all (403 / access_denied) |

Client guards: `teamPermissionEngine.js` + `lineupStateMachine.js`.  
Server guards: RPC + RLS (23C + TT-1B).

---

## 3. Deadline — server time SoT

- **SoT:** PostgreSQL `now()` inside RPC (`lineup_lock_at` on matchup).
- **Client:** countdown display only; disable buttons when server says past deadline.
- **RPC returns:** `{ canSaveDraft, canSubmit, isPastDeadline, serverTime }` via `get_visible_lineups` / `get_setup` extensions (TT-2B).

Tests: before / at / after `lineup_lock_at` on staging.

---

## 4. Draft & submit (TT-1C baseline → TT-2 hardening)

| Requirement | TT-1C | TT-2 |
|-------------|-------|------|
| Idempotency key | ✅ TT-1B RPC | keep |
| expectedVersion | ✅ | keep |
| version_conflict | ✅ | keep + UI reload |
| Double-click safe | ✅ command_log | keep |
| Refresh persistence | ✅ | keep |
| Full validation on submit | client only | + SQL parity (TT-2C) |
| Publish requires lock | ❌ TT-1B regression | **fix SQL** (TT-2A) |
| Cloud randomize at lock | ❌ blob only | **RPC** (TT-2A) |

---

## 5. Implementation slices

| Slice | Deliverable | Staging apply |
|-------|-------------|---------------|
| **TT-2A** | State machine module + tests; restore publish guard SQL; randomize RPC stub | SQL patch staging |
| **TT-2B** | Server deadline flags in get_setup; client uses server time | redeploy Preview |
| **TT-2C** | Validation parity (gender/count/MLP critical paths) | SQL + tests |
| **TT-2D** | Full QA smoke + evidence `docs/v5/qa-evidence/phase-tt2/` | Playwright |

---

## 6. Evidence & verdict

Verdict **READY FOR TT-3** only when:

- Transition matrix tests PASS (client + documented SQL alignment)
- Captain draft/submit/refresh PASS on Preview
- BTC lock → publish chain PASS (no publish without lock)
- Opponent hidden pre-publish PASS
- Deadline before/at/after PASS (server time)
- Cross-tenant blocked PASS
- Production impact = NONE

---

## References

- TT-1C wiring: `docs/v5/TEAM_TOURNAMENT_TT1C_UI_WIRING.md`
- SQL 23C: `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql`
- SQL TT-1B: `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql`
- State machine: `src/features/team-tournament/engines/lineupStateMachine.js`
