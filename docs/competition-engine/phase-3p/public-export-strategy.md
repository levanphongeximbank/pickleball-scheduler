# Public Export Strategy — Phase 3P

## Problem

`src/features/competition-core/index.js` is a single barrel exporting constants, rating, constraints, draw, seed, formation, matchmaking, standings, scheduling, participants, and runtime-control. Parallel capability chats editing this file will conflict every wave.

## Options evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| **A** | Capability chat self-exports into root index | Rejected — conflict magnet |
| **B** | Capability-local index; Integrator exports last | **SELECTED** |
| **C** | Generated exports | Deferred — tooling cost; not needed yet |
| **D** | Registry-based export | Partial later for runtime registries; not for all public symbols |

## Official decision (Phase 3B–3L)

```text
Option B — Capability-local index, Integrator export cuối
```

### Mechanism

1. Each capability owns a local public surface:

```text
src/features/competition-core/<capability>/index.js
```

Examples already exist: `seed/index.js`, `draw/index.js`, `participants/index.js`.

2. New runtime symbols are exported from the **capability-local** index only in the capability PR.

3. Capability PR **MUST NOT** edit root `src/features/competition-core/index.js`.

4. Integrator PR re-exports new symbols from root index (and updates any docs API lists).

5. For `participants/` sub-capabilities (Registration/Team/Lineup), prefer:

```text
participants/runtime/<name>/index.js
```

and keep `participants/index.js` Integrator-owned.

### Consumer guidance during parallel waves

- Internal competition-core modules may import capability-local paths.
- External (format/legacy) consumers should continue importing from root **after** Integrator merge; do not add new deep imports from Production paths without Owner GO.

### Future (optional, not Phase 3P)

- Option C codegen from `exports.manifest.json`
- Option D registry for executors/comparators only (see runtime-registry-ownership.md)
