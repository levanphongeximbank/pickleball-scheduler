# Testing — Phase 3A.2

## Files

```text
tests/competition-core-runtime-shadow-3a2.test.js
tests/competition-core-runtime-shadow-3a2-architecture.test.js
```

Registered in `scripts/ci/unit-test-files.json`.

## Unit coverage (minimum)

- Default eligibility false
- Shadow disabled / canonical disallowed / kill switch
- Capability / operation not allowed
- Invalid request / sampling excluded
- Eligible with injected dependencies
- Default plan → Legacy; Canonical never return source
- Comparison equivalent / non-equivalent / not comparable
- Legacy / canonical / both error
- Structured differences + stable reason codes
- Diagnostics no persistence side effect
- Audit factories pure data
- Input immutability + deterministic output

## Architecture coverage

- No env / clock / RNG / Supabase / React / MUI
- No pages / components / format runtime imports
- No executor invocation / persistence / Production wiring
- Safety defaults: eligibility false, return source LEGACY
