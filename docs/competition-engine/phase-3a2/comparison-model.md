# Comparison Model — Phase 3A.2

## Statuses

```text
EQUIVALENT
NON_EQUIVALENT
NOT_COMPARABLE
PARTIAL
ERROR
SKIPPED
```

Not a boolean `same`.

## Comparison result fields

```text
status
reasonCode
differences
ignoredDifferences
legacyFingerprint
canonicalFingerprint
comparatorVersion
metadata
```

## Difference model

```text
path, kind, legacyValue, canonicalValue, severity, message
```

Kinds:

```text
MISSING_IN_LEGACY
MISSING_IN_CANONICAL
VALUE_MISMATCH
TYPE_MISMATCH
ORDER_MISMATCH
ERROR_MISMATCH
```

Large / sensitive blobs are truncated or size-redacted in diagnostics values.

## Normalization

`normalizeShadowPayload` + `createShadowNormalizationPolicy`:

- `ignorePaths`
- `stripKeys` (transport / debug metadata)
- `sortArrayItems` / `orderInsensitivePaths`

**No** hard-coded Participant / Registration / Team / Draw / Match business rules in Phase 3A.2.

## Summarizer

`summarizeShadowReport` → equivalent / diverged / skipped / errored / notComparable / differenceCount / highestSeverity.
