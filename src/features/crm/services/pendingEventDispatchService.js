/**
 * Phase 1F — Memory-first pending event dispatch foundation.
 *
 * No background worker. No Notification/Email/SMS/Push delivery.
 * enqueuePendingEvents persists queue records only — no aggregate mutation.
 */

import { authorizeCrm } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_AUDIT_EVENT_TYPE } from "../constants/eventTypes.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import {
  PENDING_EVENT_STATUS,
  isPendingEventTerminalStatus,
} from "../constants/pendingEventStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import { validateCrmAuditEvent } from "../models/events.js";
import { createPendingEventRecord } from "../models/pendingEventRecord.js";
import { createMemoryPendingEventRepository } from "../repositories/memory/memoryPendingEventRepository.js";
import { buildCrmAuditEvent, toCrmFailure } from "./eventEmitHelpers.js";
import { validateSafeEventPayload } from "./validateSafeEventPayload.js";

/**
 * @param {object} [dependencies]
 */
export function createPendingEventDispatchService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const pendingEventRepository =
    dependencies.pendingEventRepository || createMemoryPendingEventRepository();

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  function sideEffectFlags() {
    return {
      notificationCreated: false,
      emailSent: false,
      smsSent: false,
      pushSent: false,
      providerCalled: false,
    };
  }

  /**
   * Accept already validated application events and persist pending queue records.
   */
  async function enqueuePendingEvents(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const events = Array.isArray(input.events) ? input.events : [];
    if (events.length === 0) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "events array is required.");
    }

    try {
      /** @type {object[]} */
      const records = [];
      /** @type {object[]} */
      const sourceEvents = [];

      for (const raw of events) {
        const envelope =
          raw?.event && typeof raw.event === "object" ? raw.event : raw;
        const validated = validateCrmAuditEvent(envelope);
        if (!validated.ok) return validated;

        if (
          validated.event.tenantId !== scope.tenantId ||
          validated.event.venueId !== scope.venueId
        ) {
          return crmFailure(
            CRM_ERROR_CODES.FORBIDDEN_SCOPE,
            "Pending event envelope scope must match command scope."
          );
        }

        const payloadCheck = validateSafeEventPayload(validated.event.payload);
        if (!payloadCheck.ok) return payloadCheck;

        const availableAt = normalizeIsoTimestamp(input.availableAt ?? now);
        if (!availableAt) {
          return crmFailure(
            CRM_ERROR_CODES.INVALID_INPUT,
            "availableAt must be valid when provided."
          );
        }

        records.push(
          createPendingEventRecord({
            pendingEventId: ids.nextId("pevt"),
            tenantId: scope.tenantId,
            venueId: scope.venueId,
            eventId: validated.event.eventId,
            eventType: validated.event.eventType,
            aggregateType: validated.event.aggregateType || "Unknown",
            aggregateId: validated.event.aggregateId || validated.event.eventId,
            payload: payloadCheck.payload,
            status: PENDING_EVENT_STATUS.PENDING,
            availableAt,
            attemptCount: 0,
            createdAt: now,
            updatedAt: now,
          })
        );
        sourceEvents.push(validated.event);
      }

      const saved = await pendingEventRepository.enqueue(scope, records);

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.PENDING_EVENTS_ENQUEUED,
        aggregateType: "PendingEventQueue",
        aggregateId: saved[0]?.pendingEventId || ids.nextId("pevt_batch"),
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          count: saved.length,
          pendingEventIds: saved.map((r) => r.pendingEventId),
          eventTypes: saved.map((r) => r.eventType),
        },
        ids,
      });
      if (!audit.ok) return audit;

      return {
        ok: true,
        pendingEvents: Object.freeze([...saved]),
        enqueuedCount: saved.length,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function listPendingEvents(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const filters = { nowIso: now };
    if (input.status) filters.status = String(input.status);
    if (input.eventType) filters.eventType = String(input.eventType);
    if (input.claimableOnly) filters.claimableOnly = true;

    const events = await pendingEventRepository.list(scope, filters);
    return { ok: true, pendingEvents: Object.freeze([...events]), ...sideEffectFlags() };
  }

  async function claimPendingEvents(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const claimedBy =
      input.claimedBy != null && String(input.claimedBy).trim()
        ? String(input.claimedBy).trim()
        : auth.actor.userId;
    const limit =
      input.limit != null && Number.isInteger(Number(input.limit))
        ? Math.max(0, Number(input.limit))
        : 1;
    const claimTtlMs =
      input.claimTtlMs != null && Number.isInteger(Number(input.claimTtlMs))
        ? Number(input.claimTtlMs)
        : 60_000;

    try {
      const claimed = await pendingEventRepository.claim(scope, {
        nowIso: now,
        claimedBy,
        limit,
        claimTtlMs,
      });

      /** @type {object[]} */
      const pendingEvents = [];
      for (const row of claimed) {
        const audit = buildCrmAuditEvent({
          scope,
          eventType: CRM_AUDIT_EVENT_TYPE.PENDING_EVENT_CLAIMED,
          aggregateType: "PendingEventRecord",
          aggregateId: row.pendingEventId,
          actorUserId: auth.actor.userId,
          occurredAt: now,
          payload: {
            pendingEventId: row.pendingEventId,
            eventId: row.eventId,
            eventType: row.eventType,
            claimedBy: row.claimedBy,
            attemptCount: row.attemptCount,
          },
          ids,
        });
        if (!audit.ok) return audit;
        pendingEvents.push(pendingAudit(audit.event));
      }

      return {
        ok: true,
        claimedEvents: Object.freeze([...claimed]),
        pendingApplicationEvents: Object.freeze(pendingEvents),
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function acknowledgePendingEvent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const pendingEventId =
      input.pendingEventId != null && String(input.pendingEventId).trim()
        ? String(input.pendingEventId).trim()
        : "";
    if (!pendingEventId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "pendingEventId is required.");
    }

    try {
      const existing = await pendingEventRepository.getById(scope, pendingEventId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Pending event not found in scope.");
      }
      if (existing.status !== PENDING_EVENT_STATUS.CLAIMED) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "acknowledgePendingEvent requires CLAIMED status."
        );
      }
      if (isPendingEventTerminalStatus(existing.status)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Terminal pending events cannot transition again."
        );
      }

      const updated = createPendingEventRecord({
        ...existing,
        status: PENDING_EVENT_STATUS.ACKNOWLEDGED,
        acknowledgedAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.PENDING_EVENT_ACKNOWLEDGED,
        aggregateType: "PendingEventRecord",
        aggregateId: updated.pendingEventId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          pendingEventId: updated.pendingEventId,
          eventId: updated.eventId,
          attemptCount: updated.attemptCount,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await pendingEventRepository.update(scope, updated);
      return {
        ok: true,
        pendingEvent: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function failPendingEvent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const pendingEventId =
      input.pendingEventId != null && String(input.pendingEventId).trim()
        ? String(input.pendingEventId).trim()
        : "";
    if (!pendingEventId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "pendingEventId is required.");
    }

    const failureReason =
      input.failureReason != null && String(input.failureReason).trim()
        ? String(input.failureReason).trim()
        : "";
    if (!failureReason) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "failPendingEvent requires a non-empty failureReason."
      );
    }

    try {
      const existing = await pendingEventRepository.getById(scope, pendingEventId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Pending event not found in scope.");
      }
      if (existing.status !== PENDING_EVENT_STATUS.CLAIMED) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "failPendingEvent requires CLAIMED status."
        );
      }

      const updated = createPendingEventRecord({
        ...existing,
        status: PENDING_EVENT_STATUS.FAILED,
        failedAt: now,
        failureReason,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.PENDING_EVENT_FAILED,
        aggregateType: "PendingEventRecord",
        aggregateId: updated.pendingEventId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          pendingEventId: updated.pendingEventId,
          eventId: updated.eventId,
          failureReason: updated.failureReason,
          attemptCount: updated.attemptCount,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await pendingEventRepository.update(scope, updated);
      return {
        ok: true,
        pendingEvent: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function releaseExpiredClaims(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.AUDIT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    try {
      const released = await pendingEventRepository.releaseExpiredClaims(scope, {
        nowIso: now,
      });
      return {
        ok: true,
        releasedEvents: Object.freeze([...released]),
        pendingApplicationEvents: Object.freeze([]),
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  return {
    enqueuePendingEvents,
    listPendingEvents,
    claimPendingEvents,
    acknowledgePendingEvent,
    failPendingEvent,
    releaseExpiredClaims,
  };
}
