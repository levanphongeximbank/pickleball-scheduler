# Club Phase 2F — Test Evidence

## Targeted Phase 2F

```text
node --test tests/club-phase-2f-governance-ui-certification.test.js
→ 28/28 PASS
```

## Club Phase 2 + governance pack

```text
node --test \
  tests/club-phase-2f-governance-ui-certification.test.js \
  tests/club-phase-2e-governance-read-model.test.js \
  tests/club-phase-2d-governance-writer.test.js \
  tests/club-phase-2c-membership-parity.test.js \
  tests/club-governance.test.js \
  tests/club-v2-myclub-source-of-truth.test.js \
  tests/myclub-members-v2.test.js \
  tests/club-v2-manage-members-read.test.js \
  tests/club-phase-1c-integration-ui.test.js
→ 141/141 PASS
```

## Full unit

```text
npm run test:unit
→ 3370/3370 PASS
```

## ci:prod-gate

```text
npm run ci:prod-gate
→ PASS (error-registry, ownership-lock, competition-architecture-lock, lint:no-new)
```

## Build

```text
npm run build
→ PASS (vite build + PWA precache)
```

## Secret / scope

- Secret scan on changed files: **PASS** (no credentials)
- Changed-file scope: **PASS** (Club governance UI, Phase 2F docs/tests, unit manifest)

## SQL / Production

- **NO_SQL_REQUIRED**
- No Staging/Production SQL apply
- No deploy
- No customer data mutation
