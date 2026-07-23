/**
 * CORE-17 — validate match result submissions (no auto-accept).
 */

import {
  ACCEPTANCE_FORBIDDEN_RESULT_TYPES,
  ACCEPTANCE_STATUS,
  ACTOR_TYPE,
  ACTOR_TYPE_VALUES,
  ELEVATED_ACTOR_TYPES,
  EVIDENCE_SEVERITY,
  FORFEIT_TECHNICAL_SUBTYPES,
  LINEAGE_STATUS,
  MATCH_SIDE_KEY,
  OUTCOME,
  OUTCOME_VALUES,
  RESULT_EVIDENCE_CODE,
  RESULT_TYPE,
  RESULT_TYPE_VALUES,
  SCORING_SIDE,
  SOURCE_TYPE_VALUES,
  TECHNICAL_RESULT_TYPES,
  TECHNICAL_SUBTYPE_VALUES,
  WIN_LOSS_RESULT_TYPES,
} from "./resultValidationConstants.js";
import {
  RESULT_ERROR_CODE,
  ResultValidationError,
} from "./resultValidationErrors.js";
import {
  adaptCore16Projection,
  assertScoreSnapshotConsistent,
} from "./core16ProjectionAdapter.js";
import {
  createEvidenceItem,
  finalizeValidatedResult,
  markResultSuperseded,
  oppositeSide,
  resolveSideIdentity,
  sortValidationEvidence,
} from "./validatedResult.js";

/**
 * @param {() => string} [now]
 * @returns {string}
 */
function defaultNow(now) {
  return typeof now === "function" ? now() : new Date().toISOString();
}

/**
 * @param {() => string} [nextId]
 * @param {string} [prefix]
 * @returns {string}
 */
function defaultNextId(nextId, prefix = "vr") {
  if (typeof nextId === "function") return nextId();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {unknown} side
 * @returns {boolean}
 */
function isScoringSide(side) {
  return side === SCORING_SIDE.SIDE_A || side === SCORING_SIDE.SIDE_B;
}

/**
 * @param {object[]} bindings
 */
function assertSideBindings(bindings) {
  if (!Array.isArray(bindings) || bindings.length !== 2) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "sideBindings must contain exactly two entries (A then B)",
      { length: Array.isArray(bindings) ? bindings.length : null }
    );
  }
  const [a, b] = bindings;
  if (
    a?.matchSideKey !== MATCH_SIDE_KEY.A ||
    a?.scoringSide !== SCORING_SIDE.SIDE_A
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "sideBindings[0] must be matchSideKey A / scoringSide SIDE_A",
      { binding: a }
    );
  }
  if (
    b?.matchSideKey !== MATCH_SIDE_KEY.B ||
    b?.scoringSide !== SCORING_SIDE.SIDE_B
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "sideBindings[1] must be matchSideKey B / scoringSide SIDE_B",
      { binding: b }
    );
  }
  for (const binding of bindings) {
    if (!binding.matchSideId || !String(binding.matchSideId).trim()) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
        "sideBindings.matchSideId is required",
        {}
      );
    }
    if (
      binding.participantIds != null &&
      !Array.isArray(binding.participantIds)
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
        "sideBindings.participantIds must be an array when present",
        {}
      );
    }
  }
}

/**
 * @param {object} actor
 * @param {string} resultType
 */
function assertActor(actor, resultType) {
  if (!actor || typeof actor !== "object" || !actor.actorType) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
      "actor.actorType is required",
      {}
    );
  }
  if (!ACTOR_TYPE_VALUES.has(actor.actorType)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
      "Invalid actor.actorType",
      { actorType: actor.actorType }
    );
  }
  if (TECHNICAL_RESULT_TYPES.includes(resultType)) {
    if (!ELEVATED_ACTOR_TYPES.includes(actor.actorType)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_ACTOR_REQUIRED,
        "Technical result types require an elevated actor",
        { actorType: actor.actorType, resultType }
      );
    }
  }
}

/**
 * @param {object} source
 */
function assertSource(source) {
  if (!source || typeof source !== "object" || !source.sourceType) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SOURCE_INVALID,
      "source.sourceType is required",
      {}
    );
  }
  if (!SOURCE_TYPE_VALUES.has(source.sourceType)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SOURCE_INVALID,
      "Invalid source.sourceType",
      { sourceType: source.sourceType }
    );
  }
}

