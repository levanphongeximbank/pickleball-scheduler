# Club Phase 2E — Test Evidence

## Targeted

```text
node --test tests/club-phase-2e-governance-read-model.test.js
→ 24/24 PASS
```

Covers cases 1–20 (owner/president/VP, missing profile, inactive, profiles.club_id ignore, legacy blob ignore, cross-tenant contract, Home/Members/Management wiring, double-count, member totals, version refresh, VERSION_CONFLICT, loading/error, barrel boundary).

## Club-related

Selected Club governance / My Club / Phase 1–2D suite (excluding pre-existing `club-governance-vice` barrel+JSX Node loader issue): **135/135 PASS**.

## Full unit

```text
npm run test:unit
→ 3342/3342 PASS
```

## ci:prod-gate

```text
npm run ci:prod-gate
→ PASS (error-registry, ownership-lock, competition-architecture-lock, lint:no-new)
```

## Secret / scope

- Secret scan on changed files: **PASS**
- Changed-file scope: **PASS** (club feature, Club UI pages, phase2e docs, 2E tests, unit manifest)

## SQL / Production

- **NO_SQL_REQUIRED**
- No Staging SQL apply
- No Production SQL / deploy
