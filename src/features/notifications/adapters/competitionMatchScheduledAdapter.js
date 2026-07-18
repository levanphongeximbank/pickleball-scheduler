/**
 * Boundary adapter: Tournament / Competition schedule output → Notification Module.
 * Does NOT import or modify Competition Engine internals.
 *
 * Safe integration point for MATCH_SCHEDULED pilot.
 */
import {
  emitDomainNotificationEvent,
  DOMAIN_EMIT_OUTCOMES,
} from "../services/domainNotificationAdapter.js";
import { NOTIFICATION_EVENT_TYPES } from "../constants/notificationEvents.js";
import { buildNotificationIdempotencyKey } from "../utils/idempotencyKey.js";

/**
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.matchId
 * @param {string|number} input.scheduleVersion — deterministic version (e.g. scheduledAt ISO or revision)
 * @param {string} [input.competitionId]
 * @param {string} [input.venueId]
 * @param {string} [input.clubId]
 * @param {string} [input.actorUserId]
 * @param {string} [input.matchLabel]
 * @param {string} [input.scheduledAt]
 * @param {string} [input.courtLabel]
 * @param {{ userIds?: string[], roles?: string[], entryIds?: string[] }} [input.recipientHints]
 * @param {import("../recipients/recipientDirectory.js").RecipientDirectory} [input.directory]
 */
export function emitMatchScheduledFromBoundary(input = {}) {
  const {
    tenantId,
    matchId,
    scheduleVersion,
    competitionId = null,
    venueId = null,
    clubId = null,
    actorUserId = null,
    matchLabel = null,
    scheduledAt = null,
    courtLabel = null,
    recipientHints = {},
    directory = null,
  } = input;

  if (!tenantId || !matchId || scheduleVersion === undefined || scheduleVersion === null || scheduleVersion === "") {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: "tenantId, matchId, and scheduleVersion are required.",
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const idempotencyKey = buildNotificationIdempotencyKey({
    tenantId,
    eventType: NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED,
    entityId: String(matchId),
    version: String(scheduleVersion),
  });

  return emitDomainNotificationEvent({
    tenantId,
    eventType: NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED,
    competitionId,
    venueId,
    clubId,
    actorUserId,
    idempotencyKey,
    recipientHints,
    directory,
    sourceEntityType: "match",
    sourceEntityId: String(matchId),
    domainSource: "competition-boundary",
    payload: {
      matchId: String(matchId),
      matchLabel: matchLabel || String(matchId),
      scheduledAt: scheduledAt || null,
      scheduledAtLabel: scheduledAt || null,
      courtLabel: courtLabel || null,
      sourceEntityType: "match",
      sourceEntityId: String(matchId),
    },
  });
}
