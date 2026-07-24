/**
 * Map Communication domain/application/persistence errors → stable experience errors.
 * Never logs message bodies, tokens, or sensitive profile fields.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CommunicationFoundationError,
  isCommunicationFoundationError,
} from "../errors/CommunicationFoundationError.js";
import {
  COMMUNICATION_EXPERIENCE_ERROR_CODE,
  COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
} from "./constants.js";

const UNAUTHORIZED_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN,
  COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_COMMUNITY_MODERATOR,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_UNAUTHORIZED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
]);

const FORBIDDEN_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_SEND_POLICY_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_ACCESS_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_READ_ONLY,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_JOIN_REQUIRED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_SUBSCRIPTION_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_PERMISSION_DENIED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_CLUB_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_TENANT_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
]);

const NOT_ACTIVATED_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED,
  "COMMUNICATION_RUNTIME_NOT_ACTIVATED",
]);

const NETWORK_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
]);

const CONFLICT_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_CHANNEL,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_LOBBY,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
  COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
]);

const VALIDATION_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_IDENTIFIER,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MESSAGE_STATUS,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_ATTACHMENT_REF,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REACTION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_USER_BLOCK,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MESSAGE_REPORT,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MODERATION_ACTION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_VISIBILITY,
  COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_SLOW_MODE_INTERVAL,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ID_REQUIRED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.TENANT_ID_REQUIRED,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REPORT_TARGET_INVALID,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REPLY_TARGET_NOT_FOUND,
  "COMPOSER_VALIDATION",
]);

const STALE_CODES = new Set([
  COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION,
  COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_NOT_FOUND,
  COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_NOT_FOUND,
]);

/**
 * Safe diagnostic event — no body / token / PII.
 * @param {object} [input]
 * @returns {Readonly<object>}
 */
export function createSafeCommunicationDiagnosticEvent(input = {}) {
  return Object.freeze({
    kind: "communication.runtime.diagnostic",
    code: input.code ? String(input.code) : null,
    experienceCode: input.experienceCode
      ? String(input.experienceCode)
      : null,
    correlationId: input.correlationId ? String(input.correlationId) : null,
    operation: input.operation ? String(input.operation) : null,
    scope: input.scope ? String(input.scope) : null,
    conversationId: input.conversationId
      ? String(input.conversationId)
      : null,
    retryable: Boolean(input.retryable),
    at: input.at || new Date().toISOString(),
  });
}

/**
 * @param {unknown} err
 * @param {{ operation?: string, correlationId?: string }} [context]
 * @returns {CommunicationFoundationError}
 */
export function mapToCommunicationExperienceError(err, context = {}) {
  const code = isCommunicationFoundationError(err)
    ? err.code
    : err && typeof err === "object" && "code" in err
      ? String(/** @type {{ code: unknown }} */ (err).code)
      : null;

  let experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.UNKNOWN;
  let userMessage = "Không thể hoàn tất thao tác tin nhắn";
  let retryable = false;

  if (code && NOT_ACTIVATED_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.NOT_ACTIVATED;
    userMessage = COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE;
  } else if (code && UNAUTHORIZED_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.UNAUTHORIZED;
    userMessage = "Bạn cần đăng nhập để dùng tin nhắn";
  } else if (code && FORBIDDEN_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.FORBIDDEN;
    userMessage = "Bạn không có quyền thực hiện thao tác này";
  } else if (code && NETWORK_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.NETWORK_UNAVAILABLE;
    userMessage = "Không kết nối được dịch vụ tin nhắn";
    retryable = true;
  } else if (code && CONFLICT_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.CONFLICT;
    userMessage = "Dữ liệu xung đột — hãy tải lại";
    retryable = true;
  } else if (code && VALIDATION_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.VALIDATION_FAILURE;
    userMessage =
      (err && typeof err === "object" && "message" in err
        ? String(/** @type {{ message: unknown }} */ (err).message)
        : null) || "Nội dung không hợp lệ";
  } else if (code && STALE_CODES.has(code)) {
    experienceCode = COMMUNICATION_EXPERIENCE_ERROR_CODE.STALE_RELOAD_REQUIRED;
    userMessage = "Dữ liệu đã thay đổi — hãy tải lại";
    retryable = true;
  }

  const diagnostic = createSafeCommunicationDiagnosticEvent({
    code,
    experienceCode,
    correlationId: context.correlationId,
    operation: context.operation,
    retryable,
  });

  return new CommunicationFoundationError(experienceCode, userMessage, {
    experienceCode,
    sourceCode: code,
    retryable,
    correlationId: context.correlationId || null,
    operation: context.operation || null,
    diagnostic,
  });
}

/**
 * @param {string} [correlationId]
 * @returns {CommunicationFoundationError}
 */
export function createRuntimeNotActivatedError(correlationId) {
  return new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED,
    COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
    {
      experienceCode: COMMUNICATION_EXPERIENCE_ERROR_CODE.NOT_ACTIVATED,
      correlationId: correlationId || null,
    }
  );
}
