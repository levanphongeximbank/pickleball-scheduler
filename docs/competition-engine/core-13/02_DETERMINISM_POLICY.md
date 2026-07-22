# CORE-13 — Determinism Policy

**Policy id:** `CORE13_DETERMINISM_V1`
**Helpers:** `referee-assignment/deterministic/`
**Ownership:** CORE-13-local. Do not deep-import private fingerprint helpers from other COREs.

---

## Hard rules

1. **No `Math.random`**
2. **No `Date.now` / `new Date()`** for generated decision values inside factories or helpers
3. **No `randomUUID` / crypto ambient IDs**
4. **No `localeCompare`** — use `compareStableString` (UTF-16 code units)
5. **No insertion-order ranking** — canonicalize object keys with stable sort
6. **No ambient process time** in deterministic material

---

## Phase 1E authoritative digest

| Helper | Purpose |
|--------|---------|
| `canonicalizeJsonValue` / `serializeCanonical` | Canonical JSON material |
| `digestCanonical(domain, payload)` | SHA-256 hex (64 chars) with domain separation |
| `fingerprintValue(value, domain)` | Full authoritative fingerprint |
| `buildAssignmentId` / `buildPlanId` / `buildReplacementId` | Namespaced IDs (≥128-bit truncation) |
| `normalizePlannerSeed` / `seedExplorationKey` | Seed normalization + SHA-derived exploration key |

**Algorithm:** `CORE13_DIGEST_SHA256_V1` — pure capability-local SHA-256.
**FNV-1a is not authoritative** and must not appear in CORE-13 identity / fingerprint paths.

Final assignment-plan fingerprint uses domain `CORE13:PLAN_FINGERPRINT:V1`.

---

## Seed policy (preview)

- Seed is **optional** on `RefereeAssignmentRequest`.
- Missing seed is allowed for Phase 1 (stable sort + soft scores + `refereeId` tie-break — planner later).
- Invalid seed types fail closed (`NON_DETERMINISTIC_INPUT`).
