import { deriveRuleSource, resolveRuleSourcePriority } from "./ruleSource.js";
import { resolveRulePriorityRank } from "./rulePriority.js";

/**
 * @typedef {Object} NormalizedRuleAuthority
 * @property {string} id
 * @property {string} source
 * @property {number} sourcePriority
 * @property {number} priorityRank
 * @property {number} ruleSetVersion
 * @property {number} updatedAtMs
 */

/**
 * Normalize authority fields used by the deterministic comparator.
 * Pure — does not mutate input.
 *
 * @param {object|null|undefined} rule
 * @returns {NormalizedRuleAuthority}
 */
export function normalizeRuleAuthority(rule) {
  const source = deriveRuleSource(rule || {});
  const sourcePriority = resolveRuleSourcePriority(rule || {});
  const priorityRank = resolveRulePriorityRank(rule || {});
  const versionRaw = rule?.ruleSetVersion ?? rule?.version;
  const ruleSetVersion = Number(versionRaw);
  const updatedAtMs =
    Date.parse(rule?.updatedAt || rule?.metadata?.updatedAt || "") || 0;

  return {
    id: String(rule?.id ?? ""),
    source,
    sourcePriority: Number.isFinite(sourcePriority) ? sourcePriority : 0,
    priorityRank: Number.isFinite(priorityRank) ? priorityRank : 0,
    ruleSetVersion: Number.isFinite(ruleSetVersion) ? ruleSetVersion : 0,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
  };
}

/**
 * Authority comparator (higher = wins). Ladder:
 * 1. sourcePriority DESC
 * 2. rule priority DESC
 * 3. ruleSetVersion DESC
 * 4. updatedAt DESC
 * 5. id ASC
 *
 * CONSTRAINT_SCOPE is intentionally excluded.
 * Never uses array insertion order or object key iteration order.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number} >0 when `a` outranks `b`; <0 when `b` outranks `a`; 0 when equal
 */
export function compareRuleAuthority(a, b) {
  const na = normalizeRuleAuthority(a);
  const nb = normalizeRuleAuthority(b);

  if (na.sourcePriority !== nb.sourcePriority) {
    return na.sourcePriority - nb.sourcePriority;
  }
  if (na.priorityRank !== nb.priorityRank) {
    return na.priorityRank - nb.priorityRank;
  }
  if (na.ruleSetVersion !== nb.ruleSetVersion) {
    return na.ruleSetVersion - nb.ruleSetVersion;
  }
  if (na.updatedAtMs !== nb.updatedAtMs) {
    return na.updatedAtMs - nb.updatedAtMs;
  }
  // id ASC via UTF-16 code-unit order (NOT localeCompare — locale-independent / stable).
  // Lower id outranks: return >0 when na.id < nb.id.
  if (na.id < nb.id) {
    return 1;
  }
  if (na.id > nb.id) {
    return -1;
  }
  // Equal ids (including both empty) → total order cannot distinguish these identities.
  return 0;
}
