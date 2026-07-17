# 07 — Public API Exports

Approved participant symbols are exported from:

```text
src/features/competition-core/index.js
```

Format modules must import the public barrel — not deep paths under `participants/`.

Exports include enums, factories, validators, DTOs, mapping fixtures, and port shape helpers listed in `participants/index.js`.

Architecture lock must continue to PASS without baseline expansion for this phase.
