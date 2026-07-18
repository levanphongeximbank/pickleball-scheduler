# 07 — Shadow Parity Model

**Runner:** `runShadowMapping` / `runSingleShadowMap`  
**Path:** `src/tournament/adapters/competition-core/shared/shadowRunner.js`

## Flow

```text
Legacy/format input
  → current runtime continues (untouched)
  → adapter maps same input
  → canonical validation (in adapter)
  → shadow diagnostics / parity report
```

## Forbidden in shadow

- Match generation / standings / draw / scheduling / lineup mutation
- DB writes (`attemptPersist` throws)
- Production executor calls (`attemptExecutor` throws)
- Production UI
- Blocking current runtime

Phase 2B.3 does **not** wire a runtime shadow hook. Tests/QA call the runner explicitly.

## Parity classifications

```text
EXACT
SEMANTIC_MATCH
EXPECTED_FORMAT_EXTENSION
MISSING_OPTIONAL_DATA
MAPPING_WARNING
MAPPING_FAILURE
BLOCKER
```

Dimensions covered in tests: identity, entry, team/roster, lineup, snapshot.