/**
 * @param {object} submission
 * @param {object[]} sideBindings
 * @returns {{ winnerSide: string|null, loserSide: string|null, winnerId: string|null, loserId: string|null, outcome: string }}
 */
function resolveWinnerLoser(submission, sideBindings) {
  const resultType = submission.resultType;
  let winnerSide = submission.winnerSide ?? null;
  let loserSide = submission.loserSide ?? null;
  let outcome = submission.outcome;

  if (
    outcome === "DRAW" ||
    resultType === "DRAW" ||
    String(submission.draw || "").toLowerCase() === "true"
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_DRAW_NOT_SUPPORTED,
      "Draw results are not supported in validated-result.v1",
      { outcome, resultType }
    );
  }

  if (outcome === OUTCOME.DOUBLE_LOSS) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_OUTCOME,
      "DOUBLE_LOSS is not supported in v1",
      { outcome }
    );
  }

  if (WIN_LOSS_RESULT_TYPES.includes(resultType)) {
    if (!outcome) outcome = OUTCOME.WIN_LOSS;
    if (outcome !== OUTCOME.WIN_LOSS) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_INVALID_OUTCOME,
        "WIN_LOSS outcome required for competitive result types",
        { outcome, resultType }
      );
    }
    if (!isScoringSide(winnerSide)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_WINNER_REQUIRED,
        "winnerSide is required",
        { winnerSide }
      );
    }
    if (!isScoringSide(loserSide)) {
      loserSide = oppositeSide(winnerSide);
    }
    if (loserSide !== oppositeSide(winnerSide)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_LOSER_REQUIRED,
        "loserSide must be the opposite of winnerSide",
        { winnerSide, loserSide }
      );
    }
  } else if (ACCEPTANCE_FORBIDDEN_RESULT_TYPES.includes(resultType)) {
    if (!outcome) outcome = OUTCOME.NO_WINNER;
    if (outcome !== OUTCOME.NO_WINNER) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_INVALID_OUTCOME,
        "NO_WINNER outcome required for ABANDONED/CANCELLED/VOID",
        { outcome, resultType }
      );
    }
    if (winnerSide != null || loserSide != null) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_WINNER_FORBIDDEN,
        "winnerSide/loserSide must be null for ABANDONED/CANCELLED/VOID",
        { winnerSide, loserSide }
      );
    }
    return {
      winnerSide: null,
      loserSide: null,
      winnerId: null,
      loserId: null,
      outcome,
    };
  }

  if (!OUTCOME_VALUES.has(outcome)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_OUTCOME,
      "Invalid outcome",
      { outcome }
    );
  }

  const winnerBinding = sideBindings.find((b) => b.scoringSide === winnerSide);
  const loserBinding = sideBindings.find((b) => b.scoringSide === loserSide);
  const winnerId = resolveSideIdentity(winnerBinding);
  const loserId = resolveSideIdentity(loserBinding);

  if (!winnerId) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "Unable to resolve winnerId from sideBindings",
      { winnerSide }
    );
  }
  if (!loserId) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "Unable to resolve loserId from sideBindings",
      { loserSide }
    );
  }

  if (
    submission.winnerId != null &&
    String(submission.winnerId) !== String(winnerId)
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SIDE_BINDING_INVALID,
      "Declared winnerId does not match sideBindings resolution",
      { declared: submission.winnerId, resolved: winnerId }
    );
  }
  if (
    submission.loserId != null &&
    String(submission.loserId) !== String(loserId)
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_LOSER_REQUIRED,
      "Declared loserId does not match sideBindings resolution",
      { declared: submission.loserId, resolved: loserId }
    );
  }

  return { winnerSide, loserSide, winnerId, loserId, outcome };
}

/**
 * @param {object} submission
 * @param {string} resultType
 */
