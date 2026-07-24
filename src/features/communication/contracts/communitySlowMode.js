/**
 * Slow-mode configuration + decision contract (COMMS-04).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireValidTimestamp,
  timestampSortValue,
} from "./shared.js";

/**
 * @typedef {Object} CommunitySlowModeConfigContract
 * @property {boolean} enabled
 * @property {number} intervalSeconds
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunitySlowModeConfigContract>}
 */
export function createCommunitySlowModeConfigContract(input = {}) {
  const intervalSeconds =
    input.intervalSeconds == null ? 0 : Number(input.intervalSeconds);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 0) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_SLOW_MODE_INTERVAL,
      "slowMode intervalSeconds must be a non-negative integer",
      { intervalSeconds: input.intervalSeconds }
    );
  }
  const enabled =
    typeof input.enabled === "boolean"
      ? input.enabled
      : intervalSeconds > 0;

  if (enabled && intervalSeconds <= 0) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_SLOW_MODE_INTERVAL,
      "enabled slowMode requires a positive intervalSeconds",
      { enabled, intervalSeconds }
    );
  }

  return deepFreeze({
    enabled,
    intervalSeconds,
  });
}

/**
 * @typedef {Object} CommunitySlowModeDecisionContract
 * @property {boolean} allowed
 * @property {string|null} reasonCode
 * @property {number|null} retryAfterSeconds
 * @property {string|null} message
 */

/**
 * Evaluate slow-mode against last send timestamp (deterministic).
 *
 * @param {object} input
 * @returns {Readonly<CommunitySlowModeDecisionContract>}
 */
export function evaluateCommunitySlowMode(input = {}) {
  const config = createCommunitySlowModeConfigContract({
    enabled: input.enabled,
    intervalSeconds: input.intervalSeconds ?? 0,
  });

  if (input.moderatorBypass === true) {
    return deepFreeze({
      allowed: true,
      reasonCode: null,
      retryAfterSeconds: null,
      message: optionalNonEmptyString(input.message, "message"),
    });
  }

  if (!config.enabled || config.intervalSeconds <= 0) {
    return deepFreeze({
      allowed: true,
      reasonCode: null,
      retryAfterSeconds: null,
      message: null,
    });
  }

  if (input.lastSentAt == null || input.lastSentAt === "") {
    return deepFreeze({
      allowed: true,
      reasonCode: null,
      retryAfterSeconds: null,
      message: null,
    });
  }

  const lastSentAt = requireValidTimestamp(input.lastSentAt, "lastSentAt");
  const now = requireValidTimestamp(input.now, "now");
  const elapsedMs =
    timestampSortValue(now) - timestampSortValue(lastSentAt);
  const requiredMs = config.intervalSeconds * 1000;

  if (elapsedMs >= requiredMs) {
    return deepFreeze({
      allowed: true,
      reasonCode: null,
      retryAfterSeconds: null,
      message: null,
    });
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((requiredMs - elapsedMs) / 1000)
  );

  return deepFreeze({
    allowed: false,
    reasonCode: "SLOW_MODE_ACTIVE",
    retryAfterSeconds,
    message: "Slow mode interval has not elapsed",
  });
}
