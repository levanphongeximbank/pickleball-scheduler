# TT-6C — Multi-device Staging Test Plan

**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Probe tournament:** `phase23d-probe-tournament`

## Profiles

1. BTC browser A
2. BTC browser B
3. Captain A
4. Captain B
5. Referee V5

## Scenarios (23 steps)

See owner TT-6C spec §11. Automated partial coverage:

- `verify-phase-tt6c-staging.mjs` — RPC + security gates
- `verify-phase-tt6c-preview-smoke.mjs` — browser render + connection badge

Full multi-device flow requires manual or extended Playwright with 5 contexts (TT-6D candidate).
