/**
 * CORE-17 ValidatedResult factory, fingerprint material, standings helpers.
 */

import {
  ACCEPTANCE_STATUS,
  EVIDENCE_SEVERITY,
  LINEAGE_STATUS,
  RESULT_VALIDATION_CONTRACT_ID,
  RESULT_TYPE,
  SCORING_SIDE,
  VALIDATED_RESULT_SCHEMA_V1,
  isScoreDifferentialEligibleResultType,
  isStandingsEligibleResultType,
} from "./resultValidationConstants.js";
import {
  RESULT_ERROR_CODE,
  ResultValidationError,
} from "./resultValidationErrors.js";
import {
  compareStableString,
  deepFreezeClone,
  fingerprintCanonicalMaterial,
} from "./deterministicResultFingerprint.js";

/**
 * @param {string} side
 * @returns {string}
 */
export function oppositeSide(side) {
  return side === SCORING_SIDE.SIDE_A
    ? SCORING_SIDE.SIDE_B
    : SCORING_SIDE.SIDE_A;
}

/**
 * Resolve competition identity from a side binding.
 * Prefer entryId → teamId → matchSideId.
 * @param {object} binding
 * @returns {string|null}
 */
export function resolveSideIdentity(binding) {
  if (!binding || typeof binding !== "object") return null;
  const entryId = binding.entryId != null ? String(binding.entryId).trim() : "";
  if (entryId) return entryId;
  const teamId = binding.teamId != null ? String(binding.teamId).trim() : "";
  if (teamId) return teamId;
  const matchSideId =
    binding.matchSideId != null ? String(binding.matchSideId).trim() : "";
  return matchSideId || null;
}

/**
 * @param {object[]} evidence
 * @returns {object[]}
 */
export function sortValidationEvidence(evidence) {
  return [...(evidence || [])].sort((a, b) => {
    const codeCmp = compareStableString(
      String(a?.code || ""),
      String(b?.code || "")
    );
    if (codeCmp !== 0) return codeCmp;
    return compareStableString(String(a?.path || ""), String(b?.path || ""));
  });
}

/**
 * @param {string[]} codes
 * @returns {string[]}
 */
export function sortCorrectionRequiredCodes(codes) {
  return [...(codes || [])].map(String).sort(compareStableString);
}

/**
 * @param {object} item
 * @returns {Readonly<object>}
 */
export function createEvidenceItem(item) {
  return Object.freeze({
    code: String(item.code),
    path: String(item.path || ""),
    severity: item.severity || EVIDENCE_SEVERITY.INFO,
    messageKey: String(item.messageKey || item.code),
    inputDigest: item.inputDigest ?? null,
    expected: item.expected ?? null,
    actual: item.actual ?? null,
  });
}

/**
 * Build fingerprint material (excludes timestamps, fingerprint, free-text notes).
 * @param {object} result
 * @returns {object}
 */
export function buildFingerprintMaterial(result) {
  const technical = result.technicalMetadata
    ? {
        technicalSubtype: result.technicalMetadata.technicalSubtype ?? null,
        reasonCode: result.technicalMetadata.reasonCode ?? null,
        reasonTextKey: result.technicalMetadata.reasonTextKey ?? null,
        affectedSide: result.technicalMetadata.affectedSide ?? null,
      }
    : null;

  const evidence = sortValidationEvidence(result.validationEvidence || []).map(
    (item) => ({
      code: item.code,
      path: item.path,
      severity: item.severity,
      expected: item.expected ?? null,
      actual: item.actual ?? null,
      inputDigest: item.inputDigest ?? null,
    })
  );

  return {
    schemaVersion: result.schemaVersion,
    contractId: result.contractId,
    validatedResultId: result.validatedResultId,
    matchId: result.matchId,
    competitionId: result.competitionId,
    contextId: result.contextId,
    revision: result.revision,
    resultType: result.resultType,
    outcome: result.outcome,
    acceptanceStatus: result.acceptanceStatus,
    winnerSide: result.winnerSide ?? null,
    loserSide: result.loserSide ?? null,
    winnerId: result.winnerId ?? null,
    loserId: result.loserId ?? null,
    sideBindings: result.sideBindings,
    scoreSummaryRef: result.scoreSummaryRef ?? null,
    scoreSnapshot: result.scoreSnapshot ?? null,
    technicalMetadata: technical,
    validationEvidence: evidence,
    supersedesValidatedResultId: result.supersedesValidatedResultId ?? null,
    lineageStatus: result.lineageStatus,
    actor: {
      actorType: result.actor?.actorType ?? null,
      actorId: result.actor?.actorId ?? null,
    },
    source: {
      sourceType: result.source?.sourceType ?? null,
      sourceId: result.source?.sourceId ?? null,
    },
    rejectReasonCode: result.rejectReasonCode ?? null,
    correctionRequiredCodes: sortCorrectionRequiredCodes(
      result.correctionRequiredCodes || []
    ),
  };
}

/**
 * @param {object} result
 * @returns {string}
 */
export function computeValidatedResultFingerprint(result) {
  return fingerprintCanonicalMaterial(buildFingerprintMaterial(result));
}

/**
 * Standings-safe gate for CORE-18 consumers.
 * @param {object} result
 * @returns {boolean}
 */
export function isStandingsSafe(result) {
  if (!result || typeof result !== "object") return false;
  return (
    result.acceptanceStatus === ACCEPTANCE_STATUS.ACCEPTED &&
    result.lineageStatus === LINEAGE_STATUS.ACTIVE &&
    isStandingsEligibleResultType(result.resultType)
  );
}

