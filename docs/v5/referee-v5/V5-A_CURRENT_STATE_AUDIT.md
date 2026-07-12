# Referee V5-A — Current State Audit

**Date:** 2026-07-12  
**Scope:** Referee, scoring, positions, events, team referee, live score, security  
**Constraint:** Read-only audit — no code/SQL/deploy changes  
**Prior audit:** `docs/v5/REFEREE_MODULE_CURRENT_STATE_AUDIT.md` (classic + team overview)

---

## 1. Executive summary

The current referee module supports **aggregate score entry** (+1/-1 or final score) on two parallel tracks. It does **not** implement:

- Player court positions (LEFT/RIGHT service court, NEAR/FAR end)
- Server / receiver determination
- Server 1 / server 2 / side-out rotation
- Rally-level event history or undo
- Court visualizer
- Event-driven match state rebuild

**Visual referee operations are NOT IMPLEMENTED.** Existing UI is score-centric, not position-centric.

**Maturity for Referee V5 goals:** **2.5 / 10** (foundation for assignment + live score only)

---

## 2. Status legend

| Label | Meaning |
|-------|---------|
| FULLY IMPLEMENTED | End-to-end with backend + tests |
| PARTIALLY IMPLEMENTED | Some layers exist; gaps in E2E |
| UI ONLY | Screen exists; no real backend |
| MOCK | Hardcoded / demo data |
| LOCALSTORAGE | Persisted locally only |
| BACKEND ONLY | API/DB without UI |
| ROUTE ONLY | Route declared; minimal behavior |
| NOT IMPLEMENTED | No evidence in codebase |
| NOT VERIFIED | Could not confirm from code/DB/tests |

---

## 3. Position & rotation capability (critical for V5)

| Capability | UI | Backend | Database | Evidence | Status |
|------------|:--:|:-------:|:--------:|----------|--------|
| VĐV position (court_side) | ❌ | ❌ | ❌ | Grep `court_side`, `LEFT_SERVICE` → 0 matches | **NOT IMPLEMENTED** |
| VĐV position (court_end) | ❌ | ❌ | ❌ | Grep `court_end`, `NEAR_END` → 0 matches | **NOT IMPLEMENTED** |
| Serving player | ❌ | ❌ | ❌ | No field in `tournament_match_live` (staging verified 18 cols) | **NOT IMPLEMENTED** |
| Receiving player | ❌ | ❌ | ❌ | — | **NOT IMPLEMENTED** |
| Server number (1/2) | ❌ | ❌ | ❌ | — | **NOT IMPLEMENTED** |
| Serving team | ❌ | ❌ | ❌ | — | **NOT IMPLEMENTED** |
| Diagonal serve / người đỡ bóng | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Serve direction arrow (chéo sân) | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Side switch after rally | ❌ | ❌ | ❌ | — | **NOT IMPLEMENTED** |
| End switch (đổi sân) | ❌ | ❌ | ❌ | `rallyScoringEngine` has `sideSwitchAt` **hint only** | **NOT IMPLEMENTED** |
| Rally history | ❌ | ❌ | ❌ | `audit_log` JSON = score adjust only | **NOT IMPLEMENTED** |
| Undo last rally | ⚠️ | ⚠️ | ❌ | Score -1 with confirm dialog only | **PARTIALLY IMPLEMENTED** (score decrement, not state undo) |
| Rebuild state from events | ❌ | ❌ | ❌ | — | **NOT IMPLEMENTED** |
| Court visualizer | ❌ | ❌ | ❌ | Grep `CourtVisual` → 0 | **NOT IMPLEMENTED** |

**Conclusion:** Referee V5 visual court model requires **greenfield** engines and storage. Existing `tournament_match_live` stores only `score_a`, `score_b`, `status`, `audit_log` (adjust/finalize entries).

---

## 4. Full feature inventory

