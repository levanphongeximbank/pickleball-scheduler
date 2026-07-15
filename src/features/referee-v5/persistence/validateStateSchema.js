import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { RALLY_VARIANT, SCORING_FORMAT } from "../constants/scoringFormats.js";
import { SCORING_SYSTEM, SCORING_VARIANT } from "../constants/scoringStrategy.js";
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

  // New Rally canonical format must declare system + variant (never silent Side-Out).
  if (nextState.scoringSystem === SCORING_SYSTEM.RALLY) {
    if (!nextState.scoringVariant) {
      return createPersistenceError(
        REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED,
        "Rally scoringSystem requires scoringVariant."
      );
    }
    if (nextState.scoringVariant === SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY) {
      if (nextState.matchType !== MATCH_TYPE.DOUBLES) {
        return createPersistenceError(
          REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT,
          "USAP 2026 provisional rally is doubles-only."
        );
      }
      const freeze = nextState.freezeRule == null ? "NONE" : String(nextState.freezeRule);
      if (freeze !== "NONE") {
        return createPersistenceError(
          REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT,
          "Freeze-enabled Rally is not supported."
        );
      }
    }
  }

  // scoringFormat=rally without scoringSystem is legacy-only; reject incomplete new Rally.
  if (
    (nextState.scoringFormat === SCORING_FORMAT.RALLY || nextState.scoringFormat === "rally") &&
    nextState.scoringSystem == null &&
    nextState.scoringVariant == null
  ) {
    // Allow explicit legacy prototype markers already in ruleSetId or leave for engine
    // resolution — but forbid committing a "blank" Rally that could become Side-Out.
    // Incomplete Rally without either system/variant or a legacy ruleSetId is rejected.
    const ruleSet = String(nextState.ruleSetId || "");
    const isExplicitLegacy =
      ruleSet.includes("legacy") || ruleSet.includes("LEGACY") || ruleSet.includes("prototype");
    if (!isExplicitLegacy) {
      return createPersistenceError(
        REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED,
        "New Rally state requires scoringSystem and scoringVariant."
      );
    }
  }

  // Doubles Server 1/2: only enforce when present. Rally with serverNumberRule=NONE uses null.
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
