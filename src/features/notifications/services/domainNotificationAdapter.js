import { validateNotificationEventEnvelope } from "../contracts/notificationEventEnvelope.js";
import { getEventClassification } from "../constants/eventClassification.js";
import {
  isValidNotificationPriority,
  NOTIFICATION_PRIORITIES,
} from "../constants/notificationPriorities.js";
import { isValidNotificationCategory } from "../constants/notificationCategories.js";
import { resolveNotificationRecipients } from "../recipients/resolveRecipients.js";
import { renderNotificationContent } from "./notificationPresentation.js";
import { createInboxNotificationRecord } from "../models/inboxNotification.js";
import { buildRecipientIdempotencyKey } from "../utils/idempotencyKey.js";
import {
  loadIdempotencyIndex,
  loadInboxRecords,
  makeIdempotencyIndexKey,
  saveIdempotencyIndex,
  saveInboxRecords,
} from "../storage/notificationInboxStorage.js";

export const DOMAIN_EMIT_OUTCOMES = Object.freeze({
  CREATED: "created",
  DUPLICATE: "duplicate",
  SKIPPED: "skipped",
  FAILED: "failed",
});

function resolveClassification(eventType, { priority, category } = {}) {
  const defaults = getEventClassification(eventType);
  if (!defaults) {
    return {
      ok: false,
      error: `Unknown eventType for classification: ${eventType}`,
    };
  }

  let resolvedPriority = defaults.priority;
  if (priority !== undefined && priority !== null && priority !== "") {
    if (!isValidNotificationPriority(priority)) {
      return { ok: false, error: `Invalid priority: ${priority}` };
    }
    resolvedPriority = priority;
  }

  let resolvedCategory = defaults.category;
  if (category !== undefined && category !== null && category !== "") {
    if (!isValidNotificationCategory(category)) {
      return { ok: false, error: `Invalid category: ${category}` };
    }
    if (category !== defaults.category) {
      return {
        ok: false,
        error: `Category override ${category} does not match catalogue default ${defaults.category} for ${eventType}.`,
      };
    }
    resolvedCategory = category;
  }

  return {
    ok: true,
    category: resolvedCategory,
    priority: resolvedPriority || NOTIFICATION_PRIORITIES.NORMAL,
  };
}

/**
 * Canonical domain → notification adapter (Phase 1.2).
 * Domain modules should call this instead of providers/storage.
 *
 * @param {object} input — envelope fields + optional priority/category/source metadata
 * @returns {{
 *   ok: boolean,
 *   outcome: 'created'|'duplicate'|'skipped'|'failed',
 *   code?: string,
 *   error?: string,
 *   event?: object,
 *   notifications?: object[],
 *   createdCount?: number,
 *   duplicateCount?: number,
 *   rejectedRecipientIds?: string[],
 * }}
 */
export function emitDomainNotificationEvent(input = {}) {
  const validated = validateNotificationEventEnvelope(input);
  if (!validated.ok) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      code: validated.code,
      error: validated.error,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const event = validated.event;
  const classification = resolveClassification(event.eventType, {
    priority: input.priority,
    category: input.category,
  });
  if (!classification.ok) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: classification.error,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const content = renderNotificationContent(event.eventType, event.payload);
  if (!content.ok) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: content.error,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const resolved = resolveNotificationRecipients({
    tenantId: event.tenantId,
    venueId: event.venueId,
    clubId: event.clubId,
    competitionId: event.competitionId,
    recipientHints: event.recipientHints,
    directory: input.directory || null,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: resolved.error,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  if (resolved.recipients.length === 0) {
    return {
      ok: true,
      outcome: DOMAIN_EMIT_OUTCOMES.SKIPPED,
      event,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
      rejectedRecipientIds: resolved.rejected,
      error: "No valid recipients after resolution.",
    };
  }

  const sourceEntityType =
    input.sourceEntityType || event.payload?.sourceEntityType || null;
  const sourceEntityId =
    input.sourceEntityId || event.payload?.sourceEntityId || null;
  const metadata = {
    ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
    domainSource: input.domainSource || null,
  };

  const index = loadIdempotencyIndex();
  const records = loadInboxRecords();
  const created = [];
  const duplicates = [];

  for (const recipient of resolved.recipients) {
    const recipientKey = buildRecipientIdempotencyKey(
      event.idempotencyKey,
      recipient.userId
    );
    const indexKey = makeIdempotencyIndexKey(event.tenantId, recipientKey);
    const existingId = index[indexKey];

    if (existingId) {
      const existing =
        records.find(
          (r) => (r.notificationId || r.id) === existingId
        ) || null;
      if (existing) {
        duplicates.push(existing);
        continue;
      }
    }

    const notification = createInboxNotificationRecord({
      event,
      recipientUserId: recipient.userId,
      category: classification.category,
      priority: classification.priority,
      title: content.title,
      message: content.message,
      sourceEntityType,
      sourceEntityId,
      metadata,
      idempotencyKey: recipientKey,
    });

    records.unshift(notification);
    index[indexKey] = notification.notificationId;
    created.push(notification);
  }

  if (created.length > 0) {
    saveInboxRecords(records);
    saveIdempotencyIndex(index);
  }

  if (created.length === 0 && duplicates.length > 0) {
    return {
      ok: true,
      outcome: DOMAIN_EMIT_OUTCOMES.DUPLICATE,
      event,
      notifications: duplicates,
      createdCount: 0,
      duplicateCount: duplicates.length,
      rejectedRecipientIds: resolved.rejected,
    };
  }

  return {
    ok: true,
    outcome:
      created.length > 0
        ? DOMAIN_EMIT_OUTCOMES.CREATED
        : DOMAIN_EMIT_OUTCOMES.SKIPPED,
    event,
    notifications: [...created, ...duplicates],
    createdCount: created.length,
    duplicateCount: duplicates.length,
    rejectedRecipientIds: resolved.rejected,
  };
}
