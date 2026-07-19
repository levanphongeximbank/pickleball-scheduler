# Club Phase 2E — Test Evidence

## Targeted

```text
node --test tests/club-phase-2e-governance-read-model.test.js
```

Covers cases 1–20 (owner/president/VP, missing profile, inactive, profiles.club_id ignore, legacy blob ignore, cross-tenant contract, Home/Members/Management wiring, double-count, member totals, version refresh, VERSION_CONFLICT, loading/error, barrel boundary).

## Club-related / full unit / ci:prod-gate

Recorded in Owner report after gate runs on the feature branch.
