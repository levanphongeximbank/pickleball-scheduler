/**
 * Phase 1E — Interaction timeline application foundation.
 *
 * Consistency model: MODEL 1 — COMMAND RETURNS EVENTS
 * - Append-only Interaction create (one aggregate write).
 * - Validated pending audit envelopes returned; not dispatched.
 * - No edit/delete Interaction commands in Phase 1E.
 * - No Lead/Opportunity mutation, Notification, Calendar, or Finance side effects.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_AUDIT_EVENT_TYPE } from "../constants/eventTypes.js";
import { isInteractionChannel } from "../constants/interactionChannels.js";
import { isInteractionDirection } from "../constants/interactionDirections.js";
import { isInteractionType } from "../constants/interactionTypes.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import { createInteraction as createInteractionModel } from "../models/interaction.js";
import { createMemoryContactReferenceRepository } from "../repositories/memory/memoryContactReferenceRepository.js";
import { createMemoryInteractionRepository } from "../repositories/memory/memoryInteractionRepository.js";
import { createMemoryLeadRepository } from "../repositories/memory/memoryLeadRepository.js";
import { createMemoryOpportunityRepository } from "../repositories/memory/memoryOpportunityRepository.js";
import { buildCrmAuditEvent, toCrmFailure } from "./eventEmitHelpers.js";
import { resolveCrmRelationshipRefs } from "./resolveCrmRelationships.js";

/**
 * @param {object} [dependencies]
 */
export function createInteractionApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const interactionRepository =
    dependencies.interactionRepository || createMemoryInteractionRepository();
  const contactReferenceRepository =
    dependencies.contactReferenceRepository || createMemoryContactReferenceRepository();
  const leadRepository = dependencies.leadRepository || createMemoryLeadRepository();
  const opportunityRepository =
    dependencies.opportunityRepository || createMemoryOpportunityRepository();

  /** @type {Map<string, string>} scopeKey::idempotencyKey → interactionId */
  const idempotencyIndex = new Map();

  function idemKey(scope, key) {
    return `${scope.tenantId}::${scope.venueId}::${key}`;
  }

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  /**
   * Record an immutable Interaction (append-only). One aggregate write.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function recordInteraction(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.INTERACTION_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const contactRefId =
      input.contactRefId != null && String(input.contactRefId).trim()
        ? String(input.contactRefId).trim()
        : "";
    if (!contactRefId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "contactRefId is required.");
    }

    const interactionType =
      input.interactionType != null
        ? String(input.interactionType)
        : input.type != null
          ? String(input.type)
          : "";
    if (!interactionType || !isInteractionType(interactionType)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid interaction type: ${interactionType || "(missing)"}`
      );
    }

    const direction = input.direction != null ? String(input.direction) : "";
    if (!direction || !isInteractionDirection(direction)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid interaction direction: ${direction || "(missing)"}`
      );
    }

    const channel = input.channel != null ? String(input.channel) : "";
    if (!channel || !isInteractionChannel(channel)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid interaction channel: ${channel || "(missing)"}`
      );
    }

    const occurredAt = normalizeIsoTimestamp(input.occurredAt ?? now);
    if (!occurredAt) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "occurredAt must be a valid ISO-8601 timestamp."
      );
    }

    const leadId =
      input.leadId != null && String(input.leadId).trim()
        ? String(input.leadId).trim()
        : null;
    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : null;

    const idempotencyKey =
      input.idempotencyKey != null && String(input.idempotencyKey).trim()
        ? String(input.idempotencyKey).trim()
        : null;
    if (idempotencyKey) {
      const priorId = idempotencyIndex.get(idemKey(scope, idempotencyKey));
      if (priorId) {
        const prior = await interactionRepository.getById(scope, priorId);
        if (prior) {
          return {
            ok: true,
            interaction: prior,
            idempotentReplay: true,
            pendingApplicationEvents: Object.freeze([]),
          };
        }
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key is reserved but interaction is missing."
        );
      }
    }

    try {
      const refs = await resolveCrmRelationshipRefs({
        scope,
        contactRefId,
        leadId,
        opportunityId,
        contactReferenceRepository,
        leadRepository,
        opportunityRepository,
      });
      if (!refs.ok) return refs;

      const interactionId = input.interactionId
        ? String(input.interactionId).trim()
        : ids.nextId("ixn");
      const existing = await interactionRepository.getById(scope, interactionId);
      if (existing) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Interaction already exists for this id.",
          { interactionId }
        );
      }

      const interaction = createInteractionModel({
        interactionId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        contactRefId,
        leadId,
        opportunityId,
        interactionType,
        direction,
        channel,
        occurredAt,
        summary: input.summary != null ? input.summary : input.body,
        outcome: input.outcome,
        recordedByActorId: auth.actor.userId,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.INTERACTION_RECORDED,
        aggregateType: "Interaction",
        aggregateId: interaction.interactionId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          interactionId: interaction.interactionId,
          contactRefId: interaction.contactRefId,
          leadId: interaction.leadId,
          opportunityId: interaction.opportunityId,
          interactionType: interaction.interactionType,
          direction: interaction.direction,
          channel: interaction.channel,
          occurredAt: interaction.occurredAt,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await interactionRepository.create(scope, interaction);
      if (idempotencyKey) {
        idempotencyIndex.set(idemKey(scope, idempotencyKey), saved.interactionId);
      }

      return {
        ok: true,
        interaction: saved,
        idempotentReplay: false,
        notificationCreated: false,
        calendarEventCreated: false,
        financeRecordCreated: false,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function getInteraction(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.INTERACTION_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const interactionId =
      input.interactionId != null && String(input.interactionId).trim()
        ? String(input.interactionId).trim()
        : "";
    if (!interactionId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "interactionId is required.");
    }

    const interaction = await interactionRepository.getById(scope, interactionId);
    if (!interaction) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Interaction not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(
      actor,
      CRM_PERMISSIONS.INTERACTION_VIEW,
      interaction
    );
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, interaction };
  }

  /**
   * Deterministic timeline listing with filters.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function listInteractions(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.INTERACTION_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const filters = {};
    if (input.contactRefId) filters.contactRefId = String(input.contactRefId);
    if (input.leadId) filters.leadId = String(input.leadId);
    if (input.opportunityId) filters.opportunityId = String(input.opportunityId);
    if (input.interactionType || input.type) {
      filters.interactionType = String(input.interactionType || input.type);
    }
    if (input.direction) filters.direction = String(input.direction);
    if (input.channel) filters.channel = String(input.channel);
    if (input.occurredFrom) {
      const from = normalizeIsoTimestamp(input.occurredFrom);
      if (!from) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "occurredFrom must be a valid ISO-8601 timestamp."
        );
      }
      filters.occurredFrom = from;
    }
    if (input.occurredTo) {
      const to = normalizeIsoTimestamp(input.occurredTo);
      if (!to) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "occurredTo must be a valid ISO-8601 timestamp."
        );
      }
      filters.occurredTo = to;
    }

    const interactions = await interactionRepository.list(scope, filters);
    return { ok: true, interactions: Object.freeze([...interactions]) };
  }

  return {
    recordInteraction,
    getInteraction,
    listInteractions,
  };
}
