/**
 * CORE-22 pure dry-run import pipeline.
 * Does not mutate target state. No apply / recovery execution.
 */

import { CONFLICT_TYPE, PARTIAL_IMPORT_POLICY } from "../constants.js";
import { createDryRunResult } from "../contracts/dry-run.js";
import { createConflictReportEntry } from "../contracts/conflict-report.js";
import { isPlainObject } from "../utils/helpers.js";
import { sha256Canonical } from "../integrity/index.js";
import {
  validateCompetitionPackage,
  normalizeCompetitionPackage,
} from "../import/index.js";
import { evaluateCompatibility } from "../compatibility/index.js";
import { buildMappingPlan } from "../mapping/index.js";
import { enforcePartialImportPolicy } from "../partial/index.js";
import {
  createDefaultAdapterRegistry,
  ADAPTER_REGISTRY_VERSION,
} from "../adapters/index.js";
import {
  createImportPlan,
  detectStaleImportPlan,
  IMPORT_PLAN_POLICY_VERSION,
} from "./importPlan.js";

/**
 * @param {object} input
 * @param {object} [input.package] — validated or raw package
 * @param {object} [input.targetContext]
 * @param {string} input.targetRevisionFingerprint
 * @param {object} [input.adapterRegistry]
 * @param {string[]} [input.selectedModules]
 * @param {object} [input.mappingPolicy]
 * @param {object} [input.partialPolicy]
 * @param {Record<string, string[]>} [input.moduleDependencies]
 * @param {object} [input.targetIndex]
 * @param {object} [input.immutableTargets]
 * @param {string[]} [input.mandatoryModules]
 * @param {Record<string, string>} [input.targetCapabilities]
 * @returns {Readonly<object>}
 */
export function runDryRunImport(input = {}) {
  if (!isPlainObject(input)) {
    throw new Error("runDryRunImport input must be a plain object");
  }

  const registry = input.adapterRegistry ?? createDefaultAdapterRegistry();
  const pkg = input.package;
  const targetRevisionFingerprint = String(
    input.targetRevisionFingerprint ?? ""
  ).trim();

  // Snapshot target context reference for mutation guard in tests.
  const targetContext = input.targetContext ?? null;
  const targetContextBefore =
    targetContext && typeof targetContext === "object"
      ? sha256Canonical(targetContext)
      : null;

  const validationResult = validateCompetitionPackage(pkg, {
    verifyIntegrity: true,
  });

  const normalized =
    validationResult.valid && pkg
      ? normalizeCompetitionPackage(pkg)
      : pkg;

  const packageFingerprint = validationResult.valid
    ? String(pkg.manifest?.integrity?.packageChecksum ?? sha256Canonical(normalized))
    : sha256Canonical(pkg ?? {});

  const partial = enforcePartialImportPolicy({
    package: pkg,
    partialPolicy: input.partialPolicy,
    moduleDependencies: input.moduleDependencies,
  });

  // Allow caller selectedModules override only under SELECTED_MODULES policy.
  let selectedModules = partial.selectedModules;
  if (
    Array.isArray(input.selectedModules) &&
    input.selectedModules.length > 0 &&
    partial.policy.policy === PARTIAL_IMPORT_POLICY.SELECTED_MODULES
  ) {
    selectedModules = [...input.selectedModules].sort();
  }

  const compatibilityResult = validationResult.valid
    ? evaluateCompatibility({
        package: pkg,
        adapterRegistry: registry,
        mandatoryModules: input.mandatoryModules,
        targetCapabilities: input.targetCapabilities,
      })
    : evaluateCompatibility({
        package: { manifest: {}, modules: {} },
        adapterRegistry: registry,
      });

  const mapping = validationResult.valid
    ? buildMappingPlan({
        package: pkg,
        packageFingerprint,
        targetRevisionFingerprint,
        selectedModules,
        mappingPolicy: input.mappingPolicy,
        adapterRegistry: registry,
        targetIndex: input.targetIndex,
        immutableTargets: input.immutableTargets,
      })
    : {
        idMappings: [],
        referenceMappings: [],
        conflicts: [],
        conflictReport: { conflicts: [], applyBlocked: false },
        mappingPlanFingerprint: sha256Canonical({ empty: true }),
      };

  /** @type {object[]} */
  const conflicts = [
    ...partial.conflicts,
    ...mapping.conflicts,
  ];

  // ALL_OR_NOTHING: any blocking validation/error/conflict → not apply eligible.
  if (
    partial.policy.policy === PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING &&
    (!validationResult.valid ||
      !compatibilityResult.applyEligible ||
      conflicts.some((c) => c.blocksApply))
  ) {
    if (validationResult.valid === false) {
      conflicts.push(
        createConflictReportEntry({
          conflictId: "dryrun:all-or-nothing:validation",
          conflictType: CONFLICT_TYPE.PARTIAL_IMPORT_DENIED,
          explanation:
            "ALL_OR_NOTHING denied due to validation failure",
        })
      );
    }
  }

  // Candidate ID bucketing (deterministic).
  const appliedCandidateIds = [];
  const pendingCandidateIds = [];
  const rejectedCandidateIds = [];
  for (const entry of mapping.idMappings ?? []) {
    const key = `${entry.sourceNamespace}:${entry.sourceId}`;
    if (entry.action === "REJECTED" || entry.status === "BLOCKED") {
      rejectedCandidateIds.push(key);
    } else if (entry.status === "CONFLICTED") {
      pendingCandidateIds.push(key);
    } else {
      appliedCandidateIds.push(key);
    }
  }
  appliedCandidateIds.sort();
  pendingCandidateIds.sort();
  rejectedCandidateIds.sort();

  const conflictReportFingerprint = sha256Canonical(
    conflicts.map((c) => ({
      conflictId: c.conflictId,
      conflictType: c.conflictType,
    }))
  );

  const importPlan = createImportPlan({
    packageFingerprint,
    targetRevisionFingerprint,
    selectedModulesFingerprint: partial.selectedModulesFingerprint,
    adapterRegistryVersion: registry.version ?? ADAPTER_REGISTRY_VERSION,
    policyVersion: IMPORT_PLAN_POLICY_VERSION,
    mappingPlanFingerprint: mapping.mappingPlanFingerprint,
    conflictReportFingerprint,
    applyEligible: false, // set below
  });

  let applyEligible =
    validationResult.valid &&
    compatibilityResult.applyEligible &&
    !partial.denied &&
    !conflicts.some((c) => c.blocksApply);

  // Re-seal import plan with final applyEligible.
  const sealedPlan = createImportPlan({
    ...importPlan,
    applyEligible,
  });

  const dryRun = createDryRunResult({
    packageFingerprint,
    targetRevisionFingerprint,
    importPlanFingerprint: sealedPlan.importPlanFingerprint,
    validationResult,
    compatibilityResult,
    referenceMappings: mapping.referenceMappings,
    idMappings: mapping.idMappings,
    conflicts,
    warnings: [
      ...(validationResult.warnings ?? []),
      ...(compatibilityResult.warnings ?? []),
    ],
    itemCounts: pkg?.manifest?.itemCounts ?? {},
    selectedModules,
    omittedModules: partial.omittedModules,
    appliedCandidateIds,
    pendingCandidateIds,
    rejectedCandidateIds,
    applyEligible,
    importPlan: sealedPlan,
  });

  // Mutation guard: target context must be unchanged.
  if (targetContextBefore != null) {
    const after = sha256Canonical(targetContext);
    if (after !== targetContextBefore) {
      throw new Error("Dry-run mutated targetContext");
    }
  }

  return dryRun;
}

export { createImportPlan, detectStaleImportPlan };
