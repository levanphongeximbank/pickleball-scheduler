# Limitations — Phase 3B

```text
No root public export (Integrator Wave 1)
No registry registration (Integrator)
No official manifest merge (Integrator)
No Production request-path callers
No Canonical adapter / executor
No real DB persistence
No format-specific adapters beyond Legacy player map
No Registration / Team / Lineup runtime
Shadow helpers are local — not wired to resolveShadowEligibility
```

Identity helpers added to `contracts/identity.js` are not yet re-exported from Integrator-owned `contracts/index.js` / `participants/index.js`.
