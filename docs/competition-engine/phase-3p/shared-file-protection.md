# Shared File Protection — Phase 3P

## Rule

```text
Protected files = Integrator Chat only
  OR Owner-approved integration phase
Capability chats MUST NOT modify protected files
```

## Protected files (Integrator-only)

| File | Why |
|------|-----|
| `src/features/competition-core/index.js` | Monolithic public barrel — highest conflict |
| `src/features/competition-core/runtime-control/index.js` | Control-plane public surface |
| `src/features/competition-core/runtime-control/shadow/index.js` | Shadow public surface |
| `src/features/competition-core/runtime-control/constants/runtimeScopes.js` | Capability/executor enums |
| `src/features/competition-core/runtime-control/resolvers/resolveRuntimeDecision.js` | Mode clamp / safety |
| `src/features/competition-core/runtime-control/shadow/resolvers/resolveShadowEligibility.js` | Default deny |
| `src/features/competition-core/config/featureFlags.js` | All V2 gates |
| `src/features/competition-core/adapters/legacyAdapter.js` | Multi-engine dispatcher |
| `src/features/competition-core/participants/index.js` | Shared barrel |
| `src/features/competition-core/participants/contracts/index.js` | Shared barrel |
| `src/features/competition-core/participants/validators/index.js` | Shared barrel |
| `src/features/competition-core/participants/mappings/index.js` | Shared barrel |
| `src/features/competition-core/participants/ports/index.js` | Shared barrel |
| `src/features/competition-core/participants/dto/index.js` | Shared barrel |
| `scripts/ci/unit-test-files.json` | Official unit test manifest |
| `scripts/ci/competition-architecture-lock.mjs` | Architecture lock runner |
| `scripts/ci/competition-architecture-lock-baseline.json` | Debt baseline |
| `package.json` / lockfiles | Scripts & deps |
| Docs indexes that list all phases | Shared documentation indexes |

## Shared but capability-touchable (with rules)

| File / area | Rule |
|-------------|------|
| `participants/contracts/identity.js` | 3B only |
| `participants/contracts/entryRegistration.js` | 3C only |
| `participants/contracts/teamRosterLineup.js` | Sequential 3D→3E; no parallel edits |
| `seed/**`, `draw/**`, etc. | Owning phase only |
| Format adapters `*/adapters/competition-core/*` | Owning format phase; no cross-format drive-by |

## Forbidden for all capability chats (until Owner GO)

| Action | Status |
|--------|--------|
| Production request-path wiring | Forbidden |
| Enable feature flags / Shadow | Forbidden |
| Database migrations | Forbidden |
| Expand architecture-lock baseline debt | Forbidden (fail CI) |
| Edit Legacy retirement deletes | Forbidden (3N only) |

## Enforcement (process)

1. Capability PR description must list **Changed files** and assert **Shared files touched = none** (or Integrator co-authored).
2. Integrator PR is the only PR allowed to touch protected list.
3. Owner rejects capability PR that edits protected files without Integrator.
