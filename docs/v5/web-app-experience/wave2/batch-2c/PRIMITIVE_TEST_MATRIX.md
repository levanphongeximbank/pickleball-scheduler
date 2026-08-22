# BATCH 2C — PRIMITIVE TEST MATRIX

## Targeted suites

| Suite | Path | Coverage |
|-------|------|----------|
| Batch 2C primitives | `tests/web-app-wave2-batch2c-primitives.test.js` | Button semantics, loading, StatusToneChip tones, FieldError aria, token lock, freeze boundaries |
| Batch 2C a11y | `tests/web-app-wave2-batch2c-primitive-a11y.test.js` | Icon name, field association, labeled chip, loading/disabled, focus-visible, critical gaps = 0 |
| Batch 2C UI harness | `tests/ui/web-app-wave2-batch2c-primitives.ui.test.jsx` | Render: primary/destructive/success buttons, IconButton name, tones, FieldError alert |
| Batch 2B regression | `tests/web-app-wave2-batch2b-foundations-tokens.test.js`, `tests/web-app-wave2-batch2b-foundation-a11y.test.js` | Primary/success/font/focus locks |

Registered in `scripts/ci/unit-test-files.json`.

## Button / IconButton

| Check | Expected | Result |
|-------|----------|--------|
| Primary → semantic primary | `#3B82F6` / `contained`+`primary` | PASS |
| Destructive → error | `contained`+`error` | PASS |
| Success ≠ primary | `#10B981` | PASS |
| Focus-visible preserved | theme + 2B foundation | PASS |
| Disabled semantics | theme `Mui-disabled` | PASS |
| Loading | MUI native `loading` prop; no `@mui/lab` | PASS |
| Icon-only accessible name | `iconOnlyButtonProps` requires label | PASS |

```
BUTTON_PRIMITIVE_TESTS=PASS
ICONBUTTON_PRIMITIVE_TESTS=PASS
NEW_LOADING_BUTTON_DEPENDENCY=NO
```

## StatusToneChip

| Tone | Token family | Label required |
|------|--------------|----------------|
| neutral | slate/neutral | YES |
| info | info/blue | YES |
| success | `#10B981` family | YES |
| warning | amber | YES |
| error | red | YES |
| primary (optional) | primary surface | YES |

| Check | Result |
|-------|--------|
| No arbitrary hex API | PASS |
| No Tournament/Public token import | PASS |
| Accessible text meaning retained | PASS |

```
STATUS_TONE_CHIP_TESTS=PASS
```

## FieldError

| Check | Result |
|-------|--------|
| Visible error text | PASS |
| `role="alert"` | PASS |
| Control association (`aria-describedby` / `aria-invalid`) | PASS |
| Theme typography/color | PASS |
| No form-framework coupling | PASS |

```
FIELD_ERROR_TESTS=PASS
```

## Accessibility (2C scope)

| Gap | Mitigation | Status |
|-----|------------|--------|
| Icon-only name | `iconOnlyButtonProps` | CLOSED |
| Form error association | `FieldError` + `fieldControlAriaProps` | CLOSED |
| Disabled semantics | theme + docs | CLOSED |
| Loading action semantics | MUI `loading` + helper | CLOSED |
| Status by color alone | label required on StatusToneChip | CLOSED |

```
PRIMITIVE_A11Y_CRITICAL_GAPS=0
```

## Visual harness (no Storybook)

UI test file exercises:

- Button: primary / destructive / success / disabled / loading  
- StatusToneChip: all tones with labels  
- FieldError: alert + TextField association  

## Regression commands (owner matrix)

```
node --test tests/web-app-wave2-batch2c-*.test.js
node --test tests/web-app-wave2-batch2b-*.test.js
npx vitest run tests/ui/web-app-wave2-batch2c-primitives.ui.test.jsx
npm run test:unit
npm run ci:foundation-lock
npm run lint:no-new
npm run build
```
