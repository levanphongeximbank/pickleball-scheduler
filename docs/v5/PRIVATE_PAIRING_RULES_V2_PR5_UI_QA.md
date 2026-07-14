# PR-5 UI QA

## Commands

```bash
node --test \
  tests/private-pairing-rules-pr5-admin-ui.test.js \
  tests/private-pairing-rules-pr5-ui-permissions.test.js \
  tests/private-pairing-rules-pr45-simulation.test.js \
  tests/private-pairing-rules-pr2.test.js \
  tests/private-pairing-rules-pr3-runtime.test.js \
  tests/private-pairing-rules-pr4-repository.test.js \
  tests/private-pairing-pr425-canonical-picker.test.js \
  tests/pr426-cross-consumer-canonical-parity.test.js
```

## Checklist

| Area | Result |
|------|--------|
| Menu permission + feature flag | Covered in pr5-ui-permissions |
| Route permission | Covered |
| Panel composition | Covered |
| No Apply button | Covered |
| Simulation API wired | Covered |
| Labels VI | Covered |
| Regression PR-2…4.5 | Run with batch |

## Pre-existing

`club-active-membership` 7 pass / 1 fail — unchanged baseline.
