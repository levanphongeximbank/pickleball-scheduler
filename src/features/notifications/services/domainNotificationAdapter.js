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
import { getNotificationRepository } from "../repositories/notificationRepository.js";
import {
  DELIVERY_CHANNELS,
  enqueueNotificationDelivery,
} from "./notificationQueueService.js";

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
 * Canonical domain → notification adapter (Phase 1.3).
 * Persists via Notification Repository and enqueues delivery jobs (no live channels).
 *
 * @param {object} input
 */
export async function emitDomainNotificationEvent(input = {}) {
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
      skippedRecipients: resolved.skipped || [],
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

  const repo = input.repository || getNotificationRepository();
  const enqueue =
    input.enqueueDelivery !== false && input.skipQueue !== true;
  const created = [];
  const duplicates = [];

  for (const recipient of resolved.recipients) {
    const recipientKey = buildRecipientIdempotencyKey(
      event.idempotencyKey,
      recipient.userId
    );

    const existing = await repo.findByIdempotencyKey({
      tenantId: event.tenantId,
      idempotencyKey: recipientKey,
    });
    if (existing.notification) {
      duplicates.push(existing.notification);
      continue;
    }

    const draft = createInboxNotificationRecord({
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

    const saved = await repo.create(draft);
    if (!saved.ok) {
      return {
        ok: false,
        outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
        error: saved.error || "Failed to create notification.",
        notifications: [...created, ...duplicates],
        createdCount: created.length,
        duplicateCount: duplicates.length,
        rejectedRecipientIds: resolved.rejected,
      };
    }

    if (saved.duplicate) {
      duplicates.push(saved.notification);
      continue;
    }

    let notification = saved.notification;
    if (enqueue) {
      const jobResult = await enqueueNotificationDelivery({
        notificationId: notification.notificationId || notification.id,
        tenantId: event.tenantId,
        channel: input.deliveryChannel || DELIVERY_CHANNELS.IN_APP,
        repository: repo,
      });
      if (jobResult.ok && !jobResult.duplicate) {
        // Reflect QUEUED status when repository updated the row.
        const listed = await repo.findByIdempotencyKey({
          tenantId: event.tenantId,
          idempotencyKey: recipientKey,
        });
        if (listed.notification) {
          notification = listed.notification;
        }
      }
    }

    created.push(notification);
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
      skippedRecipients: resolved.skipped || [],
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
    skippedRecipients: resolved.skipped || [],
  };
}
