/**
 * CORE-22 deterministic competition export builder.
 * Pure — no file I/O, no timestamps, no random IDs, no input mutation.
 */

import {
  CANONICALIZATION_VERSION,
  COMPETITION_PACKAGE_SCHEMA_VERSION,
  INTEGRITY_ALGORITHM,
  MANIFEST_VERSION,
  PACKAGE_TYPE,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  compareStableString,
  isNonEmptyString,
  isPlainObject,
} from "../utils/helpers.js";
import { createCompetitionPackage } from "../contracts/package.js";
import { createIntegrityMetadata } from "../contracts/integrity.js";
import { applyRedaction } from "../redaction/index.js";
import {
  buildPackageId,
  computeContentChecksums,
  computePackageChecksum,
} from "../integrity/index.js";
import { deepFreezeCanonical } from "../serialize/index.js";

/**
 * Count items in a module payload (arrays under top-level keys + totalLeaves heuristic).
 * @param {unknown} payload
 * @returns {number}
 */
function countModuleItems(payload) {
  if (payload == null) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (!isPlainObject(payload)) return 1;
  let count = 0;
  for (const key of Object.keys(payload)) {
    const v = /** @type {Record<string, unknown>} */ (payload)[key];
    if (Array.isArray(v)) count += v.length;
    else if (v != null) count += 1;
  }
  return count;
}

/**
 * Build a deterministic immutable competition package.
 *
 * @param {object} input
 * @param {string} input.sourceCompetitionId
 * @param {Record<string, unknown>} input.modules — prepared module payloads
 * @param {Record<string, string>} [input.moduleVersions]
 * @param {Record<string, string>} [input.ruleSetVersions]
 * @param {Record<string, string>} [input.algorithmVersions]
 * @param {string[]} [input.referenceNamespaces]
 * @param {unknown[]} [input.references]
 * @param {unknown[]} [input.auditReferences]
 * @param {unknown[]} [input.replayReferences]
 * @param {object} [input.exportOptions]
 * @param {object|string} [input.redactionProfile]
 * @param {string[]} [input.excludedFieldPaths]
 * @param {string[]} [input.maskedFieldPaths]
 * @param {string[]} [input.omittedModules]
 * @param {Record<string, unknown>} [input.referenceReplacements]
 * @param {object} [input.exportMetadata] — caller-supplied deterministic metadata only
 * @param {string} [input.sourceSystem]
 * @param {string} [input.sourceSystemVersion]
 * @param {string[]} [input.excludedModules]
 * @returns {Readonly<object>}
 */
