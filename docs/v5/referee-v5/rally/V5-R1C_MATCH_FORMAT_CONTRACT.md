# REFEREE V5-R1C — Match Format Contract

**Phase:** R1-C — Architecture & Rules Spec  
**Date:** 2026-07-13  
**Status:** APPROVED (Owner 2026-07-13)  
**Authority:** `V5-R1_OWNER_DECISIONS.md`

---

## 1. Purpose

Định nghĩa hợp đồng format trận đấu giữa Team Tournament provision, Referee V5 state, replay/finalize, và official result. Contract này **immutable** sau khi match bắt đầu (ADR-R-004).

---

## 2. Canonical fields

| Field | Type | Required (new match) | Notes |
|-------|------|---------------------|-------|
| `scoringSystem` | `RALLY` \| `SIDE_OUT` | **YES** | Top-level discriminator |
| `scoringVariant` | string | **YES** | e.g. `USAP_2026_PROVISIONAL_RALLY` |
| `pointsToWin` | number | YES | Default **11** for first rally profile |
| `winBy` | number | YES | Default **2** |
| `freezeRule` | `NONE` \| … | YES | **NONE** for R2 rally |
| `serverNumberRule` | `NONE` \| `SIDE_OUT_1_2` | YES | **NONE** for rally |
| `matchType` | `DOUBLES` \| `SINGLES` | YES | R2: **DOUBLES** only for rally |
| `bestOf` | number (odd) | YES | Match-level games to win |
| `ruleSetId` | string | Optional | Registry key; recommended |

### Legacy alias (transitional)

| Legacy | Maps to |
|--------|---------|
| `scoringFormat: "side_out"` | `scoringSystem: SIDE_OUT`, `scoringVariant: SIDE_OUT_DOUBLES_V1` |
| `scoringFormat: "rally"` | **Insufficient alone** — must resolve variant explicitly |

**New matches:** không dùng `scoringFormat` làm nguồn duy nhất — phải có `scoringSystem` + `scoringVariant`.

---

## 3. First supported rally profile

```json
{
  "scoringSystem": "RALLY",
  "scoringVariant": "USAP_2026_PROVISIONAL_RALLY",
  "pointsToWin": 11,
  "winBy": 2,
  "freezeRule": "NONE",
  "serverNumberRule": "NONE",
  "supportedMatchType": "DOUBLES",
  "ruleSetId": "rally_usap_2026_provisional_doubles_v1"
}
```

### Configurable future (not R2-tested)

| `pointsToWin` | `winBy` | Status |
|---------------|---------|--------|
| 15 | 2 | Architecture only |
| 21 | 2 | Architecture only |

Registry `validateFormat()` must accept these values when provisioned; R2 tests cover **11 only**.

---

## 4. Match completion (best-of)

```text
gamesRequiredToWin = ceil(bestOf / 2)
matchComplete when max(teamA.gamesWon, teamB.gamesWon) >= gamesRequiredToWin
```

| bestOf | gamesRequiredToWin | Example final |
|--------|-------------------|-----------------|
| 1 | 1 | 1-0 |
| 3 | 2 | 2-0 or 2-1 |
| 5 | 3 | 3-0, 3-1, or 3-2 |

- **Early termination:** không chơi game thừa khi đã có đội thắng trận.
- `GAME_COMPLETED` / `MATCH_COMPLETED` phải phản ánh early end.
- Official result ghi `gamesWon` thực tế — không pad game chưa đánh.

---

## 5. Game completion (single game)

```text
gameComplete when:
  max(scoreA, scoreB) >= pointsToWin
  AND abs(scoreA - scoreB) >= winBy
```

No freeze conditions in R2 (`freezeRule = NONE`).

---

## 6. Immutability rules

Locked from first `START_MATCH` (or equivalent persisted live state):

- `scoringSystem`, `scoringVariant`, `pointsToWin`, `winBy`, `freezeRule`, `serverNumberRule`, `matchType`, `bestOf`

**Forbidden after start:**

- Patch format via client command
- Replay with different engine than initial state
- Silent default when `scoringSystem` missing on **new** provisioned match

---

## 7. Legacy compatibility

### Old Side-Out matches (no `scoringSystem`)

| Condition | Replay behavior |
|-----------|-----------------|
| `scoringFormat` absent or `"side_out"` | Explicit legacy profile: `SIDE_OUT` + `SIDE_OUT_DOUBLES_V1` |
| `matchType` doubles | `sideOutScoringEngine` |
| Missing variant | Default doubles side-out v1 — **logged**, not silent rally |

### New matches

| Condition | Behavior |
|-----------|----------|
| Missing `scoringSystem` or `scoringVariant` | **Reject** at initialize / provision |
| Unknown `scoringVariant` | **Reject** — no fallback |
| Rally requested but singles | **Reject** in R2 |

**Anti-pattern (cấm):** thiếu field → mặc định Side-Out khi user chọn Rally.

---

## 8. Registry resolution

```text
resolveStrategy(state):
  if state.ruleSetId → registry.get(ruleSetId)
  else derive from scoringSystem + scoringVariant + matchType
  if no match → throw FormatError (no silent fallback)
```

---

## 9. Validation matrix (R2)

| Case | Expected |
|------|----------|
| USAP 2026 doubles 11/2 | Accept |
| USAP 2026 doubles 15/2 | Accept config; tests optional |
| USAP 2026 doubles 21/2 | Accept config; tests optional |
| Rally singles | Reject |
| DreamBreaker variant | Reject |
| freezeRule ≠ NONE | Reject in R2 |
| Legacy side-out replay | Accept via legacy profile |

---

## 10. References

- `V5-R1_OWNER_DECISIONS.md`
- `adr/ADR-004-MATCH-FORMAT-IMMUTABILITY.md`
- `adr/ADR-005-FIRST-RALLY-SCOPE.md`
- `adr/ADR-006-MIGRATION-DECISION-DEFERRED.md`
- `V5-R1B_PERSISTENCE_EVENT_AUDIT.md`
- `V5-R1B_TEAM_TOURNAMENT_INTEGRATION_AUDIT.md`

**Code changes:** DOCUMENTATION ONLY
