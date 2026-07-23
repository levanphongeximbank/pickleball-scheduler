/**
 * CORE-22 Competition Import / Export — public capability surface.
 *
 * Ownership boundary (what CORE-22 owns):
 * - Competition package manifest / representation
 * - Deterministic canonical serialization + SHA-256 integrity
 * - Deterministic export builder (redaction-aware)
 * - Import deserialize / parse / validate / normalize
 * - Compatibility evaluation + adapter registry
 * - Reference / ID mapping plan + conflict report
 * - Dry-run import + partial-import enforcement
 * - Import-plan / stale-plan contracts for CORE-23 handoff
 *
 * Ownership boundary (what CORE-22 does NOT own):
 * - File/media storage, UI upload/download, DB backup/restore
 * - Workflow execution (CORE-19), audit persistence (CORE-20)
 * - Seed generation / replay execution (CORE-21)
 * - Recovery execution (CORE-23)
 * - Mutation apply implementation
 *
 * Deterministic input requirement:
 * - Callers supply competition identity, module payloads, fingerprints.
 * - Kernel never invents timestamps, random identifiers, or ambient clock.
 */

export {
  CORE22_ENGINE_ID,
  CORE22_ENGINE_VERSION,
  CORE22_CONTRACT_ID,
  MANIFEST_VERSION,
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  PACKAGE_TYPE,
  CANONICAL_SERIALIZATION_CONTRACT,
  INTEGRITY_ALGORITHM,
  CANONICALIZATION_VERSION,
  PACKAGE_CHECKSUM_EXCLUDED_FIELDS,
  VOLATILE_TRANSPORT_METADATA_FIELDS,
  CHECKSUM_MISMATCH_SEVERITY,
  DEFAULT_REDACTION_PROFILE_ID,
  DEFAULT_AUDIT_SECTION_POLICY,
  DEFAULT_PARTIAL_IMPORT_POLICY,
  CORE22_SOURCE,
  IMPORT_EXPORT_FORBIDDEN_FIELDS,
  COMPATIBILITY_STATUS,
  COMPATIBILITY_STATUS_VALUES,
  APPLY_ELIGIBLE_COMPATIBILITY_STATUSES,
  ID_MAPPING_ACTION,
  ID_MAPPING_ACTION_VALUES,
  ID_MAPPING_STATUS,
  ID_MAPPING_STATUS_VALUES,
  CONFLICT_TYPE,
  CONFLICT_TYPE_VALUES,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_SEVERITY_VALUES,
  ALWAYS_BLOCKS_APPLY_CONFLICT_TYPES,
  PARTIAL_IMPORT_POLICY,
  PARTIAL_IMPORT_POLICY_VALUES,
  REDACTION_PROFILE_ID,
  REDACTION_PROFILE_ID_VALUES,
  AUDIT_SECTION_POLICY,
  AUDIT_SECTION_POLICY_VALUES,
  REDACTION_NO_RELEAK_SURFACES,
  DIAGNOSTIC_KIND,
  DIAGNOSTIC_KIND_VALUES,
  VALIDATION_STATUS,
  VALIDATION_STATUS_VALUES,
  MANIFEST_REQUIRED_FIELDS,
  MANIFEST_OPTIONAL_FIELDS,
} from "./constants.js";

export {
  IMPORT_EXPORT_ERROR_CODE,
  IMPORT_EXPORT_ERROR_CODE_VALUES,
  isImportExportErrorCode,
  ImportExportError,
  isImportExportError,
  createImportExportError,
  createFatalError,
  createValidationError,
  createCompatibilityError,
  createConflictDiagnostic,
  createWarning,
  createInformationalDiagnostic,
} from "./errors.js";

export {
  createIntegrityMetadata,
  createCompetitionPackageManifest,
  assertCompetitionPackageManifest,
  createCompetitionPackage,
  createApplyPlan,
  createValidationResult,
  createCompatibilityResult,
  deriveApplyEligible,
  createIdMappingEntry,
  createReferenceMappingEntry,
  createIdMappingPlan,
  createConflictReportEntry,
  createConflictReport,
  deriveBlocksApply,
  createDryRunResult,
  createPartialImportPolicy,
  createDefaultPartialImportPolicy,
  createRedactionProfile,
  createDefaultRedactionProfile,
  assertNoRedactionReleak,
} from "./contracts/index.js";

export {
  canonicalizeJsonValue,
  serializeCanonical,
  deepFreezeCanonical,
  SET_COLLECTION_KEYS,
} from "./serialize/index.js";

export {
  isSha256Hex,
  sha256Hex,
  sha256Canonical,
  buildPackageChecksumInput,
  computePackageChecksum,
  computeContentChecksums,
  buildPackageId,
  verifyPackageChecksum,
  verifyContentChecksums,
} from "./integrity/index.js";

export { applyRedaction, MASK_TOKEN } from "./redaction/index.js";

export { buildCompetitionExport } from "./export/index.js";

export {
  deserializeCompetitionPackage,
  parseCompetitionPackage,
  validateCompetitionPackage,
  normalizeCompetitionPackage,
  roundTripSerializeParse,
} from "./import/index.js";

export { evaluateCompatibility } from "./compatibility/index.js";

export { buildMappingPlan } from "./mapping/index.js";

export { enforcePartialImportPolicy } from "./partial/index.js";

export {
  runDryRunImport,
  createImportPlan,
  detectStaleImportPlan,
  IMPORT_PLAN_POLICY_VERSION,
  IMPORT_PLAN_SCHEMA_VERSION,
} from "./dry-run/index.js";

export {
  createAdapterRegistry,
  ADAPTER_REGISTRY_VERSION,
  createDefaultAdapterRegistry,
  createCore19WorkflowAdapter,
  createCore20AuditAdapter,
  createCore21SeedReplayAdapter,
  createGenericPublicAdapter,
  registerCore01To18Adapters,
  CORE_01_TO_18_CATALOG,
  DEFAULT_MODULE_IDS,
  CORE19_MODULE_ID,
  CORE20_MODULE_ID,
  CORE21_MODULE_ID,
} from "./adapters/index.js";
