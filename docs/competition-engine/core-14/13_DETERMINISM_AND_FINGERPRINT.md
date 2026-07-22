# CORE-14 — Determinism and Fingerprint

**Contract family:** `core14-determinism-fingerprint-v1`
**Fingerprint version:** `CORE14_FP_V1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Determinism guarantee

Same canonical inputs + same policy versions ⇒

- same finding set (IDs, codes, severities, evidence)
- same recommendation set and `deterministicRank` order
- same validation outcomes
- same `deterministicFingerprint`

---

## 2. Forbidden entropy / encoding sources

Forbidden in identity, ordering, and fingerprint material:

| Forbidden | Reason |
|-----------|--------|
| `Date.now()` | Wall-clock nondeterminism |
| `Math.random()` | RNG nondeterminism |
| Input array order as identity | Callers may reorder equivalent inputs |
| Locale-dependent ordering (`localeCompare`, collation) | Locale variance |
| Database / insertion-order JSON | Unstable key order |
| Platform-default encoding assumptions | Cross-runtime variance |
| Silent trim / lower-case / Unicode normalize / locale transform of identity strings | Identity mutation |
| Whitespace in canonical serialization | Ambiguous payloads |

---

## 3. Hash algorithm and encoding

| Item | Frozen value |
|------|----------------|
| Algorithm | **SHA-256** |
| Hash input | **UTF-8 bytes** of the canonical serialized representation |
| Digest encoding | **lowercase hexadecimal** (64 chars) |
| Fingerprint version | `CORE14_FP_V1` |

```text
deterministicFingerprint = hex_lower(SHA256(utf8Bytes(canonicalSerialize(material))))
```

Optional short display IDs may truncate for logs but **must not** replace full fingerprint storage in results.

FNV-1a is **not** the CORE-14 fingerprint algorithm.

CORE-14 Phase 1C must use a browser+Node safe SHA-256 helper (SubtleCrypto and/or pure sync digest).

Phase 1C-S certifies the pure sync digest against standard vectors and Node `crypto` parity **in tests only**. Runtime `resource-conflict/` must not import `node:crypto`.

---

## 4. Canonical serialization rules

Canonical form is a deterministic UTF-8 string with **no whitespace**.

### 4.1 Object key ordering

Object keys sorted by **UTF-8 bytewise** ascending order of the key string.

### 4.2 Array / identifier list ordering

Arrays that participate in identity/fingerprint must be sorted before serialization.

Comparator for lists of identifiers (`occupancyId`, `assignmentId`, `findingId`, `conflictId`, provider versions, etc.): **UTF-8 bytewise** ascending.

Detection input normalization sorts occupancies by:

```text
(resourceKeyCanonical UTF-8, startMs numeric, endMs numeric, occupancyId UTF-8)
```

so reordered equivalent input yields identical results.

### 4.3 Escaping (pipe grammars / embedded strings)

| Character | Escape |
|-----------|--------|
| `\` | `\\` |
| `|` | `\|` |
| `=` | `\=` |

JSON-shaped canonical objects (if used) use standard JSON string escaping with sorted keys and no insignificant whitespace.

### 4.4 Null representation

- JSON / structured canonical: `null`
- Pipe grammars (`CORE14_CRK_V1`, etc.): ASCII token `null`

### 4.5 Boolean representation

Exact tokens: `true` / `false` (JSON) or `true` / `false` in pipe grammars — never `1`/`0`.

### 4.6 Numeric representation

Only **safe integers** appear in canonical domain time and identity numerics.

Serialization: decimal digits of the safe integer **without exponent notation** and without leading `+` or insignificant leading zeros (except the number `0` itself).

Examples: `0`, `1000`, `-1` — never `1e3`, `1000.0`, `+1000`.

Non-safe-integer numerics fail closed before fingerprint.

### 4.7 Strings / identity bytes

Identity strings (`resourceId`, `scopeId`, `occupancyId`, `assignmentId`, …) are serialized as exact caller-supplied code units encoded to UTF-8.

**Must not** silently:

- trim
- lower-case
- Unicode-normalize (NFC/NFD/…)
- locale-transform

Empty string is distinct from `null`. Empty `resourceId` fails validation (`RESOURCE_ID_MISSING`) and never enters fingerprint material as a successful key.

### 4.8 Metadata

`metadata` is **excluded** from identity and fingerprint material unless an explicitly versioned schema lists permitted metadata fields.

---

## 5. Conflict / finding identity tuple

```text
FindingIdentityTuple = {
  code,
  resourceKeyCanonical,
  occupancyIdsSorted,      // UTF-8 bytewise
  violationStartMs,        // null → null; else safe integer decimal
  violationEndMs,
  reasonCode,
  policyVersion
}
```

`findingId = "CORE14_FID_V1:" + hex_lower(SHA256(utf8Bytes(serialize(tuple))))`

---

## 6. Recommendation identity tuple

```text
RecommendationIdentityTuple = {
  conflictIdsSorted,
  actionType,
  targetAssignmentIdsSorted,
  proposedChangesCanonical,
  policyVersion
}
```

`recommendationId = "CORE14_RID_V1:" + hex_lower(SHA256(utf8Bytes(serialize(tuple))))`

---

## 7. Result fingerprint material

```text
DetectionFingerprintMaterial = {
  fingerprintVersion: "CORE14_FP_V1",
  policyVersion,
  availabilityMode,
  availabilityCertification,
  providerVersionsSorted,
  sortedOccupancyCanonicalForms,
  sortedFindingIds,
  hardFindingCount,
  softFindingCount,
  planStatus,
  evaluationStatus
}
```

Validation fingerprint extends with sorted recommendation IDs + projected finding IDs.

---

## 8. Compare contract

| Compare target | Rule |
|----------------|------|
| Identifier strings / resource key serializations | UTF-8 bytewise |
| Safe integers | Numeric order |
| Never | `localeCompare`, platform default collation |

---

## 9. CanonicalResourceKey note

`CORE14_CRK_V1` pipe serialization remains the resource-key canonical form (see [02_CANONICAL_RESOURCE_KEY.md](./02_CANONICAL_RESOURCE_KEY.md)). Equality and sort use that UTF-8 serialization’s bytewise order.
