# REFEREE V5-R1C — Team Tournament Integration

**Phase:** R1-C — Architecture & Rules Spec  
**Date:** 2026-07-13  
**Status:** APPROVED (Owner 2026-07-13)  
**Authority:** `V5-R1_OWNER_DECISIONS.md`

---

## 1. Integration model (owner-approved)

```
Team Tournament                    Referee V5                      Official layer
─────────────────                  ──────────                      ──────────────
Discipline config                  Executes locked format          Finalized result only
  scoringSystem                      Rally or Side-Out strategy
  targetScore / winBy
  bestOf
        │                                  │
        └──── provision RPC ──────────────►│ initializeMatchState
                                             │ (format immutable)
                                             │
        ◄──── official result / outbox ──────┤ finalize
        │                                  │
  Standings (W/L, games)                     Không tự tính rally
  Không replay engine                        Chỉ nhận scores đã chốt
```

---

## 2. Responsibilities

| Layer | Owns | Does NOT own |
|-------|------|--------------|
| **Team Tournament** | Format selection per discipline/sub-match; best-of; provision | Rally rotation logic; live scoring |
| **Referee V5** | Live state; strategy execution; undo/replay; finalize trigger | Standings computation; format change mid-match |
| **Official result** | Immutable finalized scores for TT consumption | Engine selection |

---

## 3. Provision contract

### TT discipline fields (source)

| TT field | V5 state field | Notes |
|----------|----------------|-------|
| `scoringSystem: RALLY` | `scoringSystem: RALLY` | **P0-06:** map explicitly |
| `scoringVariant` (or derived) | `scoringVariant: USAP_2026_PROVISIONAL_RALLY` | Default for TT rally discipline |
| `targetScore` | `pointsToWin` | Default **11** |
| `winBy` | `winBy` | Default **2** |
| `bestOf` | `bestOf` | Match-level |
| `matchType` | `matchType: DOUBLES` | R2 rally |

### Legacy mapping gap (P0-06)

**Current issue (R1-B):** `TT5-B_PROVISION_RPC.sql` may read `scoringFormat` / `pointsToWin` while TT stores `scoringSystem` / `targetScore`.

**R2 requirement:**

```text
provisionV5Match(discipline):
  scoringSystem  ← discipline.scoringSystem
  scoringVariant ← discipline.scoringVariant ?? defaultFor(scoringSystem)
  pointsToWin    ← discipline.targetScore ?? 11
  winBy          ← discipline.winBy ?? 2
  freezeRule     ← 'NONE' (R2 rally)
  serverNumberRule ← scoringSystem === 'SIDE_OUT' ? 'SIDE_OUT_1_2' : 'NONE'
  matchType      ← discipline.matchType ?? 'DOUBLES'
  bestOf         ← discipline.bestOf
```

**Resolution phase:** R2 integration — may be SQL RPC patch or app-layer mapper (migration deferred per ADR-R-006).

---

## 4. Format immutability at TT boundary

1. TT sets format when creating sub-match / provisioning V5 bridge.
2. Referee `initializeMatchState` persists format snapshot.
3. After `START_MATCH` — **no TT edit** to scoring fields.
4. Bridge snapshot records format at provision for audit.

See `adr/ADR-004-MATCH-FORMAT-IMMUTABILITY.md`.

---

## 5. Result flow

```
Referee V5 finalize
  → official result record (gamesWon, game scores, winner)
  → TT outbox / RPC
  → TT sub-match status = completed
  → Standings update (W/L only — format-agnostic)
```

### TT receives

| Field | Source |
|-------|--------|
| Winner team | Official result |
| Games won (e.g. 2-1) | Official result — **actual games played** |
| Per-game scores | Official result |
| Scoring system | Metadata only — standings ignore |

### TT does NOT

- Recompute rally points from events
- Apply rally-specific rules to standings
- Accept live state patch as official score

---

## 6. Early match termination (best-of)

Owner decision: match ends when winner determined.

| bestOf | Provision | Possible official results |
|--------|-----------|---------------------------|
| 3 | gamesRequired=2 | 2-0, 2-1 |
| 5 | gamesRequired=3 | 3-0, 3-1, 3-2 |

TT standings use **final gamesWon** — không expect 3 games played when result is 2-0.

---

## 7. Side-Out vs Rally coexistence

| Discipline type | V5 strategy | TT behavior |
|-----------------|-------------|-------------|
| Traditional doubles | Side-Out | Unchanged |
| USAP Rally doubles | USAP 2026 Rally | New R2 path |
| DreamBreaker | **Not in R2** | Separate future format |
| Singles rally | **Not in R2** | Deferred |

Legacy portal lock when V5 bridge active — unchanged from R1-B.

---

## 8. Double-count prevention (P0-07)

1. Fix provision mapping (P0-06) so rally discipline → rally state.
2. Enforce bridge lock — single scoring source.
3. Official result idempotency (ADR-006 main repo — result finalization).

---

## 9. Integration test matrix (R2)

| # | Scenario |
|---|----------|
| IT-01 | TT provision RALLY → V5 state has `scoringSystem=RALLY`, variant USAP |
| IT-02 | TT provision SIDE_OUT → unchanged side-out behavior |
| IT-03 | Rally match 2-0 best-of-3 → TT receives 2-0 official |
| IT-04 | Format locked — TT cannot change after start |
| IT-05 | Legacy side-out sub-match replay + finalize |
| IT-06 | Wrong mapping regression — rally discipline must NOT create side-out state |

---

## 10. References

- `V5-R1B_TEAM_TOURNAMENT_INTEGRATION_AUDIT.md`
- `docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql`
- `V5-R1C_MATCH_FORMAT_CONTRACT.md`
- `adr/ADR-004-MATCH-FORMAT-IMMUTABILITY.md`
- `adr/ADR-006-MIGRATION-DECISION-DEFERRED.md`

**Code changes:** DOCUMENTATION ONLY
