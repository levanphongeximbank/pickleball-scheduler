# Phase 3B — Participant Resolution Runtime

```text
Chat: CHAT 1
Phase: 3B — Participant Resolution Runtime
Branch: feature/competition-engine-phase-3b-participant-runtime
Pattern: Strangler (Legacy executor remains Production primary)
```

## Purpose

Introduce the first Competition Core **capability runtime** that resolves participants through a unified abstraction:

```text
Competition Core
  → Participant Runtime
    → ParticipantResolver
      → ParticipantAdapter
        → LegacyParticipantAdapter
          → Legacy source (map-only)
```

Production behavior is unchanged. Legacy remains the only executor. No Canonical adapter. No feature-flag / Shadow enablement. No Integrator registry registration in this phase.

## Document index

| File | Topic |
|------|-------|
| [architecture.md](./architecture.md) | Layering and ownership |
| [sequence.md](./sequence.md) | Resolve sequence |
| [runtime-flow.md](./runtime-flow.md) | Resolver responsibilities |
| [adapter-flow.md](./adapter-flow.md) | Adapter rules |
| [identity-model.md](./identity-model.md) | ParticipantIdentity |
| [error-model.md](./error-model.md) | Typed runtime errors |
| [testing.md](./testing.md) | Unit + architecture tests |
| [limitations.md](./limitations.md) | Known gaps |
| [production-safety.md](./production-safety.md) | Safety evidence |

## Related

- Phase 3A.3 registries (Integrator): `docs/competition-engine/phase-3a3/`
- Phase 3P ownership: `docs/competition-engine/phase-3p/`
- Entry criteria: `docs/competition-engine/phase-3a3/phase-3b-entry-criteria.md`
- Integrator Wave 1: `docs/competition-engine/phase-3b/integration/`