function assertTechnicalMetadata(submission, resultType) {
  const meta = submission.technicalMetadata;

  if (resultType === RESULT_TYPE.NO_SHOW) {
    if (!meta || !isScoringSide(meta.affectedSide)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED,
        "NO_SHOW requires technicalMetadata.affectedSide",
        {}
      );
    }
    if (meta.affectedSide !== submission.loserSide && submission.loserSide) {
      // loser must be the no-show side
      if (meta.affectedSide === submission.winnerSide) {
        throw new ResultValidationError(
          RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED,
          "NO_SHOW affectedSide must be the losing side",
          { affectedSide: meta.affectedSide }
        );
      }
    }
  }

  if (resultType === RESULT_TYPE.RETIREMENT) {
    if (!meta || !isScoringSide(meta.affectedSide)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED,
        "RETIREMENT requires technicalMetadata.affectedSide",
        {}
      );
    }
  }

  if (resultType === RESULT_TYPE.FORFEIT) {
    if (!meta || !meta.technicalSubtype) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_SUBTYPE_REQUIRED,
        "FORFEIT requires technicalMetadata.technicalSubtype",
        {}
      );
    }
    if (!FORFEIT_TECHNICAL_SUBTYPES.includes(meta.technicalSubtype)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_SUBTYPE_REQUIRED,
        "FORFEIT technicalSubtype must be a forfeit subtype",
        { technicalSubtype: meta.technicalSubtype }
      );
    }
  }

  if (
    resultType === RESULT_TYPE.ABANDONED ||
    resultType === RESULT_TYPE.CANCELLED
  ) {
    if (!meta || !meta.reasonCode || !String(meta.reasonCode).trim()) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED,
        `${resultType} requires technicalMetadata.reasonCode`,
        {}
      );
    }
  }

  if (meta?.technicalSubtype != null) {
    if (!TECHNICAL_SUBTYPE_VALUES.has(meta.technicalSubtype)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_TECHNICAL_SUBTYPE_REQUIRED,
        "Invalid technicalSubtype",
        { technicalSubtype: meta.technicalSubtype }
      );
    }
  }
}

/**
 * Validate a match result submission.
 * Validation pass yields PENDING (never auto-ACCEPTED).
 *
 * @param {object} submission
 * @param {{
 *   scoringProjection?: object,
 *   now?: () => string,
 *   nextId?: () => string,
 *   correction?: {
 *     previousResult: object,
 *     expectedActiveValidatedResultId: string,
 *     expectedRevision: number,
 *   },
 * }} [deps]
 * @returns {Readonly<object> | { validatedResult: Readonly<object>, supersededResult: Readonly<object> }}
 */
