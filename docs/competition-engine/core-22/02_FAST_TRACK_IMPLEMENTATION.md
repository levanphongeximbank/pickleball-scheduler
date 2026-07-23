# CORE-22 Fast-track — Implementation Notes (1C–1F)

## Manifest / schema

- `MANIFEST_VERSION = 1`
- `COMPETITION_PACKAGE_SCHEMA_VERSION = "core22.competition-package.v1"`
- `PACKAGE_TYPE = "PICK_VN_COMPETITION_PACKAGE"`
- No `packageVersion` in v1

## Canonicalization

- Contract: `core22.canonical-json.v1`
- Integrity canonicalization version field: `core22.canonicalization.v1`
- Object keys sorted lexical; set-collections sorted; business arrays preserve order
- Rejects function/symbol/bigint/Date/Map/Set/cycles/non-finite numbers
- `undefined` object properties omitted

## Integrity

- Algorithm: `sha256-canonical-json-v1` (Node `crypto`)
- Digest: lowercase hex, 64 chars
- Package checksum excludes: `packageId`, `packageChecksum`, `volatileTransportMetadata`
- Checksum computed **after** redaction
- `packageId = core22pkg:sha256:<checksum>` (not part of checksum input)
- Mismatch → fatal `CHECKSUM_MISMATCH`

## Deterministic export

`buildCompetitionExport(input)` — pure; no file I/O; no timestamps; no input mutation.

## Parsing / validation

Pipeline: deserialize → parse → structural/manifest/version/integrity validation → normalize.

## Compatibility

Statuses: `COMPATIBLE`, `COMPATIBLE_WITH_WARNINGS`, `REQUIRES_ADAPTER`, `PARTIALLY_COMPATIBLE`, `INCOMPATIBLE`, `UNSUPPORTED_VERSION`, `MISSING_DEPENDENCY`.

`applyEligible` only for `COMPATIBLE` and `COMPATIBLE_WITH_WARNINGS`.

## Mapping / conflicts

Actions: `PRESERVE`, `REMAP`, `CREATE_NEW`, `REUSE_EXISTING`, `EXTERNAL_REFERENCE`, `UNRESOLVED`, `REJECTED`.

Conflict types: see constants; no `SILENT_OVERWRITE`.

## Dry-run / partial policy

- Default: `ALL_OR_NOTHING`
- Also: `SELECTED_MODULES` (explicit + dependency-closed)
- No entity-scoped / best-effort

## Redaction

- Default profile: `PORTABLE_SAFE_V1`
- Audit: `REFERENCES_ONLY` (no full CORE-20 payload)
- No PII heuristics; contract-driven paths only
- No re-leak through warnings/errors/conflicts

## CORE-20 boundary

Transports audit **references** only; may build allowlisted reference metadata; does not append events or manage sequences.

## CORE-21 boundary

Transports seed/replay references, algorithm versions, fingerprints; does not generate seeds or run replay.

## CORE-23 handoff

`createImportPlan` / `detectStaleImportPlan` expose fingerprints for package, target revision, selected modules, adapter registry version, policy version, mapping plan, conflict report, import plan.

**Not implemented:** checkpoint persistence, resume tokens, recovery eligibility/execution, idempotency enforcement.

## Round-trip

Invariant: export → serialize → deserialize → validate → verify → normalize → re-export preserves checksum, packageId, canonical bytes, module semantics, references, item counts, redaction declarations.

Non-canonical transport metadata (`volatileTransportMetadata`) is excluded from checksum and may be dropped on re-export.

## Known limitations

- No mutation apply engine
- No recovery (CORE-23)
- CORE-08 / CORE-10 marked `REQUIRES_ADAPTER` (public API insufficient for full domain import)
- No UI / storage / SQL wiring
- Root `competition-core` barrel exports CORE-22 `CONFLICT_TYPE` as `IMPORT_EXPORT_CONFLICT_TYPE` to avoid collision with scheduling `CONFLICT_TYPE`. Capability-local barrel still exports `CONFLICT_TYPE`.
