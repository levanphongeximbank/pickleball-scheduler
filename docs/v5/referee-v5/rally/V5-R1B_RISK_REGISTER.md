# REFEREE V5-R1B — Risk Register

**Phase:** R1-B  
**Date:** 2026-07-13

---

## P0 — Critical (must resolve before Rally production)

| ID | Risk | Impact | Evidence | Mitigation (phase sau) |
|----|------|--------|----------|------------------------|
| P0-01 | **Side-Out regression** khi sửa shared code | Sai điểm, sai server 1/2 | `switchPartnersOnTeam`, `checkGameComplete` dùng chung | Strategy pattern; giữ 43 SO tests PASS |
| P0-02 | **Sai server** trong rally | Referee ghi nhầm người giao | Rally prototype: RIGHT pick + partner flip | USAP score-parity positions |
| P0-03 | **Sai receiver** | Diagonal sai → invalid snapshot | Position drift từ wrong flip | Fix rally position engine; keep `validateServeSnapshot` |
| P0-04 | **Replay sai engine** | Finalize blocked hoặc kết quả sai | `scoringFormat` missing → default side_out | Persist + verify `ruleSetId`; provision mapping fix |
| P0-05 | **Official result sai** | BXH / sub-match score wrong | Replay hash mismatch hoặc wrong live scores | Rally persistence tests + finalize path |
| P0-06 | **TT provision mapping gap** | Rally discipline → V5 side-out state | `TT5-B_PROVISION_RPC.sql` reads `scoringFormat` not `scoringSystem` | Map `scoringSystem`→`scoringFormat`, `targetScore`→`pointsToWin` |
| P0-07 | **TT double-count** (nếu mapping sai + legacy path) | Hai nguồn điểm | Legacy lock exists but wrong-format live play | Fix provision + enforce bridge lock |

---

## P1 — High (resolve in architecture / R1-C / early R2)

| ID | Risk | Impact | Evidence | Mitigation |
|----|------|--------|----------|------------|
| P1-01 | Format contract thiếu | Không biết rule set | No `ruleSetId` on state | Add optional field in R1-C spec |
| P1-02 | Engine selection chưa formal | `if/else` fragile | `applyRallyWin` only | ScoringStrategy registry |
| P1-03 | UI hard-code Server 1/2 | Misleading rally UI | `sideOutLine`, `ServeContextPanel` S# | Conditional presentation hints |
| P1-04 | Event schema không version rule set | Old events + new engine | No per-event format | Immutable `scoringFormat` on match |
| P1-05 | Test thiếu rally | Ship broken rally | 0 V5 rally tests | ≥25 new tests |
| P1-06 | `serverNumber` in rally state | UI shows S1 semantics | rally engine sets serverNumber=1 | Null or hide for rally |
| P1-07 | Side-switch milestone broken | Court ends wrong | `ENDS_SWITCHED` without `applySwitchEnds` | Wire milestone in rally strategy |
| P1-08 | GAME_COMPLETED không lock | Score past game end | Domain event only | Enforce in engine or finalize guard |
| P1-09 | Dual `rallyScoringEngine` modules | Import wrong engine | TT vs V5 same name | Rename or namespace in R2 |
| P1-10 | `pointsToWin` default 11 for rally | Wrong game length | init default 11; rally needs 21 | Config + provision defaults |
| P1-11 | Singles/doubles routing asymmetry | `"rally"` string vs constant | `singlesScoringEngine` L107 | Unify constants |

---

## P2 — Medium / Low

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| P2-01 | Wording UI "ĐỘI A THẮNG RALLY" for side-out | User confusion | Rename optional |
| P2-02 | Animation switch ends | UX polish | Post-MVP |
| P2-03 | Reporting / timeline labels | Audit readability | Rally-specific labels |
| P2-04 | Performance replay long matches | Slow verify | Already exists for SO |
| P2-05 | MLP variant request | Scope creep | Keep rejected until owner decision |
| P2-06 | DreamBreaker scope | Wrong module | Separate phase per R1-A |

---

## Risk heat map

```
Impact ↑
  P0-06 provision    P0-04 replay
  P0-01 regression   P0-02 server
                     P1-05 no tests
  P2-01 wording      P1-03 UI S#
                     P2-03 timeline
        Low ←────────────────→ High
                    Likelihood
```

---

## Owner decisions gating risk closure

| Decision (Owner 2026-07-13) | Risks unblocked |
|-----------------------------|-----------------|
| First variant = USAP 2026 | P1-07 freeze excluded, P0-02 scope clear |
| Default points **11** (arch 15/21) | P1-10 resolved for R2 default |
| Doubles-only R2 | P1-05 test priority, singles deferred |
| DreamBreaker separate | P2-06 |
| Migration deferred | No premature SQL |
| Strategy + Registry | P1-02 |

**Code changes:** DOCUMENTATION ONLY
