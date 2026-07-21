# CORE-09 — Ports

## DrawResultPort (read-only)

**Methods:** `resolveDrawSnapshot(request) → DrawResolveResult`

Resolves a frozen CORE-09 `DrawSnapshot` containing:

- `drawId`, `drawVersion`, `drawFingerprint`
- `competitionId`, `divisionId`, `categoryId` (where applicable)
- stage definitions
- group / bracket / participant / bye placements
- seed references
- deterministic ordering metadata
- `completionStatus`

### Fail closed when

- Draw incomplete
- Draw fingerprint absent
- Participant placement duplicated or missing
- Group / bracket references invalid
- Non-empty group/bracket ref with empty catalog (`DRAW_CATALOG_EMPTY`)
- Draw version / fingerprint does not match request

### Must not

- Rerun Draw
- Shuffle placements
- Move participants between groups
- Reassign bracket positions
- Select new byes

**Test doubles:** `createFailClosedDrawResultPort`, `createFixedDrawResultPort`

---

## MatchGenerationRulePort (read-only)

**Methods:** `resolveEvaluatedRules(request) → RuleResolveResult`

Resolves `EvaluatedMatchGenerationRules` containing:

- `ruleSetId`, `ruleSetVersion`, `ruleEvaluationFingerprint`
- `operation` = CORE-01 **`MATCHUP`** (alias `MATCH_GENERATE` → `MATCHUP`)
- generation strategy
- round-robin mode, encounter count
- bracket size / bye / third-place / consolation policies
- rematch / same-club restrictions
- format-specific approved constraints
- deterministic seed policy where applicable

### Intended direction

Evaluate rules once → bind evaluated snapshot → generate whole MatchPlan.

### Must not

- Implement a second Rule Engine
- Reinterpret unsupported rules silently
- Default unknown policies permissively
- Evaluate live mutable rules during individual match creation

**Test doubles:** `createFailClosedMatchGenerationRulePort`, `createFixedMatchGenerationRulePort`
