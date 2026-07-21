/**
 * Interaction domain model (Phase 1B foundation + Phase 1E timeline fields).
 *
 * Append-only in Phase 1E — no edit/delete commands.
 * Does not embed Customer/Player profiles, secrets, or payment data.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import {
  INTERACTION_CHANNEL,
  isInteractionChannel,
} from "../constants/interactionChannels.js";
import {
  INTERACTION_DIRECTION,
  isInteractionDirection,
} from "../constants/interactionDirections.js";
import { isInteractionType, INTERACTION_TYPE } from "../constants/interactionTypes.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/** Maximum summary length (characters). */
export const INTERACTION_SUMMARY_MAX_LENGTH = 2000;

/** Maximum outcome length (characters). */
export const INTERACTION_OUTCOME_MAX_LENGTH = 1000;

function optionalId(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s || null;
}

function requireBoundedText(value, fieldName, maxLength, { allowEmpty = false } = {}) {
  if (value == null) {
    if (allowEmpty) return null;
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, `${fieldName} is required.`);
  }
  const text = String(value).trim();
  if (!text) {
    if (allowEmpty) return null;
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, `${fieldName} must be non-empty.`);
  }
  if (text.length > maxLength) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `${fieldName} must be at most ${maxLength} characters.`
    );
  }
  return text;
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createInteraction(input = {}) {
  const scope = createTenantVenueScope(input);
  const interactionId = requireNonEmptyId(input.interactionId ?? input.id, "interactionId");

  const interactionTypeRaw =
    input.interactionType != null
      ? String(input.interactionType)
      : input.type != null
        ? String(input.type)
        : INTERACTION_TYPE.NOTE;
  if (!isInteractionType(interactionTypeRaw)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      `Invalid interaction type: ${interactionTypeRaw}`
    );
  }

  const directionRaw =
    input.direction != null ? String(input.direction) : INTERACTION_DIRECTION.INTERNAL;
  if (!isInteractionDirection(directionRaw)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      `Invalid interaction direction: ${directionRaw}`
    );
  }

  const channelRaw =
    input.channel != null ? String(input.channel) : INTERACTION_CHANNEL.OTHER;
  if (!isInteractionChannel(channelRaw)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      `Invalid interaction channel: ${channelRaw}`
    );
  }

  const contactRefId = optionalId(input.contactRefId);
  if (!contactRefId) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "contactRefId is required.");
  }

  const summarySource =
    input.summary != null ? input.summary : input.body != null ? input.body : null;
  const summary = requireBoundedText(
    summarySource,
    "summary",
    INTERACTION_SUMMARY_MAX_LENGTH
  );

  const outcome =
    input.outcome != null
      ? requireBoundedText(input.outcome, "outcome", INTERACTION_OUTCOME_MAX_LENGTH, {
          allowEmpty: true,
        })
      : null;

  const recordedByActorId =
    optionalId(input.recordedByActorId) || optionalId(input.actorUserId);

  const occurredAt = normalizeIsoTimestamp(input.occurredAt);
  if (!occurredAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "occurredAt must be a valid ISO-8601 timestamp."
    );
  }

  const createdAt = normalizeIsoTimestamp(input.createdAt) || occurredAt;
  const updatedAt = normalizeIsoTimestamp(input.updatedAt) || createdAt;

  return Object.freeze({
    interactionId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId,
    leadId: optionalId(input.leadId),
    opportunityId: optionalId(input.opportunityId),
    interactionType: interactionTypeRaw,
    /** @deprecated Phase 1B alias — same as interactionType */
    type: interactionTypeRaw,
    direction: directionRaw,
    channel: channelRaw,
    occurredAt,
    summary,
    /** @deprecated Phase 1B alias — same as summary */
    body: summary,
    outcome,
    recordedByActorId,
    /** @deprecated Phase 1B alias — same as recordedByActorId */
    actorUserId: recordedByActorId,
    createdAt,
    updatedAt,
  });
}
