/**
 * CORE-22 Competition Import / Export — capability identity + frozen contracts.
 *
 * Phase 1B owns contract declarations only. Do not invent timestamps, random
 * identifiers, hashing implementations, parsers, or apply mutations here.
 */

export const CORE22_ENGINE_ID = "competition-core.import-export";
export const CORE22_ENGINE_VERSION = "1.0.0";

export const CORE22_CONTRACT_ID = "competition-core.import-export";

/** Manifest wire format major version (parsing gate). */
export const MANIFEST_VERSION = 1;

/** Package schema identity (compatibility / schema gate). No packageVersion in v1. */
export const COMPETITION_PACKAGE_SCHEMA_VERSION =
  "core22.competition-package.v1";

/** Discriminator for portable competition packages. */
export const PACKAGE_TYPE = "PICK_VN_COMPETITION_PACKAGE";

/** Canonical JSON serialization contract declaration (implementation deferred). */
export const CANONICAL_SERIALIZATION_CONTRACT =
  "core22.canonical-json.v1";

/** Integrity algorithm identifier (hashing deferred to a later phase). */
export const INTEGRITY_ALGORITHM = "sha256-canonical-json-v1";

/** Canonicalization version referenced by integrity metadata. */
export const CANONICALIZATION_VERSION = "core22.canonicalization.v1";

/**
 * Fields excluded from package checksum coverage.
 * Checksum is calculated after redaction.
 */
export const PACKAGE_CHECKSUM_EXCLUDED_FIELDS = Object.freeze([
  "packageChecksum",
  "packageId",
  "volatileTransportMetadata",
]);

/** Known volatile transport metadata keys (never checksummed). */
export const VOLATILE_TRANSPORT_METADATA_FIELDS = Object.freeze([
  "uploadId",
  "downloadUrl",
  "transportToken",
  "receivedAt",
  "transferredBytes",
  "contentEncoding",
]);

/** Checksum mismatch is always fatal. */
export const CHECKSUM_MISMATCH_SEVERITY = "FATAL";

/** Default redaction profile identifier. */
export const DEFAULT_REDACTION_PROFILE_ID = "PORTABLE_SAFE_V1";

/** Default audit section handling under PORTABLE_SAFE_V1. */
export const DEFAULT_AUDIT_SECTION_POLICY = "REFERENCES_ONLY";

/** Default partial-import policy. */
export const DEFAULT_PARTIAL_IMPORT_POLICY = "ALL_OR_NOTHING";

export const CORE22_SOURCE = Object.freeze({
  capability: "CORE-22",
  moduleId: CORE22_CONTRACT_ID,
});

/** Fields forbidden on CORE-22 contract payloads (determinism / no ambient invent). */
export const IMPORT_EXPORT_FORBIDDEN_FIELDS = Object.freeze([
  "timestamp",
  "generatedAt",
  "exportedAt",
  "importedAt",
  "createdAt",
  "updatedAt",
  "Date.now",
  "Math.random",
  "wallClock",
  "processId",
  "machineIdentity",
]);

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

export const COMPATIBILITY_STATUS = Object.freeze({
  COMPATIBLE: "COMPATIBLE",
  COMPATIBLE_WITH_WARNINGS: "COMPATIBLE_WITH_WARNINGS",
  REQUIRES_ADAPTER: "REQUIRES_ADAPTER",
  PARTIALLY_COMPATIBLE: "PARTIALLY_COMPATIBLE",
  INCOMPATIBLE: "INCOMPATIBLE",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
});

/** @type {ReadonlySet<string>} */
export const COMPATIBILITY_STATUS_VALUES = new Set(
  Object.values(COMPATIBILITY_STATUS)
);

/**
 * Statuses that are apply-eligible without further adapter / policy work.
 * @type {ReadonlySet<string>}
 */
export const APPLY_ELIGIBLE_COMPATIBILITY_STATUSES = new Set([
  COMPATIBILITY_STATUS.COMPATIBLE,
  COMPATIBILITY_STATUS.COMPATIBLE_WITH_WARNINGS,
]);

// ---------------------------------------------------------------------------
// ID / reference mapping
// ---------------------------------------------------------------------------

export const ID_MAPPING_ACTION = Object.freeze({
  PRESERVE: "PRESERVE",
  REMAP: "REMAP",
  CREATE_NEW: "CREATE_NEW",
  REUSE_EXISTING: "REUSE_EXISTING",
  EXTERNAL_REFERENCE: "EXTERNAL_REFERENCE",
  UNRESOLVED: "UNRESOLVED",
  REJECTED: "REJECTED",
});

/** @type {ReadonlySet<string>} */
export const ID_MAPPING_ACTION_VALUES = new Set(
  Object.values(ID_MAPPING_ACTION)
);

export const ID_MAPPING_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  RESOLVED: "RESOLVED",
  CONFLICTED: "CONFLICTED",
  BLOCKED: "BLOCKED",
});

/** @type {ReadonlySet<string>} */
export const ID_MAPPING_STATUS_VALUES = new Set(
  Object.values(ID_MAPPING_STATUS)
);

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