export function buildCompetitionExport(input = {}) {
  if (!isPlainObject(input)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "buildCompetitionExport input must be a plain object",
      {}
    );
  }
  if (!isNonEmptyString(input.sourceCompetitionId)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.MALFORMED_MANIFEST,
      "sourceCompetitionId is required",
      { field: "sourceCompetitionId" }
    );
  }
  if (!isPlainObject(input.modules)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.INVALID_PACKAGE,
      "modules must be a plain object",
      { field: "modules" }
    );
  }

  // Snapshot module keys before redaction (insertion-order independence later).
  const modulesSnapshot = { ...input.modules };

  const redaction = applyRedaction({
    modules: modulesSnapshot,
    redactionProfile: input.redactionProfile,
    excludedFieldPaths: input.excludedFieldPaths,
    maskedFieldPaths: input.maskedFieldPaths,
    omittedModules: input.omittedModules,
    referenceReplacements: input.referenceReplacements,
    auditReferences: input.auditReferences,
  });

  const modules = /** @type {Record<string, unknown>} */ ({
    ...redaction.modules,
  });

  // Deterministic module section order (lexical keys).
  /** @type {Record<string, unknown>} */
  const orderedModules = {};
  for (const key of Object.keys(modules).sort(compareStableString)) {
    orderedModules[key] = modules[key];
  }

  const includedModules = Object.keys(orderedModules).sort(compareStableString);
  const excludedFromInput = Array.isArray(input.excludedModules)
    ? input.excludedModules.map((m) => String(m).trim())
    : [];
  const excludedModules = [
    ...new Set([
      ...excludedFromInput,
      ...redaction.omittedModules,
    ]),
  ]
    .filter((m) => !includedModules.includes(m))
    .sort(compareStableString);

  const moduleVersionsIn = isPlainObject(input.moduleVersions)
    ? /** @type {Record<string, string>} */ (input.moduleVersions)
    : {};
  /** @type {Record<string, string>} */
  const moduleVersions = {};
  for (const mod of includedModules) {
    const ver = moduleVersionsIn[mod];
    if (!isNonEmptyString(ver)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.UNSUPPORTED_MODULE_VERSION,
        `moduleVersions missing for included module ${mod}`,
        { module: mod }
      );
    }
    moduleVersions[mod] = String(ver).trim();
  }

  /** @type {Record<string, number>} */
  const itemCounts = {};
  for (const mod of includedModules) {
    itemCounts[mod] = countModuleItems(orderedModules[mod]);
  }

  const contentChecksums = computeContentChecksums(orderedModules);

  const referenceNamespaces = Array.isArray(input.referenceNamespaces)
    ? [...new Set(input.referenceNamespaces.map((n) => String(n).trim()))].sort(
        compareStableString
      )
    : [];

  const warnings = [
    ...(Array.isArray(input.warnings) ? input.warnings : []),
    ...redaction.warnings.map((w) => ({
      code: w.code,
      message: w.message,
      fieldPath: w.fieldPath,
    })),
  ];

  // Placeholder integrity + packageId; replaced after checksum.
  const placeholderIntegrity = createIntegrityMetadata({
    algorithm: INTEGRITY_ALGORITHM,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    contentChecksums,
    packageChecksum: null,
  });

  /** @type {Record<string, unknown>} */
  const manifestDraft = {
    manifestVersion: MANIFEST_VERSION,
    packageType: PACKAGE_TYPE,
    schemaVersion: COMPETITION_PACKAGE_SCHEMA_VERSION,
    packageId: "core22pkg:sha256:pending",
    sourceCompetitionId: String(input.sourceCompetitionId).trim(),
    includedModules,
    excludedModules,
    moduleVersions,
    referenceNamespaces,
    redactionProfile: redaction.redactionProfile,
    itemCounts,
    integrity: placeholderIntegrity,
    warnings,
  };

  if (isNonEmptyString(input.sourceSystem)) {
    manifestDraft.sourceSystem = String(input.sourceSystem).trim();
  }
  if (isNonEmptyString(input.sourceSystemVersion)) {
    manifestDraft.sourceSystemVersion = String(input.sourceSystemVersion).trim();
  }
  if (isPlainObject(input.ruleSetVersions)) {
    manifestDraft.ruleSetVersions = input.ruleSetVersions;
  }
  if (isPlainObject(input.algorithmVersions)) {
    manifestDraft.algorithmVersions = input.algorithmVersions;
  }
  if (isPlainObject(input.exportMetadata)) {
    manifestDraft.exportMetadata = input.exportMetadata;
  }
  if (Array.isArray(input.auditReferences)) {
    manifestDraft.auditReferences = input.auditReferences;
  }
  if (Array.isArray(input.replayReferences)) {
    manifestDraft.replayReferences = input.replayReferences;
  }

  const packageDraft = {
    packageType: PACKAGE_TYPE,
    schemaVersion: COMPETITION_PACKAGE_SCHEMA_VERSION,
    manifest: manifestDraft,
    modules: orderedModules,
    references: Array.isArray(input.references) ? input.references : [],
    applyPlan: null,
    volatileTransportMetadata: null,
  };

  const packageChecksum = computePackageChecksum(packageDraft);
  const packageId = buildPackageId(packageChecksum);

  const finalIntegrity = createIntegrityMetadata({
    algorithm: INTEGRITY_ALGORITHM,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    contentChecksums,
    packageChecksum,
  });

  const pkg = createCompetitionPackage({
    packageType: PACKAGE_TYPE,
    schemaVersion: COMPETITION_PACKAGE_SCHEMA_VERSION,
    manifest: {
      ...manifestDraft,
      packageId,
      integrity: finalIntegrity,
    },
    modules: orderedModules,
    references: packageDraft.references,
    applyPlan: null,
    volatileTransportMetadata: null,
  });

  // Guard: checksum must not include packageId circularly.
  const recomputed = computePackageChecksum(pkg);
  if (recomputed !== packageChecksum) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.CHECKSUM_MISMATCH,
      "Internal export checksum instability (circular packageId coverage)",
      { packageChecksum, recomputed }
    );
  }

  return /** @type {Readonly<object>} */ (deepFreezeCanonical(pkg));
}
