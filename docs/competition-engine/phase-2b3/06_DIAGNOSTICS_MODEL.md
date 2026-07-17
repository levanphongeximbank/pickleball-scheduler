# 06 — Diagnostics Model

Stable codes (`MAPPING_DIAGNOSTIC_CODE`):

```text
MISSING_SOURCE_ID
UNSUPPORTED_SOURCE_TYPE
INVALID_IDENTITY_REFERENCE
MISSING_COMPETITION_ID
AMBIGUOUS_PERSON_ID
UNRESOLVED_PLAYER_REFERENCE
DUPLICATE_ACTIVE_ENTRY
INVALID_ROSTER_STATE
INVALID_LINEUP_REVISION
MISSING_DIVISION_REFERENCE
MISSING_CATEGORY_REFERENCE
SNAPSHOT_INCOMPLETE
UNSUPPORTED_FORMAT_POLICY
```

Each diagnostic includes:

```text
code, path, message, severity, sourceType, sourceId, sourceValue, metadata
```

`code` is the machine identifier — never the message text.

## Mapping result

Success:

```js
{ success: true, value, diagnostics, source: { type, id, version }, targetSchemaVersion }
```

Failure (business-invalid):

```js
{ success: false, value: null, diagnostics: [...] }
```

Ordinary business errors do not throw. Programmer misuse of shadow hooks / interface construction may throw.
