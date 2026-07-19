# CORE-01 — Competition Rule Engine Foundation

**Phase:** WAVE 1 / CORE-01 Phase 1
**Date:** 2026-07-19
**Status:** Foundation contracts + deterministic resolution (no Production wiring)

---

## Naming clarification (mandatory)

| This workstream | **Not** this |
|-----------------|--------------|
| **CORE-01** = Competition **Rule Engine** Foundation | Historical **CC-01** domain foundation docs |
| Extends `constraints/**` | Phase **3P Wave 1** Participant Runtime (`participants/runtime/**`) |

`constraints/**` remains the **single source of truth (SSOT)** for Competition Core rules.
This phase does **not** create a second rule engine or fork the CC-03A evaluation pipeline.

---

## Scope (Phase 1)

| In scope | Out of scope |
|----------|--------------|
| Authority contract (SUPER_ADMIN…DEFAULT) | Private Pairing cutover |
| Canonical operations | UI / format runtime wiring |
| Deterministic resolution + trace | Feature flag enablement |
| Fail-closed isolation options | SQL / deploy / root barrel |
| Lookup ports (interfaces/stubs only) | Participant / Division persistence schemas |

---

## Module layout

```
src/features/competition-core/constraints/
  authority/     RULE_SOURCE + comparator
  operations/    RULE_OPERATION + match/aliases
  resolution/    resolveRulesDeterministic + trace
  ports/         Participant / Entry / Division lookup interfaces
  (existing CC-03A files — additive only)
```

**Public export path (Phase 1):** `constraints/index.js` only.
Root `competition-core/index.js` is Integrator follow-up.

---

## Related docs

- `CORE01_AUTHORITY_AND_PRECEDENCE.md`
- `CORE01_OPERATION_MODEL.md`
- `CORE01_RESOLUTION_TRACE.md`
- `CORE01_TEST_MATRIX.md`
- `CORE01_PHASE1_COMPLETION_REPORT.md`

---

## Private Pairing note

Authority values and comparator ladder are lifted into Competition Core for parity.
`private-pairing-rules/**` is **unchanged** in Phase 1. Cutover to consume canonical authority is a **separate PR**.
