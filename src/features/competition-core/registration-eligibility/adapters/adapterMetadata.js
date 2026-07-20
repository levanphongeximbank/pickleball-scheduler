/**
 * Phase 1E — adapter / sibling compatibility metadata helpers.
 * Deterministic, JSON-safe, no Date.now / random IDs.
 */

import { cloneJsonSafe, SIBLING_ADAPTERS_VERSION } from "../contracts/shared.js";

export const CORE03_SIBLING_ADAPTER_VERSION = SIBLING_ADAPTERS_VERSION;

export const CORE03_SIBLING_ADAPTER_NAME = Object.freeze({
  RULE_EVALUATION: "core03-rule-evaluation-adapter",
  PARTICIPANT_LOOKUP: "core03-participant-lookup-adapter",
  ENTRY_LOOKUP: "core03-entry-lookup-adapter",
  ENTRY_CREATION: "core03-entry-creation-adapter",
  DIVISION_ELIGIBILITY: "core03-division-eligibility-adapter",
  TEAM_ROSTER_VALIDATION: "core03-team-roster-validation-adapter",
});

export const CORE03_SIBLING_CAPABILITY = Object.freeze({
  CORE01_RULE_ENGINE: "core-01-rule-engine",
  CORE02_PARTICIPANT: "core-02-participant",
  CORE02_ENTRY: "core-02-entry",
  CORE02_ENTRY_CREATION: "core-02-entry-creation",
  CORE04_DIVISION: "core-04-division-category",
  CORE05_TEAM_ROSTER: "core-05-team-roster",
});

/**
 * @typedef {Object} SiblingAdapterMetadata
 * @property {string} adapterName
 * @property {string} adapterVersion
 * @property {string} siblingCapability
 * @property {string|null} [siblingContractVersion]
 * @property {string|null} [siblingResultVersion]
 * @property {string|null} [evaluatedAt]
 * @property {string|null} [resolvedAt]
 * @property {string[]} [sourceIds]
 * @property {string[]} [warnings]
 */

/**
 * @param {Partial<SiblingAdapterMetadata> & {
 *   adapterName: string,
 *   siblingCapability: string,
 * }} partial
 * @returns {SiblingAdapterMetadata}
 */
export function createSiblingAdapterMetadata(partial) {
  const sourceIds = Array.isArray(partial.sourceIds)
    ? [...partial.sourceIds].map((id) => String(id)).filter(Boolean).sort()
    : [];
  const warnings = Array.isArray(partial.warnings)
    ? [...partial.warnings].map((w) => String(w)).filter(Boolean).sort()
    : [];

  return Object.freeze({
    adapterName: String(partial.adapterName),
    adapterVersion: String(partial.adapterVersion || CORE03_SIBLING_ADAPTER_VERSION),
    siblingCapability: String(partial.siblingCapability),
    siblingContractVersion:
      partial.siblingContractVersion != null && String(partial.siblingContractVersion).trim() !== ""
        ? String(partial.siblingContractVersion)
        : null,
    siblingResultVersion:
      partial.siblingResultVersion != null && String(partial.siblingResultVersion).trim() !== ""
        ? String(partial.siblingResultVersion)
        : null,
    evaluatedAt:
      partial.evaluatedAt != null && String(partial.evaluatedAt).trim() !== ""
        ? String(partial.evaluatedAt)
        : null,
    resolvedAt:
      partial.resolvedAt != null && String(partial.resolvedAt).trim() !== ""
        ? String(partial.resolvedAt)
        : null,
    sourceIds,
    warnings,
  });
}

/**
 * Defensive JSON-safe clone; never returns the original reference for objects/arrays.
 * @param {unknown} value
 * @returns {unknown}
 */
export function defensiveCopy(value) {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  try {
    return cloneJsonSafe(value);
  } catch {
    if (Array.isArray(value)) {
      return value.map((item) => (item && typeof item === "object" ? { ...item } : item));
    }
    return { ...value };
  }
}

/**
 * @param {string[]} codes
 * @returns {string[]}
 */
export function orderReasonCodes(codes = []) {
  return [...codes]
    .map((code) => String(code || "").trim())
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
