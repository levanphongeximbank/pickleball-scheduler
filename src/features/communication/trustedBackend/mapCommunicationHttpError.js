/**
 * Map CommunicationFoundationError → HTTP status + audit-safe JSON body.
 * Never includes secrets, tokens, or message bodies beyond typed codes.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  isCommunicationFoundationError,
  isCommunicationFoundationErrorCode,
} from "../errors/CommunicationFoundationError.js";

const FORBIDDEN_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.AUTHORIZATION_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_SEND_POLICY_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_CLUB_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_TENANT_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_PERMISSION_DENIED,
]);

const NOT_FOUND_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REPLY_TARGET_NOT_FOUND,
]);

const CONFLICT_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT,
]);

const UNAVAILABLE_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
  COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED,
]);

/**
 * @param {unknown} err
 * @returns {{ status: number, body: Readonly<object> }}
 */
export function mapCommunicationHttpError(err) {
  if (
    err &&
    typeof err === "object" &&
    err.code === "COMMUNITY_BLOCKED_FAIL_CLOSED"
  ) {
    return {
      status: 403,
      body: Object.freeze({
        ok: false,
        code: "COMMUNITY_BLOCKED_FAIL_CLOSED",
        error: "Community Communication remains BLOCKED_FAIL_CLOSED.",
      }),
    };
  }

  if (
    isCommunicationFoundationError(err) ||
    (err &&
      typeof err === "object" &&
      isCommunicationFoundationErrorCode(/** @type {{code?: string}} */ (err).code))
  ) {
    const code = String(/** @type {{code: string}} */ (err).code);
    let status = 400;
    if (FORBIDDEN_CODES.has(code)) status = 403;
    else if (NOT_FOUND_CODES.has(code)) status = 404;
    else if (CONFLICT_CODES.has(code)) status = 409;
    else if (UNAVAILABLE_CODES.has(code)) status = 503;
    else if (code === COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE) {
      status = 403;
    }

    return {
      status,
      body: Object.freeze({
        ok: false,
        code,
        error: /** @type {{message?: string}} */ (err).message || "Communication command failed",
        details: sanitizeDetails(/** @type {{details?: object}} */ (err).details),
      }),
    };
  }

  const message = err?.message || String(err || "Internal error");
  return {
    status: 500,
    body: Object.freeze({
      ok: false,
      code: "INTERNAL_ERROR",
      error: message,
    }),
  };
}

/**
 * @param {unknown} details
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== "object") return null;
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (/secret|token|password|apikey|service_role|authorization/i.test(key)) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || value == null) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? Object.freeze(out) : null;
}
