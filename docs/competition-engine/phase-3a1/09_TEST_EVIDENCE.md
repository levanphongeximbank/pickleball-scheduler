# 09 — Test Evidence

## Official files

| File | Role |
|------|------|
| `tests/competition-core-runtime-control-3a1.test.js` | Unit / purity / precedence / kill switch |
| `tests/competition-core-runtime-control-3a1-architecture.test.js` | Import / purity boundary locks |

Both registered in `scripts/ci/unit-test-files.json`.

## Coverage themes

- Default LEGACY_ONLY
- Kill switch precedence
- Global OFF vs tenant/competition ON
- Format vs capability gating
- Shadow disabled path
- Invalid input fail-safe (no throw)
- Input immutability + deterministic output
- Transition forbid LEGACY_ONLY → CANONICAL_ONLY
- selectedExecutor always LEGACY