export function validateMatchResult(submission, deps = {}) {
  if (!submission || typeof submission !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_SCHEMA,
      "Submission object is required",
      {}
    );
  }

  const resultTypeRaw = String(submission.resultType || "").trim();
  if (resultTypeRaw === "NO_CONTEST") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_UNSUPPORTED_NO_CONTEST_ENUM,
      "NO_CONTEST is not a RESULT_TYPE; use VOID + technicalSubtype NO_CONTEST",
      {}
    );
  }
  if (resultTypeRaw === "DRAW") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_DRAW_NOT_SUPPORTED,
      "Draw results are not supported",
      {}
    );
  }
  if (!RESULT_TYPE_VALUES.has(resultTypeRaw)) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_RESULT_TYPE,
      "Invalid resultType",
      { resultType: resultTypeRaw }
    );
  }

  const sideBindings = (submission.sideBindings || []).map((b) => ({
    matchSideKey: b.matchSideKey,
    scoringSide: b.scoringSide,
    matchSideId: b.matchSideId,
    entryId: b.entryId ?? null,
    teamId: b.teamId ?? null,
    participantIds: Array.isArray(b.participantIds)
      ? [...b.participantIds]
      : [],
  }));
  assertSideBindings(sideBindings);
  assertActor(submission.actor, resultTypeRaw);
  assertSource(submission.source);

  let correctionRevision = 1;
  let supersedesValidatedResultId = null;
  /** @type {object|null} */
  let previousResult = null;

  if (deps.correction) {
    previousResult = deps.correction.previousResult;
    if (!previousResult || typeof previousResult !== "object") {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SUPERSEDE_TARGET_INVALID,
        "correction.previousResult is required",
        {}
      );
    }
    if (previousResult.lineageStatus !== LINEAGE_STATUS.ACTIVE) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SUPERSEDE_TARGET_INVALID,
        "Can only supersede an ACTIVE validated result",
        { lineageStatus: previousResult.lineageStatus }
      );
    }
    if (
      String(previousResult.validatedResultId) !==
      String(deps.correction.expectedActiveValidatedResultId)
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_CONCURRENT_CORRECTION,
        "expectedActiveValidatedResultId does not match active result",
        {
          expected: deps.correction.expectedActiveValidatedResultId,
          actual: previousResult.validatedResultId,
        }
      );
    }
    if (Number(previousResult.revision) !== Number(deps.correction.expectedRevision)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_CONCURRENT_CORRECTION,
        "expectedRevision does not match active result revision",
        {
          expected: deps.correction.expectedRevision,
          actual: previousResult.revision,
        }
      );
    }
    if (String(previousResult.matchId) !== String(submission.matchId)) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SUPERSEDE_TARGET_INVALID,
        "Correction matchId must match previous result",
        {}
      );
    }
    correctionRevision = Number(previousResult.revision) + 1;
    supersedesValidatedResultId = previousResult.validatedResultId;
  }

  const { winnerSide, loserSide, winnerId, loserId, outcome } =
    resolveWinnerLoser(
      { ...submission, resultType: resultTypeRaw, loserSide: submission.loserSide ?? (isScoringSide(submission.winnerSide) ? oppositeSide(submission.winnerSide) : null) },
      sideBindings
    );

  // Align NO_SHOW/RETIREMENT affectedSide with loser after resolution
  if (
    (resultTypeRaw === RESULT_TYPE.NO_SHOW ||
      resultTypeRaw === RESULT_TYPE.RETIREMENT) &&
    submission.technicalMetadata?.affectedSide &&
    submission.technicalMetadata.affectedSide !== loserSide
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED,
      `${resultTypeRaw} affectedSide must equal loserSide`,
      {
        affectedSide: submission.technicalMetadata.affectedSide,
        loserSide,
      }
    );
  }

  assertTechnicalMetadata(
    {
      ...submission,
      winnerSide,
      loserSide,
    },
    resultTypeRaw
  );

  /** @type {object[]} */
  const evidence = [];
  evidence.push(
    createEvidenceItem({
      code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_SCHEMA_OK,
      path: "/schemaVersion",
      severity: EVIDENCE_SEVERITY.INFO,
      messageKey: "result.evidence.schema_ok",
    })
  );
  evidence.push(
    createEvidenceItem({
      code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_SIDE_BINDINGS_OK,
      path: "/sideBindings",
      severity: EVIDENCE_SEVERITY.INFO,
      messageKey: "result.evidence.side_bindings_ok",
    })
  );
  evidence.push(
    createEvidenceItem({
      code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_ACTOR_OK,
      path: "/actor",
      severity: EVIDENCE_SEVERITY.INFO,
      messageKey: "result.evidence.actor_ok",
      actual: submission.actor?.actorType,
    })
  );

  /** @type {object|null} */
  let scoreSummaryRef = null;
  /** @type {object|null} */
  let scoreSnapshot = null;

  if (resultTypeRaw === RESULT_TYPE.COMPLETED) {
    if (!deps.scoringProjection) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SCORE_REF_REQUIRED,
        "COMPLETED requires a CORE-16 scoringProjection",
        {}
      );
    }
    const adapted = adaptCore16Projection(deps.scoringProjection, {
      requireTerminal: true,
      expectedMatchId: submission.matchId,
    });
    scoreSummaryRef = adapted.scoreSummaryRef;
    scoreSnapshot = adapted.scoreSnapshot;
    assertScoreSnapshotConsistent(submission.scoreSnapshot, scoreSnapshot);

    if (winnerSide !== scoreSnapshot.calculatedWinnerSide) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH,
        "winnerSide does not match CORE-16 calculatedWinnerSide",
        {
          winnerSide,
          calculatedWinnerSide: scoreSnapshot.calculatedWinnerSide,
        }
      );
    }

    evidence.push(
      createEvidenceItem({
        code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_SCORE_REF_PRESENT,
        path: "/scoreSummaryRef",
        severity: EVIDENCE_SEVERITY.INFO,
        messageKey: "result.evidence.score_ref_present",
        inputDigest: scoreSummaryRef.inputDigest,
      })
    );
    evidence.push(
      createEvidenceItem({
        code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_SCORE_TERMINAL_OK,
        path: "/scoreSnapshot/calculatedMatchComplete",
        severity: EVIDENCE_SEVERITY.INFO,
        messageKey: "result.evidence.score_terminal_ok",
        expected: true,
        actual: true,
      })
    );
    evidence.push(
      createEvidenceItem({
        code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_WINNER_ALIGNED,
        path: "/winnerSide",
        severity: EVIDENCE_SEVERITY.INFO,
        messageKey: "result.evidence.winner_aligned",
        expected: scoreSnapshot.calculatedWinnerSide,
        actual: winnerSide,
      })
    );
  } else if (deps.scoringProjection) {
    // Optional partial score for technical types (e.g. RETIREMENT audit).
    const adapted = adaptCore16Projection(deps.scoringProjection, {
      requireTerminal: false,
      expectedMatchId: submission.matchId,
    });
    scoreSummaryRef = adapted.scoreSummaryRef;
    scoreSnapshot = adapted.scoreSnapshot;
    assertScoreSnapshotConsistent(submission.scoreSnapshot, scoreSnapshot);

    if (
      scoreSnapshot.calculatedWinnerSide != null &&
      isScoringSide(winnerSide) &&
      scoreSnapshot.calculatedWinnerSide !== winnerSide &&
      scoreSnapshot.calculatedMatchComplete === true
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH,
        "Declared winner conflicts with terminal calculatedWinnerSide",
        {
          winnerSide,
          calculatedWinnerSide: scoreSnapshot.calculatedWinnerSide,
        }
      );
    }
  } else if (submission.scoreSnapshot) {
    // Allow caller-provided audit snapshot without projection (technical path).
    scoreSnapshot = {
      points: submission.scoreSnapshot.points
        ? {
            SIDE_A: Number(submission.scoreSnapshot.points.SIDE_A) || 0,
            SIDE_B: Number(submission.scoreSnapshot.points.SIDE_B) || 0,
          }
        : { SIDE_A: 0, SIDE_B: 0 },
      setsWon: submission.scoreSnapshot.setsWon
        ? {
            SIDE_A: Number(submission.scoreSnapshot.setsWon.SIDE_A) || 0,
            SIDE_B: Number(submission.scoreSnapshot.setsWon.SIDE_B) || 0,
          }
        : { SIDE_A: 0, SIDE_B: 0 },
      completedSets: Number(submission.scoreSnapshot.completedSets) || 0,
      completedGames: Number(submission.scoreSnapshot.completedGames) || 0,
      calculatedMatchComplete: Boolean(
        submission.scoreSnapshot.calculatedMatchComplete
      ),
      calculatedWinnerSide: submission.scoreSnapshot.calculatedWinnerSide ?? null,
    };
  }

  if (TECHNICAL_RESULT_TYPES.includes(resultTypeRaw)) {
    evidence.push(
      createEvidenceItem({
        code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_TECHNICAL_META_OK,
        path: "/technicalMetadata",
        severity: EVIDENCE_SEVERITY.INFO,
        messageKey: "result.evidence.technical_meta_ok",
      })
    );
  }

  evidence.push(
    createEvidenceItem({
      code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_STANDINGS_ELIGIBILITY,
      path: "/resultType",
      severity: EVIDENCE_SEVERITY.INFO,
      messageKey: "result.evidence.standings_eligibility",
      actual: !ACCEPTANCE_FORBIDDEN_RESULT_TYPES.includes(resultTypeRaw),
    })
  );
  evidence.push(
    createEvidenceItem({
      code: RESULT_EVIDENCE_CODE.RESULT_EVIDENCE_FINGERPRINT_INPUT_OK,
      path: "/deterministicFingerprint",
      severity: EVIDENCE_SEVERITY.INFO,
      messageKey: "result.evidence.fingerprint_input_ok",
    })
  );

  const sortedEvidence = sortValidationEvidence(evidence);
  const timestamp = defaultNow(deps.now);
  const validatedResultId = defaultNextId(deps.nextId);

  const validatedResult = finalizeValidatedResult({
    validatedResultId,
    matchId: String(submission.matchId || "").trim(),
    competitionId: String(submission.competitionId || "").trim(),
    contextId: String(submission.contextId || "").trim(),
    revision: correctionRevision,
    resultType: resultTypeRaw,
    outcome,
    acceptanceStatus: ACCEPTANCE_STATUS.PENDING,
    winnerSide,
    loserSide,
    winnerId,
    loserId,
    sideBindings,
    scoreSummaryRef,
    scoreSnapshot,
    technicalMetadata: submission.technicalMetadata
      ? {
          technicalSubtype: submission.technicalMetadata.technicalSubtype ?? null,
          reasonCode: submission.technicalMetadata.reasonCode ?? null,
          reasonTextKey: submission.technicalMetadata.reasonTextKey ?? null,
          affectedSide: submission.technicalMetadata.affectedSide ?? null,
          notesExcludedFromFingerprint:
            submission.technicalMetadata.notesExcludedFromFingerprint ?? null,
        }
      : null,
    validationEvidence: sortedEvidence,
    supersedesValidatedResultId,
    supersededByValidatedResultId: null,
    lineageStatus: LINEAGE_STATUS.ACTIVE,
    actor: {
      actorType: submission.actor.actorType,
      actorId: submission.actor.actorId ?? null,
    },
    source: {
      sourceType: submission.source.sourceType,
      sourceId: submission.source.sourceId ?? null,
    },
    submittedAt: submission.submittedAt ?? timestamp,
    validatedAt: timestamp,
    acceptedAt: null,
    rejectReasonCode: null,
    correctionRequiredCodes: [],
  });

  if (previousResult) {
    const supersededResult = markResultSuperseded(
      previousResult,
      validatedResult.validatedResultId
    );
    return Object.freeze({ validatedResult, supersededResult });
  }

  return validatedResult;
}

