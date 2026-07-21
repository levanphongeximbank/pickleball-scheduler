/**
 * CORE-09 — determinism policy runtime assertions (capability-local helpers).
 * Documentation: docs/competition-engine/core-09/03_DETERMINISM_POLICY.md
 */

/**
 * Scan source text for forbidden non-determinism patterns in CORE-09 modules.
 * Used by architecture/unit tests — not a production runtime gate.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function findForbiddenNondeterminismPatterns(source) {
  const text = String(source || "");
  /** @type {string[]} */
  const hits = [];
  if (/\bMath\.random\s*\(/.test(text)) hits.push("Math.random");
  if (/\bDate\.now\s*\(/.test(text)) hits.push("Date.now");
  if (/\bcrypto\.randomUUID\s*\(/.test(text)) hits.push("crypto.randomUUID");
  // Detect call-sites only (avoid matching this detector's own source text).
  if (new RegExp(String.raw`\buuid` + String.raw`v4\s*\(`, "i").test(text)) {
    hits.push("uuidv4");
  }
  if (/\blocales?\s*Compare\s*\(/i.test(text)) hits.push("localeCompare");
  return hits;
}

export const DETERMINISM_POLICY = Object.freeze({
  id: "CORE09_DETERMINISM_V1",
  rules: Object.freeze([
    "NO_MATH_RANDOM",
    "NO_DATE_NOW_IN_LOGICAL_KEYS",
    "NO_RANDOM_UUID_IN_LOGICAL_IDENTITY",
    "NO_LOCALE_DEPENDENT_ORDERING",
    "NO_DB_RETURN_ORDER_ASSUMPTIONS",
    "NO_MUTABLE_SHARED_GENERATION_STATE",
    "NO_UNSTABLE_OBJECT_KEY_ITERATION",
    "NO_SILENT_REORDER_WITHOUT_FINGERPRINT_IMPACT",
    "IDENTICAL_INPUTS_IDENTICAL_OUTPUTS",
    "STABLE_KEYS_FROM_STRUCTURAL_COORDINATES",
  ]),
});
