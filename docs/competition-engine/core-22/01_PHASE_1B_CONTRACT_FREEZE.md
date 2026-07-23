# CORE-22 Phase 1B — Contract Freeze

**Status:** Frozen for Owner review (Phase 1B)  
**Date:** 2026-07-24  
**Base HEAD:** `a4350fda448faffb37c39cd4416b99681d92ffdc` (= `origin/main` at implementation start)

## Frozen version constants

| Constant | Value |
|----------|--------|
| `MANIFEST_VERSION` | `1` |
| `COMPETITION_PACKAGE_SCHEMA_VERSION` | `core22.competition-package.v1` |
| `PACKAGE_TYPE` | `PICK_VN_COMPETITION_PACKAGE` |
| `INTEGRITY_ALGORITHM` | `sha256-canonical-json-v1` |
| `CANONICALIZATION_VERSION` | `core22.canonicalization.v1` |
| `CANONICAL_SERIALIZATION_CONTRACT` | `core22.canonical-json.v1` |
| Default redaction profile | `PORTABLE_SAFE_V1` |
| Default audit section | `REFERENCES_ONLY` |
| Default partial-import policy | `ALL_OR_NOTHING` |

## Manifest required fields

`manifestVersion` · `packageType` · `schemaVersion` · `packageId` · `sourceCompetitionId` · `includedModules` · `excludedModules` · `moduleVersions` · `referenceNamespaces` · `redactionProfile` · `itemCounts` · `integrity`

## Integrity

- Contract only; hashing deferred.
- Package checksum excludes: `packageChecksum`, `packageId`, `volatileTransportMetadata`.
- Checksum calculated **after** redaction.
- Checksum mismatch severity: **FATAL**.

## Compatibility statuses

`COMPATIBLE` · `COMPATIBLE_WITH_WARNINGS` · `REQUIRES_ADAPTER` · `PARTIALLY_COMPATIBLE` · `INCOMPATIBLE` · `UNSUPPORTED_VERSION` · `MISSING_DEPENDENCY`

`applyEligible === true` only for `COMPATIBLE` and `COMPATIBLE_WITH_WARNINGS`.

## ID mapping actions

`PRESERVE` · `REMAP` · `CREATE_NEW` · `REUSE_EXISTING` · `EXTERNAL_REFERENCE` · `UNRESOLVED` · `REJECTED`

## Conflict types (minimum)

`DUPLICATE_ENTITY` · `EXISTING_TARGET` · `VERSION_CONFLICT` · `IMMUTABLE_FIELD_CONFLICT` · `MISSING_DEPENDENCY` · `UNRESOLVED_REFERENCE` · `AMBIGUOUS_REFERENCE` · `INCOMPATIBLE_MODULE` · `RULESET_CONFLICT` · `ALGORITHM_REFERENCE_CONFLICT` · `REDACTION_CONFLICT` · `INTEGRITY_FAILURE` · `PARTIAL_IMPORT_DENIED` · `APPLY_PRECONDITION_FAILED`

No silent overwrite. `SILENT_OVERWRITE` resolution is rejected.

## Partial import (v1)

- Supported: `ALL_OR_NOTHING` (default), `SELECTED_MODULES` (requires dependency closure + omitted modules declaration).
- Unsupported: entity-scoped, best-effort.

## Error codes

`INVALID_PACKAGE` · `MALFORMED_MANIFEST` · `UNSUPPORTED_MANIFEST_VERSION` · `UNSUPPORTED_SCHEMA_VERSION` · `UNSUPPORTED_MODULE_VERSION` · `CHECKSUM_MISMATCH` · `INCOMPATIBLE_PACKAGE` · `MISSING_DEPENDENCY` · `UNRESOLVED_REFERENCE` · `DUPLICATE_ID` · `TARGET_CONFLICT` · `REDACTION_VIOLATION` · `PARTIAL_IMPORT_DENIED` · `DRY_RUN_REQUIRED` · `APPLY_PRECONDITION_FAILED` · `SERIALIZATION_FAILURE` · `DESERIALIZATION_FAILURE`

## Explicitly out of Phase 1B

- Serializer / parser / integrity hashing implementation
- Apply engine / mutation execution
- Recovery (CORE-23)
- Root barrel wiring / CI unit-test registry / package.json
- UI / SQL / Supabase / deploy
