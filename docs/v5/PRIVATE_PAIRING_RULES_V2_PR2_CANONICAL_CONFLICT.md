# Private Pairing Rules Engine V2 — PR-2 Canonical Types + Conflict Detector

| Field | Value |
|-------|-------|
| Phase | **PR-2** |
| Date | 2026-07-14 |
| Branch | `feature/private-pairing-rules-v2` |
| Baseline | `add62869e558fc65ac9a08fdea32cea896a1e857` |
| PR-1 docs commit | `51ee143` — docs(pairing): add Private Pairing Rules V2 PR-1 audit |
| PR-2 commits | `26a8818` feat types/validation · `38d3d5b` tests · `0ac03b5` docs |
| Runtime change | **None** — types/validation/conflict only |
| Production | **OFF** |
| Lint (PR-2 paths) | PASS (`npx eslint` on changed files) |
| Lint (full repo) | FAIL — 125 pre-existing errors unrelated to this branch |
| Build | PASS |
| Targeted tests | 231 pass (PR-2 + CC rules/pairing/policy) |

---

## Modules reused (Competition Core)

| Module | Reuse |
|--------|-------|
| `COMPETITION_CONSTRAINT_TYPE` | Extended **additively** with missing opponent/group/repeat types |
| `CONSTRAINT_SEVERITY` (`hard`/`soft`) | Reused as-is |
| `DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE` | Extended for new types |
| `createConstraintConflict` / `detectConstraintConflicts` | Left intact for CC Rules V2; private pairing uses dedicated detector/result contract |
| Rule set id/version fields | Mirrored on private rule contract (`ruleSetId`, `ruleSetVersion`) |
| Feature flags pattern | New keys only; default OFF; not wired to engines |

**No third independent constraint-type registry** — private pairing types are a curated subset of Competition Core values.

---

## Types added (additive to Competition Core)

```text
prefer_opponent
must_opponent
must_not_opponent
same_group
different_group
same_team
different_team
min_partner_repeat
min_opponent_repeat
```

Already present (reused):

```text
prefer_partner, must_partner, avoid_partner, must_not_partner
avoid_opponent, max_partner_repeat, max_opponent_repeat
```

---

## Legacy mapping (private pairing)

| Legacy | Canonical | Notes |
|--------|-----------|-------|
| `prefer_partner` soft | `prefer_partner` soft | — |
| `prefer_partner` hard | `must_partner` hard | Hard prefer → must |
| `avoid_partner` soft | `avoid_partner` soft | — |
| `avoid_partner` hard | `must_not_partner` hard | Hard avoid → must-not |
| `avoid_same_group` | `different_group` | Private-pairing mapping (CC regulatory alias remains `same_club_separation`) |
| `prefer_teammate` | `prefer_partner` | AI policy alias |
| `avoid_teammate` | `avoid_partner` | AI policy alias |

---

## New module layout

```text
src/features/private-pairing-rules/
  constants/   constraintTypes, scopes, enums, codes/flags
  contracts/   normalizePrivatePairingRule
  mappers/     legacyFounderMapping
  validation/  validatePrivatePairingRule (+ certified policy)
  conflicts/   detectPrivatePairingConflicts, scopeTimeOverlap
  index.js
```

Application scopes (`GLOBAL`…`MATCH_DAY`) are **separate** from Competition Core domain scopes (`pairing`/`group`/`match`).

---

## Validation codes

```text
MISSING_CONSTRAINT_TYPE
UNSUPPORTED_CONSTRAINT_TYPE
MISSING_PRIMARY_PLAYER
EMPTY_TARGET_LIST
SELF_TARGET_NOT_ALLOWED
DUPLICATE_TARGET
INVALID_SEVERITY
INVALID_WEIGHT
HARD_WEIGHT_SIMULATION_NOT_ALLOWED
INVALID_PRIORITY
INVALID_RELATION_MODE
RELATION_MODE_NOT_COMPATIBLE
INVALID_SCOPE_TYPE
SCOPE_ID_REQUIRED
INVALID_TIME_RANGE
RULE_EXPIRED
ALL_OF_EXCEEDS_TEAM_CAPACITY
INVALID_VISIBILITY
INVALID_REASON_CATEGORY
REASON_TEXT_REQUIRED
PLAYER_NOT_IN_SCOPE
PLAYER_NOT_FOUND
PRIVATE_RULE_NOT_ALLOWED_IN_CERTIFIED_EVENT
CONSTRAINT_TYPE_NOT_SUPPORTED_IN_CONTEXT
```

---

## Conflict codes

```text
MUST_AND_MUST_NOT_PARTNER
MUST_AND_MUST_NOT_OPPONENT
PARTNER_AND_OPPONENT_CONFLICT
TEAM_CAPACITY_EXCEEDED
IMPOSSIBLE_PARTNER_CHAIN
HARD_RULE_OVERRIDES_SOFT_RULE
SOFT_SOFT_OPPOSITE_PREFERENCE
OVERLAPPING_RULES
CERTIFIED_EVENT_POLICY_CONFLICT
DUPLICATE_RULE_ID
```

Result shape: `{ ok, fatalConflicts, warnings }` with stable `code` / `messageKey` (tests do not depend on Vietnamese text).

---

## Files changed (expected)

- `src/features/competition-core/constants/constraintType.js`
- `src/features/competition-core/types/constraintType.js`
- `src/features/competition-core/constraints/ruleConstants.js` (severity defaults only)
- `src/features/private-pairing-rules/**` (new)
- `tests/private-pairing-rules-pr2.test.js` (new)
- Docs: SPEC, QA, this PR-2 report

---

## Tests

- Targeted: `tests/private-pairing-rules-pr2.test.js`
- Regression: Competition Core rules/constants + pairing-constraints suites
- Feature flags default OFF → no runtime pairing behavior change

---

## Known limitations (deferred to later PRs)

- Not connected to teamPairingEngine / AI / Daily Play / Court Engine / Official draw
- No UI, DB, RLS, RPC, audit tables
- Soft scoring weights not consumed by any runtime yet
- Certified policy is validation-layer only
- Chain detection uses forced edges (ALL_OF + single-target MUST); richer ANY_OF feasibility SAT reserved for PR-3

---

## PR-3 plan

1. Hard-filter candidates using private pairing rules (no penalty simulation).
2. Soft scoring + explanation contract.
3. Bridge adapter from founder constraints → private rules under Unified flag.
4. Still no Production deploy without owner GO.

---

## Rollback

Delete/revert PR-2 commits on `feature/private-pairing-rules-v2`. Additive CC type keys are unused by runtime when flags OFF; safe to leave or revert with the branch.
