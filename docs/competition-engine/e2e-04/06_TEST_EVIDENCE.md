# E2E-04 — Test Evidence

## Targeted

```bash
node --test tests/competition-engine-e2e-04-player-referee-operations.test.js
```

Expected: **12/12 PASS** covering:

- Architecture: no Supabase / Date.now / Math.random / E2E-05 imports
- Player mapping, wrong playerId, missing tenant, client grants
- Check-in success/idempotency/wrong entry/closed/not-open/ineligible
- Private schedule isolation + deterministic fingerprint
- Referee queue, unassigned rejection, lifecycle, score gates
- Validation pending vs accepted + standings eligibility
- Portal section builders

## Adjacent (run in CI / local verification)

- `tests/competition-engine-e2e-03-organizer-operations.test.js`
- `tests/competition-engine-e2e-01*.test.js` / `e2e-02*` if present
- CORE-13/15/16/17 targeted suites as available

## Gates

- ESLint
- `npm run ci:foundation-lock`
- `npm run build`
- `package.json` / `package-lock.json` unchanged
