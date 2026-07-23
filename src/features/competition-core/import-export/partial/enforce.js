/**
 * CORE-22 partial-import policy enforcement.
 */

import { CONFLICT_TYPE, PARTIAL_IMPORT_POLICY } from "../constants.js";
import {
  createPartialImportPolicy,
  createDefaultPartialImportPolicy,
} from "../contracts/partial-import.js";
import { createConflictReportEntry } from "../contracts/conflict-report.js";
import { compareStableString, isPlainObject } from "../utils/helpers.js";
import { sha256Canonical } from "../integrity/index.js";

/**
 * Resolve effective selected modules under a partial policy.
 *
 * @param {object} input
 * @param {object} input.package
 * @param {object} [input.partialPolicy]
 * @param {Record<string, string[]>} [input.moduleDependencies] — module → deps
 * @returns {Readonly<object>}
 */
export function enforcePartialImportPolicy(input = {}) {
  const pkg = input.package;
  const included = [...(pkg?.manifest?.includedModules ?? [])].sort(
    compareStableString
  );

  const policy = input.partialPolicy
    ? createPartialImportPolicy(input.partialPolicy)
    : createDefaultPartialImportPolicy();

  const moduleDependencies = isPlainObject(input.moduleDependencies)
    ? input.moduleDependencies
    : {};

  /** @type {object[]} */
  const conflicts = [];
  /** @type {string[]} */
  let selectedModules;
  /** @type {string[]} */
  let omittedModules;

  if (policy.policy === PARTIAL_IMPORT_POLICY.ALL_OR_NOTHING) {
    selectedModules = included;
    omittedModules = [];
  } else {
    // SELECTED_MODULES — must be explicit + dependency-closed.
    selectedModules = [...policy.selectedModules];
    const closure = new Set(policy.dependencyClosure);
    for (const mod of selectedModules) {
      if (!included.includes(mod)) {
        conflicts.push(
          createConflictReportEntry({
            conflictId: `partial:missing:${mod}`,
            conflictType: CONFLICT_TYPE.PARTIAL_IMPORT_DENIED,
            explanation: `Selected module ${mod} not in package`,
          })
        );
      }
      if (!closure.has(mod)) {
        conflicts.push(
          createConflictReportEntry({
            conflictId: `partial:closure:${mod}`,
            conflictType: CONFLICT_TYPE.PARTIAL_IMPORT_DENIED,
            explanation: `Selected module ${mod} missing from dependencyClosure`,
          })
        );
      }
      // Expand declared moduleDependencies into closure check.
      const deps = Array.isArray(moduleDependencies[mod])
        ? moduleDependencies[mod]
        : [];
      for (const dep of deps) {
        if (!closure.has(dep)) {
          conflicts.push(
            createConflictReportEntry({
              conflictId: `partial:dep:${mod}:${dep}`,
              conflictType: CONFLICT_TYPE.MISSING_DEPENDENCY,
              explanation: `Dependency ${dep} of ${mod} not in dependencyClosure`,
            })
          );
        }
        if (!selectedModules.includes(dep) && included.includes(dep)) {
          // Dependency must be selected for closed subset.
          conflicts.push(
            createConflictReportEntry({
              conflictId: `partial:dep-selected:${mod}:${dep}`,
              conflictType: CONFLICT_TYPE.PARTIAL_IMPORT_DENIED,
              explanation: `Dependency ${dep} must be selected with ${mod}`,
            })
          );
        }
      }
    }
    omittedModules = included
      .filter((m) => !selectedModules.includes(m))
      .concat(policy.omittedModules ?? []);
    omittedModules = [...new Set(omittedModules)].sort(compareStableString);
  }

  selectedModules = [...new Set(selectedModules)].sort(compareStableString);

  const selectedModulesFingerprint = sha256Canonical(selectedModules);

  return Object.freeze({
    policy,
    selectedModules: Object.freeze(selectedModules),
    omittedModules: Object.freeze(omittedModules),
    selectedModulesFingerprint,
    conflicts: Object.freeze(conflicts),
    denied: conflicts.length > 0,
  });
}
