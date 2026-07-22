# CORE-14 — Phase 1C-S Safe Sync and Domain Certification

**Phase:** 1C-S
**Status:** Certification task
**Date:** 2026-07-22
**Owner verdict in:** `CORE_14_PHASE_1C_APPROVED_WITH_PRE_PHASE_1D_GATES`
**Authorization:** `AUTHORIZE_CORE_14_PHASE_1C_S_SAFE_SYNC_AND_DOMAIN_CERTIFICATION`
**Phase 1D detectors:** NOT authorized

---

## 1. Sync summary

Branch `feature/competition-core-14-resource-conflict-resolver` fast-forwarded to `origin/main` after confirming incoming commits did not touch CORE-14 paths.

---

## 2. Domain error versus input diagnostic rule

| Path | Behavior |
|------|----------|
| `validate*` (e.g. `validateResourceOccupancy`, `validateCanonicalResourceKey`) | Returns `{ ok, value? \| diagnostics }`. **Does not throw** for invalid caller domain input. |
| `create*` / `normalize*` / `serialize*` wrappers over invalid domain input | Throws `ResourceConflictContractError` whose `code` is the **first frozen `INPUT_DIAGNOSTIC_CODE`** from the validate path, with `details.diagnostics` listing all diagnostics. |
| Programmer misuse of factories (unknown finding code, invalid evaluationStatus, unknown diagnostic code in `createInputDiagnostic`, etc.) | Throws `ResourceConflictContractError` with frozen **`DOMAIN_CONTRACT_ERROR_CODE`**. |
| Canonical serializer unsupported values | Throws `ResourceConflictContractError` with **`INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE`** and evidence `{ valuePath, valueType, reason }`. |

Rules:

- No `Date.now()`, random IDs, or environment-dependent message requirements on errors.
- The same invalid occupancy must not unpredictably throw in `validate*` and return diagnostics in an equivalent `validate*` call — `validate*` always returns; `create*` always throws on the same invalid input.

---

## 3. Source provenance

`source` is a **non-empty, case-sensitive provenance string**:

- Not trimmed / lower-cased / Unicode-normalized.
- Extensible (e.g. `EXTERNAL_ADAPTER:<namespace>`).
- Well-known constants in `OCCUPANCY_SOURCE` are convenience only (not a closed allowlist).
- Excluded from `CanonicalResourceKey`, `LogicalAssignmentKeyV1`, and duplicate-concealing identity.

---

## 4. SHA-256 certification

Runtime uses a pure sync SHA-256 implementation (no `node:crypto` import under `resource-conflict/`).

Phase 1C-S tests compare runtime digests to Node `crypto.createHash('sha256')` for standard vectors (empty, `abc`, long block, Unicode, canonical bytes).

---

## 5. Emitted diagnostic inventory

See [06_DIAGNOSTIC_CATALOG.md](./06_DIAGNOSTIC_CATALOG.md) for the complete frozen input diagnostic catalog, including:

- `OCCUPANCY_ID_MISSING`
- `OCCUPANCY_SOURCE_MISSING`
- `OCCUPANCY_BOOLEAN_INVALID`
- `OCCUPANCY_METADATA_INVALID`
- `UNSUPPORTED_CANONICAL_VALUE`

`INVALID_OCCUPANCY_FIELD` is **retired** (replaced by the specific codes above).
