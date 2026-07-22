# CORE-14 — CanonicalResourceKey

**Contract family:** `core14-canonical-resource-key-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Shape

```text
CanonicalResourceKey {
  resourceKind: ResourceKind
  resourceId: string
  scopeType: ScopeType
  scopeId: string | null
}
```

Time **must not** be part of `CanonicalResourceKey`.

---

## 2. ResourceKind (minimum enum)

| Value | Meaning |
|-------|---------|
| `PLAYER` | Individual player resource |
| `TEAM` | Team resource |
| `COURT` | Court resource |
| `REFEREE` | Referee resource |
| `VENUE` | Venue resource |
| `LOCATION` | Location / space resource |
| `EQUIPMENT` | Equipment resource |
| `CUSTOM_RESOURCE` | Caller-defined resource kind under CUSTOM policy |

Unknown kinds fail closed as input diagnostics (`UNKNOWN_RESOURCE_TYPE`), not as inventing a custom kind silently.

---

## 3. ScopeType (minimum enum)

| Value | `scopeId` rule |
|-------|----------------|
| `GLOBAL` | May omit (`null`) |
| `TENANT` | Required, non-empty |
| `CLUB` | Required, non-empty |
| `VENUE` | Required, non-empty |
| `COMPETITION` | Required, non-empty |
| `EVENT` | Required, non-empty |

Rules:

1. Do **not** infer scope from the first input record.
2. Do **not** invent or transform identity silently.
3. `resourceId` must be stable, non-empty, and externally supplied.
4. Identity strings must **not** be silently trimmed, lower-cased, Unicode-normalized, locale-transformed, case-folded, slugified, or rewritten.

---

## 4. Equality

Two keys are equal iff all four fields are equal under **UTF-8 bytewise** comparison of their canonical field values (and `scopeId` null equals null only). Sorting and equality of serialized keys use UTF-8 bytewise order of `CORE14_CRK_V1` (see §6 and [13_DETERMINISM_AND_FINGERPRINT.md](./13_DETERMINISM_AND_FINGERPRINT.md)).

---

## 5. Occupancy index key (separate)

`CanonicalResourceKey` is **not** the occupancy index key.

Occupancy indexing uses a separate composite (frozen in [03_RESOURCE_OCCUPANCY.md](./03_RESOURCE_OCCUPANCY.md)):

```text
OccupancyIndexKey = canonicalize(resourceKey) + occupancyId
```

or an equivalent deterministic structure that includes both the resource key and `occupancyId`. Time windows are stored on occupancy records, not in the resource key.

---

## 6. Deterministic canonical serialization

### 6.1 Field order (fixed)

```text
resourceKind | resourceId | scopeType | scopeId
```

### 6.2 Encoding grammar (`CORE14_CRK_V1`)

Pipe-delimited, escaped UTF-8, **no whitespace**:

```text
CORE14_CRK_V1
  + "|k=" + escape(resourceKind)
  + "|i=" + escape(resourceId)
  + "|st=" + escape(scopeType)
  + "|sid=" + (scopeId === null ? "null" : escape(scopeId))
```

Null representation for omitted GLOBAL `scopeId`: ASCII token `null` only.

```text
CORE14_CRK_V1|k=COURT|i=court-12|st=VENUE|sid=venue-9
CORE14_CRK_V1|k=PLAYER|i=p-1|st=GLOBAL|sid=null
```

### 6.3 Escaping

Escape rules for `resourceId` / `scopeId` / enum strings when they contain reserved characters:

| Character | Escape |
|-----------|--------|
| `\` | `\\` |
| `|` | `\|` |
| `=` | `\=` |

No locale-dependent case mapping. No URL encoding as identity. No silent trim/normalize of identity bytes.

### 6.4 Forbidden

- Embedding `startMs` / `endMs` / `slotId` in the key
- Using display names as `resourceId`
- Deriving `scopeId` from nested occupancy fields when the caller omitted it
- Treating input array order as part of key identity

---

## 7. Validation fail-closed codes

| Condition | Diagnostic |
|-----------|------------|
| Missing/empty `resourceId` | `RESOURCE_ID_MISSING` |
| Unknown `resourceKind` | `UNKNOWN_RESOURCE_TYPE` |
| Non-GLOBAL missing `scopeId` | `SCOPE_MISSING` |
| GLOBAL with non-null unexpected scope (policy-strict) | `SCOPE_MISSING` or reject as invalid input per request policy |

See [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md).
