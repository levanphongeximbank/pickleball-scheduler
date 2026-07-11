# CC-01 — Domain Model

**Phase:** CC-01 | **Date:** 2026-07-11 | **Depends on:** CC-00 (`91df91b`)

---

## 1. Module layout

```text
src/features/competition-core/
├── constants/          # Canonical enums (DrawMode, EngineType, …)
├── types/              # JSDoc typedefs
├── config/             # Feature flags + env reader
├── contracts/          # Factory helpers for engine envelopes
├── adapters/           # Legacy adapter shell (no route wiring)
├── utils/              # Input clone, legacy terminology mapping
└── index.js            # Public API (no side effects on import)
```

---

## 2. Constants

| Constant | Values | Notes |
|----------|--------|-------|
| `DRAW_MODE` | `pure_random`, `constrained_random`, `skill_controlled`, `manual` | Does **not** replace legacy `open` in CC-01 |
| `COMPETITION_RATING_STATUS` | `provisional`, `verified`, `locked`, `suspended` | Target model; Pick_VN DB enum unchanged |
| `RATING_SOURCE` | `questionnaire`, `manual`, `tournament`, `monthly_review`, `migration`, `club`, `system` | |
| `CONSTRAINT_SEVERITY` | `hard`, `soft` | |
| `COMPETITION_CONSTRAINT_TYPE` | 10 types (must/prefer partner, gender, skill cap, …) | Parallel to legacy pairing-constraints |
| `COMPETITION_ENGINE_TYPE` | `draw`, `team_formation`, `matchmaking`, `scheduling`, `standings`, `rating` | |
| `ENGINE_RUN_STATUS` | `pending`, `running`, `completed`, `failed`, `cancelled` | |
| `RATING_ELIGIBILITY_STATUS` | `eligible`, `ineligible`, `requires_review` | CC-02+ |

Version: `COMPETITION_CORE_VERSION = "0.1.0-cc01"`.

---

## 3. Contracts (JSDoc)

Defined in `types/index.js`, factories in `contracts/engineContracts.js`:

| Contract | Purpose |
|----------|---------|
| `CompetitionEngineInput` | Normalized engine request |
| `CompetitionEngineResult` | Envelope with success, score, explanations, metadata |
| `EngineValidationResult` | ok / errors / warnings / conflicts |
| `EngineScoreBreakdown` | Component scores 0–100 (future) |
| `EngineExplanation` | Human-readable reason codes |
| `EngineRunMetadata` | Version, seed, actor, legacy engine id |
| `RatingSnapshot` | Target rating fields (optional/null in CC-01) |
| `DrawConfiguration` | mode, groupCount, randomSeed, ruleSet* |
| `ConstraintDefinition` | type, severity, params |
| `ConstraintConflict` | Structured conflict for CC-03 |

### CompetitionEngineResult minimum fields

```text
success, engineType, engineVersion, result, validation, score,
scoreBreakdown, explanations, warnings, metadata, error, executionPath
```

---

## 4. Module relationships

```text
UI / Routes (unchanged CC-01)
        │
        ▼ (future CC-04+)
competition-core/adapters/legacyAdapter
        │
        ├── config/featureFlags → envReader
        ├── contracts → normalize envelope
        └── utils/inputClone → preserve payload
                │
                ▼ (injected legacyExecutor only)
        legacy engines (drawEngine, pairing.js, …)
```

**CC-01:** No production route imports `competition-core` yet.

---

## 5. Domain vs UI separation

| Layer | Responsibility |
|-------|----------------|
| `competition-core` | Rules, enums, flags, engine contracts, adapter shell |
| `src/tournament/engines/*` | Legacy business logic (untouched) |
| `src/ai/*` | Matchmaking legacy (untouched) |
| Pages / routes | UX — must not embed draw/rating algorithms |

UI explainability (CC-09) will consume `EngineExplanation[]` from adapter results.

---

## 6. Decisions deferred (not in CC-01)

- Rating V2 schema / `mapCompetitionEloToSkill`
- `isMatchRatingEligible`
- Hard constraint pipeline (CC-03)
- Draw V2 implementation (CC-04)
- Route wiring / shadow mode (CC-12)
- Mapping Pick_VN `rating_status` → `COMPETITION_RATING_STATUS` (CC-02)

---

## 7. Import policy

`src/features/competition-core/index.js` exports constants, flags, contracts, adapter utilities only.

**No** imports from `eloEngine`, `drawEngine`, `pairing.js`, `clubStorage`, or Supabase clients.
