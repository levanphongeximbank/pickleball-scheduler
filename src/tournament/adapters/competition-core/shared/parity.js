/**
 * Phase 2B.3 — shadow parity classification model.
 * Shadow only — never mutates runtime / persistence.
 */

export const PARITY_CLASSIFICATION = Object.freeze({
  EXACT: "EXACT",
  SEMANTIC_MATCH: "SEMANTIC_MATCH",
  EXPECTED_FORMAT_EXTENSION: "EXPECTED_FORMAT_EXTENSION",
  MISSING_OPTIONAL_DATA: "MISSING_OPTIONAL_DATA",
  MAPPING_WARNING: "MAPPING_WARNING",
  MAPPING_FAILURE: "MAPPING_FAILURE",
  BLOCKER: "BLOCKER",
});

/**
 * @typedef {Object} ParityFinding
 * @property {string} dimension
 * @property {string} classification
 * @property {string} path
 * @property {string} message
 * @property {unknown} [legacyValue]
 * @property {unknown} [canonicalValue]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Object} input
 * @returns {ParityFinding}
 */
export function createParityFinding(input = {}) {
  return {
    dimension: String(input.dimension || "unknown"),
    classification: String(input.classification || PARITY_CLASSIFICATION.MAPPING_WARNING),
    path: String(input.path || ""),
    message: String(input.message || ""),
    legacyValue: input.legacyValue !== undefined ? input.legacyValue : null,
    canonicalValue: input.canonicalValue !== undefined ? input.canonicalValue : null,
    metadata:
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? { ...input.metadata }
        : {},
  };
}

/**
 * @param {ParityFinding[]} findings
 * @returns {{ ok: boolean, blockers: ParityFinding[], failures: ParityFinding[], warnings: ParityFinding[] }}
 */
export function summarizeParityFindings(findings = []) {
  const blockers = findings.filter((f) => f.classification === PARITY_CLASSIFICATION.BLOCKER);
  const failures = findings.filter((f) => f.classification === PARITY_CLASSIFICATION.MAPPING_FAILURE);
  const warnings = findings.filter(
    (f) =>
      f.classification === PARITY_CLASSIFICATION.MAPPING_WARNING ||
      f.classification === PARITY_CLASSIFICATION.MISSING_OPTIONAL_DATA
  );
  return {
    ok: blockers.length === 0 && failures.length === 0,
    blockers,
    failures,
    warnings,
  };
}

/**
 * Compare identity-ish fields for shadow reports.
 * @param {Object} input
 * @returns {ParityFinding[]}
 */
export function compareIdentityParity(input = {}) {
  /** @type {ParityFinding[]} */
  const findings = [];
  const legacyId = input.legacyPersonId != null ? String(input.legacyPersonId) : null;
  const canonicalId = input.canonicalPersonId != null ? String(input.canonicalPersonId) : null;

  if (!legacyId) {
    findings.push(
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.BLOCKER,
        path: "person.id",
        message: "Legacy person id missing",
      })
    );
    return findings;
  }

  if (!canonicalId) {
    findings.push(
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "person.id",
        message: "Canonical person id missing after mapping",
        legacyValue: legacyId,
      })
    );
    return findings;
  }

  if (legacyId === canonicalId) {
    findings.push(
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.EXACT,
        path: "person.id",
        message: "Person id preserved",
        legacyValue: legacyId,
        canonicalValue: canonicalId,
      })
    );
  } else {
    findings.push(
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "person.id",
        message: "Person ids differ in form but both present",
        legacyValue: legacyId,
        canonicalValue: canonicalId,
      })
    );
  }

  if (input.guestOrExternal === true) {
    findings.push(
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "person.kind",
        message: "Guest/external identity mapped without platform account requirement",
        metadata: { kind: input.canonicalKind || null },
      })
    );
  }

  return findings;
}
