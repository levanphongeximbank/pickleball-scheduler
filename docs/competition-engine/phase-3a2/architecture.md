# Architecture — Phase 3A.2 Shadow Infrastructure

## Placement

Shadow Infrastructure lives **inside** Competition Core runtime-control:

```text
src/features/competition-core/runtime-control/shadow/
```

It is **not** a standalone engine outside the control plane.

## Strangler pattern

```text
Production request
    → Legacy = primary result (unchanged)
    → (future) Canonical shadow compare
    → diagnostics only
    → Production return source remains Legacy
```

Phase 3A.2 implements only the **contracts and pure resolvers** for the shadow side of that diagram.

## Relation to existing assets

| Asset | Role in 3A.2 |
|-------|----------------|
| Phase 3A.1 `resolveRuntimeDecision` | Supplies `shadowAllowed` / `canonicalAllowed` (still false in Production) |
| Phase 2B.3 `shadowRunner.js` (tournament adapters) | **Not imported** — test/QA mapping runner stays separate |
| Capability shadow parity helpers (`run*ShadowComparison`) | **Not imported** — domain-specific; 3A.2 is generic |

## Forbidden dependencies

Shadow domain modules must not import:

- `src/pages/`, `src/components/`
- format runtimes / team-tournament / daily-play / tournaments UI
- Supabase client, React, MUI
- `process.env`, `Date.now`, `Math.random`, `fetch`, storage APIs

Time and sampling are **injected**.

## Public exports

Re-exported via:

- `src/features/competition-core/runtime-control/index.js`
- `src/features/competition-core/index.js`
