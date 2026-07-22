/**
 * CORE-12 Phase 1C-R — compare normalized legacy vs CORE-12 court assignment.
 * Final classification uses CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1 (not branch order).
 */

import {
  CORE12_SHADOW_PARITY_V1,
} from "../constants/versions.js";
import { compareStableString } from "../deterministic/compare.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { COURT_ASSIGNMENT_STATUS } from "../enums/status.js";
import { LEGACY_SUCCESS_CLASS } from "../compatibility/legacySuccessHeuristic.js";
import {
  CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  PARITY_CLASSIFICATION,
  PARITY_CLASSIFICATION_ORDER,
  resolveFinalParityClassification,
} from "./classifications.js";
import { getIntentionalDivergence } from "./intentionalDivergences.js";
import {
  assignmentMapsEqual,
  normalizeCore12ResultForParity,
} from "./normalizeForParity.js";
import { normalizeLegacyAssignCourtsResult } from "../compatibility/normalizeLegacyAssignCourtsResult.js";

/**
 * @param {object} finding
 */
function freezeFinding(finding) {
  return Object.freeze({
    ...finding,
    details: Object.freeze({ ...(finding.details || {}) }),
  });
}

/**
 * @param {object[]} findings
 */
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const oa = PARITY_CLASSIFICATION_ORDER[a.classification] ?? 99;
    const ob = PARITY_CLASSIFICATION_ORDER[b.classification] ?? 99;
    if (oa !== ob) return oa - ob;
    return (
      compareStableString(a.classification, b.classification) ||
      compareStableString(a.message, b.message) ||
      compareStableString(
        JSON.stringify(a.details || {}),
        JSON.stringify(b.details || {})
      )
    );
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function compareLegacyAndCore12CourtAssignment(input) {
  const fixtureId =
    input && typeof input.fixtureId === "string" ? input.fixtureId : "unknown";
  const expectedClassification =
    input && typeof input.expectedClassification === "string"
      ? input.expectedClassification
      : null;
  const divergenceIds = Array.isArray(input?.divergenceIds)
    ? [...input.divergenceIds].map(String).sort(compareStableString)
    : [];

  /** @type {object[]} */
  const findings = [];
  /** @type {Set<string>} */
  const candidates = new Set();

  if (input?.fixtureInvalid === true) {
    candidates.add(PARITY_CLASSIFICATION.FIXTURE_INVALID);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.FIXTURE_INVALID,
        message: "fixture marked invalid",
        details: { fixtureId },
      })
    );
    return finalize(
      fixtureId,
      findings,
      candidates,
      expectedClassification,
      null,
      null,
      divergenceIds
    );
  }

  // --- Adapter failure path ---
  if (input?.adapterOk === false) {
    candidates.add(PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
        message: "adapter could not safely map legacy input",
        details: {
          fixtureId,
          failureCodes: Object.freeze(
            (Array.isArray(input.adapterFailures)
              ? input.adapterFailures.map((f) => String(f.code || f))
              : []
            ).sort(compareStableString)
          ),
        },
      })
    );
    // Supporting finding only — final remains UNREPRESENTABLE by precedence.
    if (input?.legacyUnsafe === true) {
      findings.push(
        freezeFinding({
          classification: PARITY_CLASSIFICATION.LEGACY_UNSAFE,
          message:
            input.legacyUnsafeReason ||
            "legacy would assign unsafely despite unrepresentable CORE-12 input",
          details: { fixtureId, supportingOnly: true },
        })
      );
    }
    for (const id of divergenceIds) {
      const entry = getIntentionalDivergence(id);
      findings.push(
        freezeFinding({
          classification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
          message: entry ? entry.title : `intentional divergence ${id}`,
          details: {
            fixtureId,
            divergenceId: id,
            catalogPresent: Boolean(entry),
            supportingOnly: true,
          },
        })
      );
    }
    return finalize(
      fixtureId,
      findings,
      candidates,
      expectedClassification,
      normalizeLegacyAssignCourtsResult(input.legacyResult),
      null,
      divergenceIds
    );
  }

  const legacyNorm = normalizeLegacyAssignCourtsResult(input.legacyResult);
  const core12Norm = normalizeCore12ResultForParity(input.core12Result);

  const mapsEqual = assignmentMapsEqual(
    legacyNorm.assignmentsByMatchId,
    core12Norm.assignmentsByMatchId
  );

  const legacyFull =
    legacyNorm.heuristic.successClass === LEGACY_SUCCESS_CLASS.FULL_SUCCESS;
  const legacyPartialAmbiguous =
    legacyNorm.heuristic.successClass ===
    LEGACY_SUCCESS_CLASS.PARTIAL_REPORTED_OK;
  const core12Success = core12Norm.status === COURT_ASSIGNMENT_STATUS.SUCCESS;
  const core12Infeasible =
    core12Norm.status === COURT_ASSIGNMENT_STATUS.INFEASIBLE;
  const core12Rejected =
    core12Norm.status === COURT_ASSIGNMENT_STATUS.REJECTED;

  // Representable + flagged unsafe → LEGACY_UNSAFE as final candidate.
  if (input?.legacyUnsafe === true) {
    candidates.add(PARITY_CLASSIFICATION.LEGACY_UNSAFE);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.LEGACY_UNSAFE,
        message:
          input.legacyUnsafeReason ||
          "legacy assignment violates certified safety invariants",
        details: {
          fixtureId,
          legacyHeuristic: legacyNorm.heuristic.successClass,
        },
      })
    );
  }

  if (
    input?.expectCore12Valid === true &&
    (core12Rejected ||
      (core12Infeasible && input?.allowInfeasible !== true))
  ) {
    candidates.add(PARITY_CLASSIFICATION.CORE12_REGRESSION);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.CORE12_REGRESSION,
        message:
          "CORE-12 failed a fixture expected to be valid under its contract",
        details: {
          fixtureId,
          status: core12Norm.status,
          conflictCodes: core12Norm.conflictCodes,
        },
      })
    );
  }

  if (divergenceIds.length > 0 || legacyPartialAmbiguous) {
    candidates.add(PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE);
    for (const id of divergenceIds) {
      const entry = getIntentionalDivergence(id);
      findings.push(
        freezeFinding({
          classification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
          message: entry ? entry.title : `intentional divergence ${id}`,
          details: {
            fixtureId,
            divergenceId: id,
            catalogPresent: Boolean(entry),
          },
        })
      );
    }
    if (legacyPartialAmbiguous) {
      findings.push(
        freezeFinding({
          classification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
          message: "legacy ambiguous ok heuristic (partial reported ok)",
          details: {
            fixtureId,
            divergenceId: "NO_AMBIGUOUS_OK",
            legacySuccessClass: legacyNorm.heuristic.successClass,
            core12Status: core12Norm.status,
            legacyOkNotMappedToCore12Success: true,
          },
        })
      );
    }
  }

  const statusExact =
    (legacyFull && core12Success) ||
    (legacyNorm.heuristic.successClass === LEGACY_SUCCESS_CLASS.EMPTY_FAILURE &&
      (core12Infeasible ||
        core12Rejected ||
        core12Norm.assignmentMatchIds.length === 0));

  if (mapsEqual && statusExact && !legacyPartialAmbiguous && divergenceIds.length === 0) {
    candidates.add(PARITY_CLASSIFICATION.EXACT_PARITY);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.EXACT_PARITY,
        message: "match-to-court map and equivalent status",
        details: { fixtureId },
      })
    );
  } else if (
    mapsEqual ||
    (core12Success && !legacyFull) ||
    (legacyNorm.heuristic.successClass ===
      LEGACY_SUCCESS_CLASS.VALIDATION_FAILURE &&
      (core12Success || core12Infeasible || core12Rejected))
  ) {
    candidates.add(PARITY_CLASSIFICATION.SEMANTIC_PARITY);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.SEMANTIC_PARITY,
        message:
          "same or equivalent business outcome with status/diagnostic/shape differences",
        details: {
          fixtureId,
          mapsEqual,
          legacySuccessClass: legacyNorm.heuristic.successClass,
          core12Status: core12Norm.status,
          legacyOkMetadataOnly: true,
        },
      })
    );
  }

  if (candidates.size === 0) {
    candidates.add(PARITY_CLASSIFICATION.SEMANTIC_PARITY);
    findings.push(
      freezeFinding({
        classification: PARITY_CLASSIFICATION.SEMANTIC_PARITY,
        message: "no stronger classification matched",
        details: { fixtureId },
      })
    );
  }

  return finalize(
    fixtureId,
    findings,
    candidates,
    expectedClassification,
    legacyNorm,
    core12Norm,
    divergenceIds
  );
}

