# CORE-22 — Ownership Boundary

**Capability:** Competition Import / Export  
**Module:** `src/features/competition-core/import-export/`  
**Phase:** 1C–1F (fast-track implementation)

## Owns

| Concern | Notes |
|---------|--------|
| Competition package manifest | `manifestVersion`, `schemaVersion`, module inventories |
| Export/import package representation | Structure only — no file I/O |
| Deterministic canonical JSON | `core22.canonical-json.v1` (package-scoped) |
| SHA-256 integrity | `sha256-canonical-json-v1`; packageId `core22pkg:sha256:<hex>` |
| Redaction-aware export | Default `PORTABLE_SAFE_V1`; checksum after redaction |
| Import parse / validate / normalize | Pure; no target mutation |
| Compatibility evaluation | Machine-readable statuses + `applyEligible` |
| Adapter registry | CORE-01..21; concrete CORE-19/20/21 |
| Reference / ID mapping plan | Mapping actions; no state writes |
| Conflict report | No silent overwrite |
| Dry-run import | Deterministic fingerprints; no apply |
| Partial-import policy | `ALL_OR_NOTHING` (default), `SELECTED_MODULES` |
| Import-plan / stale-plan | CORE-23 handoff contracts only |
| Typed warnings/errors | Capability-local `IMPORT_EXPORT_*` codes |

## Does not own

| Concern | Owner |
|---------|--------|
| File / media storage | Platform / transport |
| DB backup / restore | Persistence / ops |
| UI upload / download | UI layer |
| Workflow execution | CORE-19 |
| Audit persistence / append / sequencing | CORE-20 |
| Seed generation / replay execution | CORE-21 |
| Recovery / checkpoint / resume execution | CORE-23 |
| Mutation apply implementation | Later phase + integrators |

## Version responsibilities

| Field | Responsibility |
|-------|----------------|
| `manifestVersion` | Manifest parsing gate (`1`) |
| `schemaVersion` | `core22.competition-package.v1` |
| `moduleVersions` | Dependency module versions |
| `ruleSetVersions` | CORE-01 references |
| `algorithmVersions` | CORE-21 / engine references |
| `sourceSystemVersion` | Traceability only |

**v1 does not introduce `packageVersion`.**

## Canonicalization note

CORE-22 uses a **package-scoped** canonicalizer (not CORE-21 `serializeCanonical` reuse) because:

1. Package checksum must be SHA-256 over CORE-22-owned byte identity (never CORE-21 FNV).
2. Errors must be `ImportExportError`.
3. CORE-22 owns set-collection normalization for package-controlled arrays.
