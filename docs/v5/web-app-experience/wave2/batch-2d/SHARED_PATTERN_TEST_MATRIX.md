# BATCH 2D — SHARED PATTERN TEST MATRIX

## Targeted suites

| Suite | Path |
|-------|------|
| Batch 2D patterns | `tests/web-app-wave2-batch2d-shared-patterns.test.js` |
| Batch 2D a11y | `tests/web-app-wave2-batch2d-shared-pattern-a11y.test.js` |
| Batch 2D UI harness | `tests/ui/web-app-wave2-batch2d-shared-patterns.ui.test.jsx` |
| Batch 2C regression | `tests/web-app-wave2-batch2c-primitives.test.js`, `tests/web-app-wave2-batch2c-primitive-a11y.test.js` |
| Batch 2B regression | `tests/web-app-wave2-batch2b-foundations-tokens.test.js`, `tests/web-app-wave2-batch2b-foundation-a11y.test.js` |

Registered in `scripts/ci/unit-test-files.json`.

## Pattern coverage

| Pattern | Contract checks | UI harness | Result |
|---------|-----------------|------------|--------|
| AuthPageHeader | h1, actions, no TopBar/domain imports | title/subtitle/actions | PASS |
| AuthConfirmDialog | destructive=error, loading dismiss block | cancel/confirm/loading | PASS |
| AuthEmptyState | role=status, no domain hardcoded copy | status region | PASS |
| AuthLoadingState | role=status, aria-busy | busy status | PASS |
| AuthErrorState | role=alert, retry, no stack leak | alert + retry | PASS |
| AuthResponsiveDataView | table/mobile, no DataGrid | desktop/mobile/empty/loading/error | PASS |
| AuthFilterBar | composition slots, no useState | search/filters/count | PASS |
| AppSnackbar | tones, aria-live, visible text | success live region | PASS |

## Accessibility (2D scope)

| Concern | Mitigation | Status |
|---------|------------|--------|
| Page header heading | `h1` | CLOSED |
| Dialog accessible title | `aria-labelledby` | CLOSED |
| Empty/loading/error announcement | status / alert / busy | CLOSED |
| Snackbar live region | aria-live polite/assertive | CLOSED |
| Table header semantics | `scope="col"` | CLOSED |
| Filter landmark | `aria-label` | CLOSED |

```
SHARED_PATTERN_A11Y_CRITICAL_GAPS=0
```

## Visual harness

`AuthPatternHarness` (+ UI test) exercises patterns at composition level.

Suggested manual widths: **1440** / **430**. No Storybook.

## Regression commands

```
node --test tests/web-app-wave2-batch2d-*.test.js
node --test tests/web-app-wave2-batch2c-*.test.js
node --test tests/web-app-wave2-batch2b-*.test.js
npx vitest run tests/ui/web-app-wave2-batch2d-shared-patterns.ui.test.jsx
npm run test:unit
npm run ci:foundation-lock
npm run lint:no-new
npm run build
```
