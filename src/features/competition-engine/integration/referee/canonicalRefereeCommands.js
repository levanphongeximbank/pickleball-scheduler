/**
 * Shared canonical referee command names for trusted backend / application client.
 * E2E-04 facade remains the authority; this map is a translator only.
 *
 * PR #440 (production UI) adopts UNDO_LAST_SCORING_ACTION after this capability
 * lands on main — do not invent a parallel Adapter B authority here.
 */

export const CANONICAL_REFEREE_COMMAND = Object.freeze({
  ACKNOWLEDGE: "ACKNOWLEDGE",
  OPEN: "OPEN",
  START_SCORE_SESSION: "START_SCORE_SESSION",
  SUBMIT_POINT: "SUBMIT_POINT",
  UNDO_LAST_SCORING_ACTION: "UNDO_LAST_SCORING_ACTION",
  SUSPEND: "SUSPEND",
  RESUME: "RESUME",
  CHANGE_ENDS: "CHANGE_ENDS",
  SWITCH_POSITIONS: "SWITCH_POSITIONS",
  SUBMIT_RESULT: "SUBMIT_RESULT",
  CORRECT_RESULT: "CORRECT_RESULT",
});

/**
 * Command name → E2E-04 facade method.
 * @type {Readonly<Record<string, string>>}
 */
export const CANONICAL_REFEREE_COMMAND_TO_FACADE = Object.freeze({
  [CANONICAL_REFEREE_COMMAND.ACKNOWLEDGE]: "acknowledgeAssignment",
  acknowledgeAssignment: "acknowledgeAssignment",
  [CANONICAL_REFEREE_COMMAND.OPEN]: "openAssignedMatch",
  openAssignedMatch: "openAssignedMatch",
  [CANONICAL_REFEREE_COMMAND.START_SCORE_SESSION]: "createScoreEntrySession",
  createScoreEntrySession: "createScoreEntrySession",
  startScoreSession: "createScoreEntrySession",
  [CANONICAL_REFEREE_COMMAND.SUBMIT_POINT]: "submitScoreProjection",
  submitPoint: "submitScoreProjection",
  submitScoreProjection: "submitScoreProjection",
  [CANONICAL_REFEREE_COMMAND.UNDO_LAST_SCORING_ACTION]: "undoLastScoringAction",
  undoLastScoringAction: "undoLastScoringAction",
  [CANONICAL_REFEREE_COMMAND.SUSPEND]: "suspendAssignedMatch",
  suspendMatch: "suspendAssignedMatch",
  [CANONICAL_REFEREE_COMMAND.RESUME]: "resumeAssignedMatch",
  resumeMatch: "resumeAssignedMatch",
  [CANONICAL_REFEREE_COMMAND.CHANGE_ENDS]: "confirmChangeEnds",
  confirmChangeEnds: "confirmChangeEnds",
  [CANONICAL_REFEREE_COMMAND.SUBMIT_RESULT]: "submitMatchResultForValidation",
  submitResult: "submitMatchResultForValidation",
  [CANONICAL_REFEREE_COMMAND.CORRECT_RESULT]: "resubmitCorrectedResult",
  correctResult: "resubmitCorrectedResult",
});

/**
 * @param {string} commandName
 * @returns {string|null}
 */
export function resolveCanonicalRefereeFacadeMethod(commandName) {
  const key = String(commandName || "").trim();
  return CANONICAL_REFEREE_COMMAND_TO_FACADE[key] || null;
}

/**
 * Execute a canonical referee command against an E2E-04 facade.
 * @param {object} facade
 * @param {string} commandName
 * @param {object} [payload]
 */
export async function executeCanonicalRefereeCommand(
  facade,
  commandName,
  payload = {}
) {
  const method = resolveCanonicalRefereeFacadeMethod(commandName);
  if (!method || typeof facade?.[method] !== "function") {
    const err = new Error(`Unknown referee command: ${commandName}`);
    err.code = "UNKNOWN_COMMAND";
    throw err;
  }
  return facade[method](payload);
}
