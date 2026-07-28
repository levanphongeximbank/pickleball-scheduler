# Test Manifest

| Test file | Coverage |
|-----------|----------|
| `tests/platform-hard-cutover-01-phase-04-authority.test.js` | Runtime matrix basics, legacy fail-closed |
| `tests/platform-hard-cutover-01-phase-04-competition-ssot.test.js` | M8 adapter, single finalize writer, no silent fallback |
| `tests/platform-hard-cutover-01-phase-04-rating.test.js` | Elo separation, idempotency, frozen club blob writer |
| `tests/platform-hard-cutover-01-phase-04-package.test.js` | SQL package safety + marker |
| `tests/private-pairing-hard-cutover-01.test.js` | Private Pairing authority matrix, legacy picker forbid, missing-rating fail-closed |
| `tests/platform-hard-cutover-01-pre-staging-authority.test.js` | Expanded matrix fields + required domains |
| `tests/platform-hard-cutover-01-pre-staging-coaching.test.js` | Coaching HC fail-closed / no LS SoT |
| `tests/platform-hard-cutover-01-pre-staging-messaging.test.js` | Messaging HC never DEMO |
| `tests/platform-hard-cutover-01-pre-staging-dashboard.test.js` | Dashboard mock/LS forbidden under HC |
| `tests/platform-hard-cutover-01-pre-staging-reseed.test.js` | Reseed package static verification |

Registered in `scripts/ci/unit-test-files.json`.