/**
 * Whether point/game/set differentials may be used in standings v1.
 * @param {object} result
 * @returns {boolean}
 */
export function isScoreDifferentialEligible(result) {
  if (!isStandingsSafe(result)) return false;
  return isScoreDifferentialEligibleResultType(result.resultType);
}

/**
 * Freeze a validated result with computed fingerprint.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function finalizeValidatedResult(partial) {
  const schemaVersion = partial.schemaVersion || VALIDATED_RESULT_SCHEMA_V1;
  const contractId = partial.contractId || RESULT_VALIDATION_CONTRACT_ID;

  if (schemaVersion !== VALIDATED_RESULT_SCHEMA_V1) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Invalid validated-result schemaVersion",
      { schemaVersion }
    );
  }
  if (contractId !== RESULT_VALIDATION_CONTRACT_ID) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Invalid validated-result contractId",
      { contractId }
    );
  }

  const evidence = sortValidationEvidence(partial.validationEvidence || []).map(
    (item) => createEvidenceItem(item)
  );
  const correctionRequiredCodes = sortCorrectionRequiredCodes(
    partial.correctionRequiredCodes || []
  );

  const draft = {
    schemaVersion,
    contractId,
    validatedResultId: String(partial.validatedResultId || "").trim(),
    matchId: String(partial.matchId || "").trim(),
    competitionId: String(partial.competitionId || "").trim(),
    contextId: String(partial.contextId || "").trim(),
    revision: Number(partial.revision) || 1,
    resultType: partial.resultType,
    outcome: partial.outcome,
    acceptanceStatus: partial.acceptanceStatus || ACCEPTANCE_STATUS.PENDING,
    winnerSide: partial.winnerSide ?? null,
    loserSide: partial.loserSide ?? null,
    winnerId: partial.winnerId ?? null,
    loserId: partial.loserId ?? null,
    sideBindings: partial.sideBindings,
    scoreSummaryRef: partial.scoreSummaryRef ?? null,
    scoreSnapshot: partial.scoreSnapshot ?? null,
    technicalMetadata: partial.technicalMetadata
      ? {
          technicalSubtype: partial.technicalMetadata.technicalSubtype ?? null,
          reasonCode: partial.technicalMetadata.reasonCode ?? null,
          reasonTextKey: partial.technicalMetadata.reasonTextKey ?? null,
          affectedSide: partial.technicalMetadata.affectedSide ?? null,
          notesExcludedFromFingerprint:
            partial.technicalMetadata.notesExcludedFromFingerprint ?? null,
        }
      : null,
    validationEvidence: evidence,
    supersedesValidatedResultId: partial.supersedesValidatedResultId ?? null,
    supersededByValidatedResultId:
      partial.supersededByValidatedResultId ?? null,
    lineageStatus: partial.lineageStatus || LINEAGE_STATUS.ACTIVE,
    actor: {
      actorType: partial.actor?.actorType ?? null,
      actorId: partial.actor?.actorId ?? null,
    },
    source: {
      sourceType: partial.source?.sourceType ?? null,
      sourceId: partial.source?.sourceId ?? null,
    },
    submittedAt: partial.submittedAt ?? null,
    validatedAt: partial.validatedAt ?? null,
    acceptedAt: partial.acceptedAt ?? null,
    rejectReasonCode: partial.rejectReasonCode ?? null,
    correctionRequiredCodes,
    /** Policy hint for CORE-18 — not a separate acceptance gate. */
    standingsPolicy: Object.freeze({
      standingsEligibleType: isStandingsEligibleResultType(partial.resultType),
      scoreDifferentialEligible: isScoreDifferentialEligibleResultType(
        partial.resultType
      ),
      neverAccept:
        partial.resultType === RESULT_TYPE.ABANDONED ||
        partial.resultType === RESULT_TYPE.CANCELLED ||
        partial.resultType === RESULT_TYPE.VOID,
    }),
  };

  if (!draft.validatedResultId) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "validatedResultId is required",
      {}
    );
  }
  if (!draft.matchId || !draft.competitionId || !draft.contextId) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "matchId, competitionId, and contextId are required",
      {}
    );
  }

  const deterministicFingerprint = computeValidatedResultFingerprint(draft);
  const frozen = deepFreezeClone({
    ...draft,
    deterministicFingerprint,
  });
  return /** @type {Readonly<object>} */ (frozen);
}

/**
 * Return a superseded copy of a prior result (does not mutate input).
 * Preserves historical deterministicFingerprint per Phase 1B lock
 * (supersededBy pointer is outside fingerprint material).
 * @param {object} previousResult
 * @param {string} successorId
 * @returns {Readonly<object>}
 */
export function markResultSuperseded(previousResult, successorId) {
  if (!previousResult || typeof previousResult !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SUPERSEDE_TARGET_INVALID,
      "Previous validated result is required for supersession",
      {}
    );
  }
  if (previousResult.lineageStatus === LINEAGE_STATUS.SUPERSEDED) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SUPERSEDE_TARGET_INVALID,
      "Previous validated result is already superseded",
      { validatedResultId: previousResult.validatedResultId }
    );
  }
  return /** @type {Readonly<object>} */ (
    deepFreezeClone({
      ...previousResult,
      lineageStatus: LINEAGE_STATUS.SUPERSEDED,
      supersededByValidatedResultId: String(successorId),
      deterministicFingerprint: previousResult.deterministicFingerprint,
    })
  );
}
