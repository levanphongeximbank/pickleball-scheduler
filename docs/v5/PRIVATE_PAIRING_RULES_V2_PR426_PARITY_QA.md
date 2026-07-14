# PR-4.26 — Parity QA

## Commands

```bash
node --test \
  tests/pr426-cross-consumer-canonical-parity.test.js \
  tests/canonical-club-repository.test.js \
  tests/canonical-membership-repository.test.js \
  tests/canonical-player-repository.test.js \
  tests/private-pairing-pr425-canonical-picker.test.js \
  tests/private-pairing-rules-pr2.test.js \
  tests/private-pairing-rules-pr3-runtime.test.js \
  tests/private-pairing-rules-pr4-repository.test.js
```

Expected: all PASS (60 in combined PR regression batch including parity).

## ACCC fixture results (flags ON, injected deps)

| Consumer | Result |
|----------|--------|
| Daily Play pool (`listPlayersForClubAware`) | 5 selectable mapped; 5 unmapped in summary; not empty |
| Tournament club picker | Same base pool |
| Athlete / platform roster half | Same mapped/unmapped summary |
| Private Pairing options | Same playerId set |
| Cross-consumer parity | Identical sorted selectable playerIds |
| default-club | Excluded from club list |
| Blob empty | Not required |

## Pre-existing failure

| Test | Baseline (PR-4.25 HEAD) | PR-4.26 |
|------|-------------------------|---------|
| `tests/club-active-membership.test.js` | 7 pass / 1 fail (MyClubPage string) | Same 7/1 — **not new** |

## Flag OFF

Shared adapter + aware helpers preserve legacy blob aggregates; Production default OFF has no behavior change until flags enabled.
