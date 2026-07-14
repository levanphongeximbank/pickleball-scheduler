# Private Pairing Rules Engine V2 — PR-3 Unified Runtime

| Field | Value |
|-------|-------|
| Phase | **PR-3** |
| Date | 2026-07-14 |
| Branch | `feature/private-pairing-rules-v2` |
| Baseline | `add62869e558fc65ac9a08fdea32cea896a1e857` |
| PR-2 HEAD | `3e024cf` |
| Runtime change when flags OFF | **None** |
| Production | **OFF** |

---

## Runtime architecture

```text
legacy founderPairingConstraints / founder policies
        │
        ▼
resolveActivePrivatePairingRules
  • normalize + legacy map
  • scope + time filter
  • certified policy gate
  • validate + conflict detect
  • dedupe equivalent rules
        │
        ├─ hard rules ──► evaluateHardPrivatePairingRules (reject)
        └─ soft rules ──► scoreSoftPrivatePairingRules (score only)
        │
        ▼
generateTeamPairingCandidates (seeded, bounded)
        │
        ▼
rank feasible candidates
  fairness → balance → history → constraintScore → id tie-break
        │
        ▼
explanation envelope + ruleSetVersion
```

Module: `src/features/private-pairing-rules/runtime/`

Reuses PR-2 validation/conflict detector and Competition Core severity/types. Does **not** invent a third constraint-type registry.

---

## Hard-filter behavior

Absolute reject codes:

| Code | Meaning |
|------|---------|
| `VIOLATES_MUST_PARTNER` | Required partners not together |
| `VIOLATES_MUST_NOT_PARTNER` | Forbidden partners together |
| `VIOLATES_MUST_OPPONENT` | Required opponents not facing |
| `VIOLATES_MUST_NOT_OPPONENT` | Forbidden opponents facing |
| `NO_FEASIBLE_PAIRING` | No surviving candidate |
| `PAIRING_SEARCH_LIMIT_REACHED` | Search budget exhausted without feasible |
| `RULE_SET_CONFLICT` | Preflight conflict |
| `RULE_VALIDATION_FAILED` | Invalid rule config (e.g. ALL_OF over capacity) |

Hard is **never** simulated as `-100/-120/-200` under unified runtime. Founder `avoid_teammate` HIGH is mapped to MUST_NOT_PARTNER reject; legacy policy score for `source=founder` is skipped when runtime flags ON.

---

## Soft scoring

Supported: PREFER/AVOID PARTNER & OPPONENT, MAX_PARTNER_REPEAT, MAX_OPPONENT_REPEAT.

Per candidate scores:

```text
balanceScore | fairnessScore | historyScore | constraintScore | finalScore
```

Soft cannot resurrect a hard-infeasible candidate.

---

## ANY_OF / ALL_OF

- ANY_OF: ≥1 target satisfies the relation.
- ALL_OF: all targets must satisfy; capacity validated before run for MUST_PARTNER.

---

## Scope / time

Active when `active` and within `[startAt, endAt)` (open ends allowed). Scope match: GLOBAL always; otherwise `scopeType`+`scopeId` vs context ids. Narrower scopes do not erase broader. Conflicts must clear before search.

---

## Official / Certified / VPR

Personal preference types (PREFER/MUST partner & opponent) blocked unless `visibility=disclosed|public` **and** `allowedByPublishedRules=true`. Enforcement in resolve layer (not UI).

---

## Consumer integration

| Consumer | PR-3 |
|----------|------|
| `teamPairingEngine.suggestTeamsFromPlayers` | Yes — when both flags ON |
| AI `calculatePairScore` | Yes — hard reject + soft constraintScore |
| Daily Play / SelectPlayers | Indirect via AI scoring when policies present |
| Internal tournament | Indirect via teamPairingEngine if caller passes constraints + flags |
| Official draw Production path | **Not** integrated |
| Court Engine | **Not** integrated |
| Team Tournament lineup | **Not** integrated |

---

## Feature flags

```text
VITE_PRIVATE_PAIRING_RULES_ENABLED
VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED
```

Runtime requires **both** ON (`isPrivatePairingRuntimeEnabled`).

| Flags | Behavior |
|-------|----------|
| Either OFF | Legacy optimize / AI policy penalties unchanged |
| Both ON | Unified hard reject + soft score |

Production: keep OFF.

---

## Legacy adapter

`mapLegacyFounderConstraint` + policy→legacy inside scoring. Dedup prefers higher `ruleSetVersion`. Does not rewrite stored blobs.

---

## Benchmarks (local, maxCandidates=48)

| Players | candidateCount | rejected | elapsedMs |
|---------|----------------|----------|-----------|
| 8 | 48 | ~5 | ~11 |
| 16 | 48 | ~1 | ~2 |
| 32 | 48 | ~1 | ~2 |

Guards: `maxCandidates`, `maxIterations`, deterministic seeded RNG (no unseeded `Math.random` in runtime search).

---

## Tests

- `tests/private-pairing-rules-pr3-runtime.test.js`
- PR-2 + pairing + policy + Competition Core rules suites regression

---

## Known limitations

- Opponent rules only evaluated when `matchOption` present (AI match path); team-formation search applies partner hard/soft.
- Official Production draw / Court Engine not wired.
- No UI / DB / RLS / audit tables.
- Soft MIN_* repeat not scored yet.
- Full-repo ESLint still has 125 pre-existing errors (unchanged).

---

## Rollback

1. Keep both flags OFF (immediate behavior restore).
2. Or revert PR-3 commits on `feature/private-pairing-rules-v2`.

---

## Verdict PR-4

**GO** for Staging DB/RLS/RPC/audit design — after this runtime base. Still no Production.