/**
 * Build a REJECTED or CORRECTION_REQUIRED result without throwing
 * (for callers that prefer result objects). Hard contract failures still throw.
 *
 * @param {object} submission
 * @param {string} acceptanceStatus
 * @param {string} rejectReasonCode
 * @param {string[]} [correctionRequiredCodes]
 * @param {object} [deps]
 * @returns {Readonly<object>}
 */
export function finalizeNonAcceptedResult(
  submission,
  acceptanceStatus,
  rejectReasonCode,
  correctionRequiredCodes = [],
  deps = {}
) {
  if (
    acceptanceStatus !== ACCEPTANCE_STATUS.REJECTED &&
    acceptanceStatus !== ACCEPTANCE_STATUS.CORRECTION_REQUIRED
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_INVALID_ACCEPTANCE_TRANSITION,
      "finalizeNonAcceptedResult only supports REJECTED or CORRECTION_REQUIRED",
      { acceptanceStatus }
    );
  }

  const timestamp = defaultNow(deps.now);
  return finalizeValidatedResult({
    validatedResultId: defaultNextId(deps.nextId),
    matchId: String(submission.matchId || "").trim(),
    competitionId: String(submission.competitionId || "").trim(),
    contextId: String(submission.contextId || "").trim(),
    revision: 1,
    resultType: submission.resultType,
    outcome: submission.outcome || OUTCOME.NO_WINNER,
    acceptanceStatus,
    winnerSide: submission.winnerSide ?? null,
    loserSide: submission.loserSide ?? null,
    winnerId: submission.winnerId ?? null,
    loserId: submission.loserId ?? null,
    sideBindings: submission.sideBindings || [],
    scoreSummaryRef: null,
    scoreSnapshot: null,
    technicalMetadata: submission.technicalMetadata ?? null,
    validationEvidence: [
      createEvidenceItem({
        code: rejectReasonCode,
        path: "/",
        severity: EVIDENCE_SEVERITY.ERROR,
        messageKey: "result.evidence.rejected",
        actual: rejectReasonCode,
      }),
    ],
    supersedesValidatedResultId: null,
    supersededByValidatedResultId: null,
    lineageStatus: LINEAGE_STATUS.ACTIVE,
    actor: submission.actor || { actorType: ACTOR_TYPE.UNKNOWN, actorId: null },
    source: submission.source || { sourceType: "MANUAL_TECHNICAL", sourceId: null },
    submittedAt: timestamp,
    validatedAt: timestamp,
    acceptedAt: null,
    rejectReasonCode,
    correctionRequiredCodes,
  });
}
