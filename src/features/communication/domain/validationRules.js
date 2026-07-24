/**
 * Validation helpers for secondary contracts (pure, deterministic).
 * Re-exports contract factories as domain validation entry points.
 */

import { createAttachmentReferenceContract } from "../contracts/attachmentRef.js";
import { createReactionContract } from "../contracts/reaction.js";
import { createUserBlockContract } from "../contracts/userBlock.js";
import { createMessageReportContract } from "../contracts/messageReport.js";
import { createModerationActionContract } from "../contracts/moderationAction.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateAttachmentReference(input) {
  return createAttachmentReferenceContract(input);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateReaction(input) {
  return createReactionContract(input);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateUserBlock(input) {
  return createUserBlockContract(input);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateMessageReport(input) {
  return createMessageReportContract(input);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateModerationAction(input) {
  return createModerationActionContract(input);
}
