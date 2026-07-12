# TT-7 — Standings QA Plan

**Phase:** TT-7 preparation (Track B1)  
**Branch:** `qa/team-tournament-pilot-preparation`  
**Production impact:** NONE  
**Status:** Preparation only — do not execute TT-7 on this branch

---

## 1. Objective

Prepare fixtures and an independent standings oracle to validate team standings and tie-break behaviour during TT-7 execution on the main feature branch.

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| JSON fixtures (4-team, 6-team) | `teamStandingsEngine.js` changes |
| Independent oracle script | UI / RPC / SQL |
| Frozen expected results | Production deploy |
| Unit tests for oracle | Engine parity fixes |

## 3. Fixtures

| Fixture | File | Scenarios |
|---------|------|-----------|
| 4 teams round-robin | `fixtures/tt7-four-teams.json` | Two teams tied on wins; H2H decider (B vs C); one-win tie group; pointsScored fallback |
| 6 teams grouped | `fixtures/tt7-six-teams.json` | 3-way tie; technical forfeit; withdrawal; incomplete match; correction metadata; DreamBreaker metadata |

## 4. Oracle

**Script:** `scripts/qa/calculate-expected-team-standings.mjs`

```bash
# Print expected standings
node scripts/qa/calculate-expected-team-standings.mjs docs/v5/qa/team-tournament/fixtures/tt7-four-teams.json

# Regenerate frozen expected file (after fixture change only)
node scripts/qa/calculate-expected-team-standings.mjs --write \
  docs/v5/qa/team-tournament/fixtures/tt7-four-teams.json \
  docs/v5/qa/team-tournament/expected/tt7-four-teams-expected.json
```

**Design rule:** Does **not** import `teamStandingsEngine.js`.

**Supported metrics:** wins, losses, rankingPoints, subMatchWins/Losses/Diff, pointsScored/Conceded, pointDiff, forfeit flags, headToHead, manual fallback.

## 5. Test execution

```bash
node --test tests/qa/team-tournament-expected-standings.test.js
```

## 6. TT-7 execution checklist (future — main branch)

- [ ] Load fixture into staging tournament (manual or script on main branch)
- [ ] Run engine `computeTeamStandings` on same raw match data
- [ ] Compare rank order vs oracle output
- [ ] Log mismatches in issue report — **do not patch engine on QA branch**
- [ ] Verify forfeit / withdrawal / incomplete match exclusion
- [ ] Verify correction workflow with owner-approved RPC
- [ ] Capture evidence JSON under `docs/v5/qa-evidence/phase-tt7/`

## 7. Tie-break profiles

| Profile | Order | Use case |
|---------|-------|----------|
| `default` | wins → subMatchDiff → pointsScored → manual | Production default |
| `headToHeadPriority` | wins → headToHead → subMatchDiff → … | Direct matchup decider |
| `pointsScoredPriority` | includes pointDiff | Point-total edge cases |

## 8. Issue report template

If oracle ≠ engine during TT-7 execution:

```markdown
## TT-7 Standings mismatch
- Fixture: tt7-four-teams | tt7-six-teams
- Team pair: team-x vs team-y
- Oracle rank: N
- Engine rank: M
- Decider: wins | headToHead | subMatchDiff | pointsScored
- Action: STOP — owner review required
```

---

**Verdict (prep):** READY FOR TT-7 EXECUTION (oracle + fixtures frozen on QA branch)
