# E2E-02 — Composition Flow

```text
Competition Definition (CM-01)
    → Template Selection (CM-02 + E2E-02 seed)
    → Template Instantiation (CM-02 plan/patch)
    → Format Validation (E2E-02 format definition)
    → Participant list + deterministicSeed
    → Pool Grouping (CORE-08 snake/seeded/serpentine)
    → Pool DrawSnapshot adapter (CORE-08 → CORE-09 shape)
    → GROUP_ROUND_ROBIN MatchPlan (CORE-09)
    → Schedule / Court input preparation (refs only)
    → Pool standings (CORE-18) or injected ranked rows
    → Qualification & Advancement (E2E-02 policy boundary)
    → Knockout DrawSnapshot (CORE-08 bracket slots + byes)
    → SINGLE_ELIMINATION MatchPlan (CORE-09)
    → Runtime-ready composition bag (+ E2E-01 ports)
```

## Stage gates

1. **Pool incomplete** → knockout/qualification rejected (`E2E02_POOL_STAGE_INCOMPLETE`).
2. **Unresolved tie at cut** → fail-closed (`E2E02_UNRESOLVED_TIE`).
3. **Invalid/unaccepted/void results** → excluded from standings inputs.
4. **Withdrawn/DQ** → excluded from qualifier selection.
5. **Duplicate qualifier** → rejected.
6. **Singleton pool** → rejected (`INVALID_POOL_SIZING`) before CORE-09 call.

## Primary API

- `composeIndividualPoolKnockout(input)`
- `createPoolKnockoutRuntimeComposition(input)` — CM resolve + instantiate + compose + E2E-01 ports