export const CONFLICT_TYPE = Object.freeze({
  DUPLICATE_ENTITY: "DUPLICATE_ENTITY",
  EXISTING_TARGET: "EXISTING_TARGET",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IMMUTABLE_FIELD_CONFLICT: "IMMUTABLE_FIELD_CONFLICT",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
  UNRESOLVED_REFERENCE: "UNRESOLVED_REFERENCE",
  AMBIGUOUS_REFERENCE: "AMBIGUOUS_REFERENCE",
  INCOMPATIBLE_MODULE: "INCOMPATIBLE_MODULE",
  RULESET_CONFLICT: "RULESET_CONFLICT",
  ALGORITHM_REFERENCE_CONFLICT: "ALGORITHM_REFERENCE_CONFLICT",
  REDACTION_CONFLICT: "REDACTION_CONFLICT",
  INTEGRITY_FAILURE: "INTEGRITY_FAILURE",
  PARTIAL_IMPORT_DENIED: "PARTIAL_IMPORT_DENIED",
  APPLY_PRECONDITION_FAILED: "APPLY_PRECONDITION_FAILED",
});

/** @type {ReadonlySet<string>} */
export const CONFLICT_TYPE_VALUES = new Set(Object.values(CONFLICT_TYPE));

export const DIAGNOSTIC_SEVERITY = Object.freeze({
  FATAL: "FATAL",
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

/** @type {ReadonlySet<string>} */
export const DIAGNOSTIC_SEVERITY_VALUES = new Set(
  Object.values(DIAGNOSTIC_SEVERITY)
);

/** Conflict types that always block apply. */
export const ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES = new Set([
  CONFLICT_TYPE.INTEGRITY_FAILURE,
  CONFLICT_TYPE.PARTIAL_IMPORT_DENIED,
  CONFLICT_TYPE.APPLY_PRECONDITION_FAILED,
  CONFLICT_TYPE.INCOMPATIBLE_MODULE,
]);

// ---------------------------------------------------------------------------
// Partial import
// ---------------------------------------------------------------------------

export const PARTIAL_IMPORT_POLICY = Object.freeze({
  ALL_OR_NOTHING: "ALL_OR_NOTHING",
  SELECTED_MODULES: "SELECTED_MODULES",
});

/** @type {ReadonlySet<string>} */
export const PARTIAL_IMPORT_POLICY_VALUES = new Set(
  Object.values(PARTIAL_IMPORT_POLICY)
);

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export const REDACTION_PROFILE_ID = Object.freeze({
  PORTABLE_SAFE_V1: "PORTABLE_SAFE_V1",
});

/** @type {ReadonlySet<string>} */
export const REDACTION_PROFILE_ID_VALUES = new Set(
  Object.values(REDACTION_PROFILE_ID)
);

export const AUDIT_SECTION_POLICY = Object.freeze({
  REFERENCES_ONLY: "REFERENCES_ONLY",
  OMIT: "OMIT",
});

/** @type {ReadonlySet<string>} */
export const AUDIT_SECTION_POLICY_VALUES = new Set(
  Object.values(AUDIT_SECTION_POLICY)
);

/**
 * Surfaces that must never re-leak redacted values.
 */
export const REDACTION_NO_RELEAK_SURFACES = Object.freeze([
  "errors",
  "warnings",
  "conflicts",
  "manifest.metadata",
  "debugPayloads",
]);

// ---------------------------------------------------------------------------
// Validation / diagnostics kinds
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_KIND = Object.freeze({
  FATAL_ERROR: "FATAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  COMPATIBILITY_ERROR: "COMPATIBILITY_ERROR",
  CONFLICT: "CONFLICT",
  WARNING: "WARNING",
  INFO: "INFO",
});

/** @type {ReadonlySet<string>} */
export const DIAGNOSTIC_KIND_VALUES = new Set(Object.values(DIAGNOSTIC_KIND));

export const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  INVALID: "INVALID",
  VALID_WITH_WARNINGS: "VALID_WITH_WARNINGS",
});

/** @type {ReadonlySet<string>} */
export const VALIDATION_STATUS_VALUES = new Set(
  Object.values(VALIDATION_STATUS)
);

/** Required manifest fields for schema v1. */
export const MANIFEST_REQUIRED_FIELDS = Object.freeze([
  "manifestVersion",
  "packageType",
  "schemaVersion",
  "packageId",
  "sourceCompetitionId",
  "includedModules",
  "excludedModules",
  "moduleVersions",
  "referenceNamespaces",
  "redactionProfile",
  "itemCounts",
  "integrity",
]);

/** Optional manifest fields for schema v1. */
export const MANIFEST_OPTIONAL_FIELDS = Object.freeze([
  "sourceSystem",
  "sourceSystemVersion",
  "ruleSetVersions",
  "algorithmVersions",
  "exportMetadata",
  "warnings",
  "metadata",
  "auditReferences",
  "replayReferences",
]);
