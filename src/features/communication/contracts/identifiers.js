/**
 * Canonical opaque identifiers for Communication Foundation (COMMS-01).
 * Identity / Player / Club ids are referenced, not owned.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireOpaqueId(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_IDENTIFIER,
      `Missing or invalid identifier: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function createConversationId(value) {
  return requireOpaqueId(value, "conversationId");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function createMessageId(value) {
  return requireOpaqueId(value, "messageId");
}

/**
 * Participant id is typically an Identity authUserId (referenced, not owned).
 * @param {unknown} value
 * @returns {string}
 */
export function createParticipantId(value) {
  return requireOpaqueId(value, "participantId");
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string}
 */
export function normalizeIdentifier(value, field = "id") {
  return requireNonEmptyString(value, field);
}