| Chức năng | UI | Backend | Database | RLS | Test | Trạng thái |
|-----------|---:|--------:|---------:|----:|-----:|------------|
| Referee token link scoring | ✅ | ✅ | ✅ | ✅ RPC | ✅ 9 | **PARTIALLY IMPLEMENTED** |
| Referee session hub | ✅ | ✅ | ✅ blob+live | ⚠️ | ✅ | **PARTIALLY IMPLEMENTED** |
| Live +1/-1 score | ✅ | ✅ RPC | ✅ | ✅ | ✅ | **PARTIALLY IMPLEMENTED** |
| Finalize → Director queue | ✅ | ✅ | ✅ | ✅ | ✅ 4 | **PARTIALLY IMPLEMENTED** |
| Team sub-match draft/confirm | ✅ | ✅ RPC | ✅ TT | ✅ | ✅ 14 | **PARTIALLY IMPLEMENTED** |
| Rally score validation (team) | ✅ hints | ✅ | N/A | ✅ | ✅ 4 | **PARTIALLY IMPLEMENTED** |
| Side-out scoring engine | ❌ | ❌ | ❌ | — | ❌ | **NOT IMPLEMENTED** |
| Side-out constant only | — | ⚠️ | — | — | — | `SCORING_SYSTEM.SIDE_OUT` in `constants.js` L70-73 — **no engine** |
| Best-of-3 games (team) | ✅ | ✅ | ✅ | ✅ | ✅ | **PARTIALLY IMPLEMENTED** |
| Dreambreaker referee | ✅ | ✅ | ✅ | ✅ | ⚠️ | **PARTIALLY IMPLEMENTED** |
| Referee assignment (classic) | ✅ Director | ✅ blob+live | blob | ⚠️ | ✅ | **PARTIALLY IMPLEMENTED** |
| Referee assignment page | ✅ | ❌ demo | ❌ | — | ❌ | **MOCK** (`TournamentRefereeAssignPage.jsx` L31-44) |
| Scorekeeper role | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Head referee role | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Match report (electronic) | ⚠️ redirect | ❌ | ❌ | — | — | **ROUTE ONLY** → logs tab |
| Dispute workflow | ⚠️ label | ⚠️ reset live | ❌ table | — | — | **PARTIALLY IMPLEMENTED** |
| Forfeit (classic) | ❌ TT UI | ✅ engine | blob | — | ⚠️ | **PARTIALLY IMPLEMENTED** |
| Forfeit (team) | ✅ | ✅ RPC | ✅ | ✅ | ✅ | **PARTIALLY IMPLEMENTED** |
| Walkover | ❌ | ⚠️ rating const | ❌ | — | — | **NOT IMPLEMENTED** (referee) |
| Timeout / pause | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Incident report | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Referee note offline | ✅ mobile | ✅ queue | audit | — | ✅ | **PARTIALLY IMPLEMENTED** |
| Realtime (director) | ✅ | ✅ Supabase | ✅ | ✅ | ⚠️ | **PARTIALLY IMPLEMENTED** |
| Realtime (referee token) | ⚠️ poll 4s | ✅ | ✅ | ✅ | — | **PARTIALLY IMPLEMENTED** |
| Offline score queue | ❌ blocked | ✅ matrix | — | — | ✅ | **NOT IMPLEMENTED** (by design) |
| Player position on court | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Court assignment display | ⚠️ label | ✅ | ✅ | — | — | **PARTIALLY IMPLEMENTED** |
| Lineup visibility (team) | ✅ | ✅ | ✅ | ✅ | ✅ | **PARTIALLY IMPLEMENTED** |
| Undo rally/state | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Event append-only store | ❌ | ⚠️ audit JSON | ❌ | — | — | **NOT IMPLEMENTED** |
| Idempotency (classic) | ❌ | ❌ | ❌ | — | — | **NOT IMPLEMENTED** |
| Idempotency (team) | ✅ | ✅ | ✅ command_log | ✅ | ✅ | **PARTIALLY IMPLEMENTED** |
| Transactional finalize | ❌ | ❌ multi-step | ❌ | — | — | **NOT IMPLEMENTED** |
| Rating integration | ❌ | ⚠️ CC-02 legacy | ⚠️ | — | — | **NOT IMPLEMENTED** for referee finalize → Rating V5 |

---

## 5. Architecture tracks (evidence)

### 5.1 Classic track