/**
 * @param {string} fixtureId
 * @param {object[]} findings
 * @param {Set<string>} candidates
 * @param {string|null} expectedClassification
 * @param {object|null} legacyNorm
 * @param {object|null} core12Norm
 * @param {string[]} divergenceIds
 */
function finalize(
  fixtureId,
  findings,
  candidates,
  expectedClassification,
  legacyNorm,
  core12Norm,
  divergenceIds
) {
  const sortedFindings = Object.freeze(sortFindings(findings));
  const finalClassification = resolveFinalParityClassification(candidates);

  const report = Object.freeze({
    shadowParityVersion: CORE12_SHADOW_PARITY_V1,
    classificationPrecedenceVersion: CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
    fixtureId,
    /** Single final classification (precedence-selected). */
    finalClassification,
    /** Alias retained for Phase 1C callers. */
    primaryClassification: finalClassification,
    expectedClassification,
    expectedMatched:
      expectedClassification == null
        ? null
        : finalClassification === expectedClassification,
    findings: sortedFindings,
    candidateClassifications: Object.freeze(
      [...candidates].sort(
        (a, b) =>
          (PARITY_CLASSIFICATION_ORDER[a] ?? 99) -
          (PARITY_CLASSIFICATION_ORDER[b] ?? 99)
      )
    ),
    divergenceIds: Object.freeze([...divergenceIds]),
    legacyNormalized: legacyNorm,
    core12Normalized: core12Norm,
    deterministicFingerprint: fingerprintValue({
      shadowParityVersion: CORE12_SHADOW_PARITY_V1,
      classificationPrecedenceVersion: CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
      fixtureId,
      finalClassification,
      findings: sortedFindings.map((f) => ({
        classification: f.classification,
        message: f.message,
        details: f.details,
      })),
    }),
  });

  return report;
}
