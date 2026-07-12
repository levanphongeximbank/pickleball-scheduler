import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { RALLY_VARIANT } from "../constants/scoringFormats.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  "team_a_score",
  "team_b_score",
  "teamAScore",
  "teamBScore",
  "serving_team_id",
  "servingTeamId",
  "serving_player_id",
  "servingPlayerId",
  "receiving_player_id",
  "receivingPlayerId",
  "server_number",
  "serverNumber",
  "player_positions",
  "playerPositions",
  "serve_direction",
  "serveDirection",
  "winner_id",
  "winnerId",
  "official_result",
  "officialResult",
  "official_score",
  "officialScore",
]);

export function validateMatchCommandPayload(commandType, payload = {}) {
  if (!commandType || typeof commandType !== "string") {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_COMMAND, "Thiếu commandType.");
  }

  const allowed = new Set(Object.values(MATCH_EVENT_TYPE));
  if (!allowed.has(commandType)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_COMMAND, `Command không hỗ trợ: ${commandType}`);
  }

  if (payload && typeof payload === "object") {
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        return createPersistenceError(
          REFEREE_V5_ERROR.INVALID_MATCH_COMMAND,
          `Client không được gửi trường chính thức: ${key}`
        );
      }
    }
  }

  if (payload?.rallyVariant === RALLY_VARIANT.MLP || payload?.scoringFormat === "mlp_rally") {
    return createPersistenceError(
      REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT,
      "MLP rally scoring chưa được hỗ trợ."
    );
  }

  return { ok: true };
}

export { FORBIDDEN_PAYLOAD_KEYS };