| File | Role |
|------|------|
| `src/pages/referee/RefereeScoreboard.jsx` | +1/-1, finalize dialog, 56px buttons |
| `src/domain/matchLiveSync.js` | RPC + poll 4s |
| `docs/supabase-match-live-rls.sql` | `referee_get_match_by_token`, `referee_update_match_score` |
| `src/tournament/useMatchLiveScores.js` | Director finalize queue (client dedup Set) |

**Score audit entries** (`src/models/tournament/scoreLog.js`): `adjust`, `finalized`, `admin_override`, `dispute_reset` — **no** `RALLY_WON`, `PLAYERS_SWITCHED`.

### 5.2 Team track

| File | Role |
|------|------|
| `src/pages/tournament/TeamRefereePortal.jsx` | Sub-match panels, BO1/BO3 |
| `src/features/team-tournament/engines/rallyScoringEngine.js` | target/winBy/freeze/sideSwitchAt **validation only** |
| `src/features/team-tournament/engines/teamRefereeEngine.js` | Lineup gate, winner from games |
| `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` | version, idempotency, forfeit |

**Lineup slots** (`competition-core/types`): `position?: string` on lineup slots — **NOT VERIFIED** as court position for referee UI.

---

## 6. Reload & recovery

| Scenario | Classic | Team |
|----------|---------|------|
| Reload page | ✅ Re-fetch live row by token | ✅ Orchestrator reload |
| Restore positions | ❌ | ❌ |
| Restore server/receiver | ❌ | ❌ |
| Offline queue replay | ❌ score blocked | ❌ |
| Conflict on reload | ⚠️ last write | ⚠️ version RPC |

---

## 7. Gaps vs Referee V5 requirements

| V5 requirement | Current state |
|----------------|---------------|
| Court visualizer | NOT IMPLEMENTED |
| RALLY_WON actions (not +1) | NOT IMPLEMENTED |
| Position engine | NOT IMPLEMENTED |
| Serve rotation engine | NOT IMPLEMENTED |
| Event store append-only | NOT IMPLEMENTED |
| EVENT_REVERTED undo | NOT IMPLEMENTED |
| REFEREE_PHYSICAL_VIEW | NOT IMPLEMENTED |
| ENDS_SWITCHED with state update | NOT IMPLEMENTED |
| Side-out 5-3-1 display | NOT IMPLEMENTED |
| Singles even/odd serve court | NOT IMPLEMENTED |

---

## 8. Critical findings (V5-A scope)

| ID | Level | Finding | Evidence |
|----|-------|---------|----------|
| V5A-P0-01 | P0 | No player position data anywhere | Codebase grep |
| V5A-P0-02 | P0 | UI cannot reflect court reality | RefereeScoreboard = score only |
| V5A-P0-03 | P0 | No event-driven state | No `match_events` table |
| V5A-P0-04 | P0 | Side-out scoring constant without engine | `constants.js` vs no engine file |
| V5A-P1-01 | P1 | +1 button wrong abstraction for side-out | RefereeScoreboard L351 |
| V5A-P1-02 | P1 | No server/receiver rule validation | — |
| V5A-P1-03 | P1 | END switch would break if CSS-only | No state model |
| V5A-P2-01 | P2 | Rally hints not wired to positions | `getRallyScoringHints` chip only |

---

## 9. What can be reused for V5

| Asset | Reuse |
|-------|-------|
| RBAC `REFEREE` + `MATCH_UPDATE` | ✅ Assignment + route guards |
| Team TT-1B idempotency pattern | ✅ Template for V5 RPC |
| `rallyScoringEngine` end-game rules | ✅ Port into V5 scoring rule engine |
| `RefereeScoreboard` mobile UX patterns | ✅ Button sizes, confirm dialogs |
| `tournament_match_live` | ⚠️ Legacy coexistence; V5 needs new tables |
| Director finalize flow | ⚠️ Replace with transactional RPC |

---

## 10. Verdict (audit section)

**Current-state audit for Referee V5 visual goals:** documents baseline and confirms **greenfield** for position/serve/event layers.

**Status:** PASS (audit complete with evidence)

---

*End of V5-A current state audit — no production changes.*
