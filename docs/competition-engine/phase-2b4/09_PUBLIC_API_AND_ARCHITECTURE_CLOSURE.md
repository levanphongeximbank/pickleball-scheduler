# 09 — Public API and Architecture Closure

## Public API (`src/features/competition-core/index.js`)

Exports contracts, validators, DTOs, repository port method lists, and `matchesRepositoryPortShape`.

Does **not** export:

- Phase 2B.4 test helpers
- Format-specific policy constants
- Adapter modules

Format adapters import only the public barrel — no `participants/` deep imports.

## Architecture

```text
Core → Format: FORBIDDEN
Format → Core public API: ALLOWED
Format → Core deep import: FORBIDDEN
```

`npm run ci:competition-architecture-lock` must remain PASS with 0 new/changed and debt baseline unchanged (13) unless proven reduced.
