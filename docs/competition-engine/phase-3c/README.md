# Phase 3C — Registration Resolution Runtime

```text
Chat: Phase 3C Registration Runtime
Phase: 3C — Registration Runtime
Branch: feature/competition-engine-phase-3c-registration-runtime
Base: fbc9f22 (Phase 3B Integrator Wave 1 on main)
Pattern: Strangler (Legacy registration remains Production primary)
```

## Purpose

Introduce Competition Core **Registration Runtime** that maps legacy registration sources into the canonical Competition Registration model:

```text
Competition Core
  → Registration Runtime
    → RegistrationResolver
      → RegistrationAdapter
        → LegacyRegistrationAdapter
          → Legacy Individual Entry / Official BTC / Team Registration
```

Production behavior is unchanged. No root export. No official CI manifest merge. No persistence. No runtime cutover.

## Owner architecture locks

| Decision | Value |
|----------|-------|
| Kinds | `INDIVIDUAL`, `TEAM` only |
| Pair | metadata |
| Guest | Participant type |
| Representative / Captain | roles (metadata) |
| Folder | `competition-core/registrations/**` |
| Legacy `active` | → `APPROVED` |
| Team registration | in Phase 3C (not deferred to 3D) |
| Official BTC | `SourceType`, not kind |
| Participant Runtime | dependency injection only |

## Document index

| File | Topic |
|------|-------|
| [architecture.md](./architecture.md) | Layering and ownership |
| [source-audit.md](./source-audit.md) | Pre-implementation audit summary |
| [canonical-registration-model.md](./canonical-registration-model.md) | Canonical fields |
| [identity-contract.md](./identity-contract.md) | Deterministic identity |
| [adapter-contract.md](./adapter-contract.md) | Adapter rules |
| [resolver-behavior.md](./resolver-behavior.md) | Resolver responsibilities |
| [error-model.md](./error-model.md) | Typed runtime errors |
| [production-safety.md](./production-safety.md) | Safety evidence |
| [ownership-manifest.md](./ownership-manifest.md) | File ownership |
| [integrator-handoff.md](./integrator-handoff.md) | Integrator Wave checklist |
| [known-limitations.md](./known-limitations.md) | Known gaps |

## Related

- Phase 3B Participant Runtime: `docs/competition-engine/phase-3b/`
- Phase 3P ownership: `docs/competition-engine/phase-3p/`
- Entry/Registration contracts: `participants/contracts/entryRegistration.js`
