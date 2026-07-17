# 08 — Test and Parity Evidence

## New tests

```text
tests/competition-core-participants-2b2.test.js
```

Covers OD-01…OD-10 contract rules, lineup revision immutability, mapping fixtures, port shape, import boundaries, and flag-OFF default.

Architecture public-API assertions updated in:

```text
tests/competition-architecture-boundaries.test.js
```

## Gate results (local, pre-commit)

| Gate | Result |
|------|--------|
| `npm run ci:competition-architecture-lock` | PASS — 0 new/changed (debt baseline 13) |
| `npm run lint:no-new` | PASS — 0 new lint violations |
| `npm test` | PASS — 2596/2596 |
| `npm run build` | PASS (prebuild foundation-lock + lint:no-new + vite build) |

## Parity note

No Production execution path changes. Shadow mappers are fixtures only. Competition Core flags remain default OFF.
