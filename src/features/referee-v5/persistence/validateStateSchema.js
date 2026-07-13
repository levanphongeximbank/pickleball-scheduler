import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { RALLY_VARIANT } from "../constants/scoringFormats.js";
import { STATE_SCHEMA_VERSION } from "../constants/stateSchema.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";
import { validatePersistedMatchState, assertVersionIncrement } from "./validatePersistedState.js";

export function validateStateSchemaVersion(state) {
  const version = state?.stateSchemaVersion ?? state?.state_schema_version;
  if (version == null) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      "Thiếu stateSchemaVersion."
    );
  }
  if (Number(version) !== STATE_SCHEMA_VERSION) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      `stateSchemaVersion không hỗ trợ: ${version}`
    );
  }
  return { ok: true };
}

export function validateCommitTransition({
  liveRow,
  matchId,
  beforeVersion,
  beforeSequence,
  nextState,
}) {
  const schemaCheck = validateStateSchemaVersion(nextState);
  if (!schemaCheck.ok) {
    return schemaCheck;
  }

  if (String(nextState.matchId) !== String(matchId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "matchId trong state không khớp.");
  }

  if (liveRow?.teamAId && String(nextState.teams?.teamA?.teamId) !== String(liveRow.teamAId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "teamA không khớp match row.");
  }
  if (liveRow?.teamBId && String(nextState.teams?.teamB?.teamId) !== String(liveRow.teamBId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "teamB không khớp match row.");
  }

  const versionCheck = assertVersionIncrement(beforeVersion, nextState.version);
  if (!versionCheck.ok) {
    return versionCheck;
  }

  if (Number(nextState.lastEventSequence) !== Number(beforeSequence) + 1) {
    return createPersistenceError(
      REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT,
      "Event sequence phải tăng đúng 1."
    );
  }

  if (nextState.rallyVariant === RALLY_VARIANT.MLP || nextState.scoringFormat === "mlp_rally") {
    return createPersistenceError(REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT);
  }

  if (
    nextState.matchType === MATCH_TYPE.DOUBLES &&
    nextState.serverNumber != null &&
    ![1, 2].includes(Number(nextState.serverNumber))
  ) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Doubles side-out server number không hợp lệ.");
  }

  if (nextState.status === MATCH_STATUS.LOCKED) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
  }

  return validatePersistedMatchState(nextState);
}
