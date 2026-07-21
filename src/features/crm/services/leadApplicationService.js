/**
 * Phase 1C — ContactReference + Lead application foundation.
 *
 * Consistency model: MODEL 1 — COMMAND RETURNS EVENTS
 * - Each mutating command performs exactly one aggregate write.
 * - Validated audit/integration envelopes are returned as pendingApplicationEvents.
 * - Dispatch is deferred to a later adapter/phase.
 * - Event-side-effect ports are not invoked here, so port failure cannot
 *   leave an ambiguous persisted state.
 *
 * createLead requires an existing ContactReference (contactRefId).
 * createContactReference remains a separate command.
 *
 * No localStorage, Supabase, SQL, or browser globals.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import {
  CRM_AUDIT_EVENT_TYPE,
  CRM_INTEGRATION_EVENT_TYPE,
} from "../constants/eventTypes.js";
import { isLeadSource } from "../constants/leadSources.js";
import { isLeadStatus, LEAD_STATUS } from "../constants/leadStatuses.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import { createContactReference } from "../models/contactReference.js";
import { createLead as createLeadModel } from "../models/lead.js";
import { createMemoryContactReferenceRepository } from "../repositories/memory/memoryContactReferenceRepository.js";
import { createMemoryLeadRepository } from "../repositories/memory/memoryLeadRepository.js";
import {
  buildCrmAuditEvent,
  buildCrmIntegrationEvent,
  toCrmFailure,
} from "./eventEmitHelpers.js";
import { resolveExternalContactRefs } from "./resolveContactReferences.js";

/**
 * @param {object} [dependencies]
 */
export function createLeadApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const leadRepository = dependencies.leadRepository || createMemoryLeadRepository();
  const contactReferenceRepository =
    dependencies.contactReferenceRepository || createMemoryContactReferenceRepository();
  const venueCustomerDirectory = dependencies.venueCustomerDirectory || null;
  const playerDirectory = dependencies.playerDirectory || null;
  const identityActorPort = dependencies.identityActorPort || null;

  /** @type {Map<string, string>} scopeKey::idempotencyKey → leadId */
  const idempotencyIndex = new Map();

  function idemKey(scope, key) {
    return `${scope.tenantId}::${scope.venueId}::${key}`;
  }

  /**
   * Create a ContactReference after resolving optional external IDs.
   * One aggregate write. Returns pending audit envelope (not dispatched).
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function createContactReferenceCommand(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    try {
      const resolved = await resolveExternalContactRefs(
        scope,
        input,
        { venueCustomerDirectory, playerDirectory },
        now
      );
      if (!resolved.ok) return resolved;

      const contactRefId = input.contactRefId
        ? String(input.contactRefId).trim()
        : ids.nextId("cref");

      const existing = await contactReferenceRepository.getById(scope, contactRefId);
      if (existing) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "ContactReference already exists for this id.",
          { contactRefId }
        );
      }

      const contactRef = createContactReference({
        contactRefId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        customerId: resolved.customerId,
        playerId: resolved.playerId,
        authUserId: resolved.authUserId,
        displaySnapshot: input.displaySnapshot
          ? { ...input.displaySnapshot, authoritative: false, capturedAt: now }
          : resolved.displaySnapshot,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.CONTACT_REFERENCE_CREATED,
        aggregateType: "ContactReference",
        aggregateId: contactRef.contactRefId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          contactRefId: contactRef.contactRefId,
          customerId: contactRef.customerId,
          playerId: contactRef.playerId,
          authUserId: contactRef.authUserId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await contactReferenceRepository.save(scope, contactRef);

      return {
        ok: true,
        contactReference: saved,
        pendingApplicationEvents: Object.freeze([
          Object.freeze({ kind: "audit", delivery: "pending", event: audit.event }),
        ]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * Create a Lead against an existing ContactReference.
   * One aggregate write. Returns pending audit + integration envelopes.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function createLead(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const source = input.source != null ? String(input.source) : null;
    if (!source || !isLeadSource(source)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid lead source: ${source ?? "(missing)"}`
      );
    }

    const status =
      input.status != null ? String(input.status) : LEAD_STATUS.NEW;
    if (!isLeadStatus(status)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid lead status: ${status}`
      );
    }

    const contactRefId =
      input.contactRefId != null && String(input.contactRefId).trim()
        ? String(input.contactRefId).trim()
        : "";
    if (!contactRefId) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "createLead requires an existing contactRefId. Create ContactReference first."
      );
    }

    const idempotencyKey =
      input.idempotencyKey != null && String(input.idempotencyKey).trim()
        ? String(input.idempotencyKey).trim()
        : null;
    if (idempotencyKey) {
      const priorLeadId = idempotencyIndex.get(idemKey(scope, idempotencyKey));
      if (priorLeadId) {
        const prior = await leadRepository.getById(scope, priorLeadId);
        if (prior) {
          return {
            ok: true,
            lead: prior,
            idempotentReplay: true,
            pendingApplicationEvents: Object.freeze([]),
          };
        }
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key is reserved but lead is missing."
        );
      }
    }

    try {
      const existingRef = await contactReferenceRepository.getById(scope, contactRefId);
      if (!existingRef) {
        return crmFailure(
          CRM_ERROR_CODES.CONTACT_UNRESOLVED,
          "contactRefId does not resolve within the requested scope."
        );
      }

      const leadId = input.leadId ? String(input.leadId).trim() : ids.nextId("lead");
      const existingLead = await leadRepository.getById(scope, leadId);
      if (existingLead) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Lead already exists for this id.",
          { leadId }
        );
      }

      const lead = createLeadModel({
        leadId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        contactRefId,
        status,
        source,
        ownerUserId:
          input.ownerUserId != null && String(input.ownerUserId).trim()
            ? String(input.ownerUserId).trim()
            : auth.actor.userId,
        title: input.title,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.LEAD_CREATED,
        aggregateType: "Lead",
        aggregateId: lead.leadId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          leadId: lead.leadId,
          contactRefId: lead.contactRefId,
          status: lead.status,
          source: lead.source,
          ownerUserId: lead.ownerUserId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const integration = buildCrmIntegrationEvent({
        scope,
        eventType: CRM_INTEGRATION_EVENT_TYPE.LEAD_CREATED,
        aggregateType: "Lead",
        aggregateId: lead.leadId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        idempotencyKey: idempotencyKey || `lead-created:${lead.leadId}`,
        correlationId: audit.event.eventId,
        payload: {
          leadId: lead.leadId,
          contactRefId: lead.contactRefId,
          status: lead.status,
          source: lead.source,
        },
        ids,
      });
      if (!integration.ok) return integration;

      // Single aggregate write after envelopes are validated.
      const saved = await leadRepository.save(scope, lead);

      if (idempotencyKey) {
        idempotencyIndex.set(idemKey(scope, idempotencyKey), saved.leadId);
      }

      return {
        ok: true,
        lead: saved,
        idempotentReplay: false,
        pendingApplicationEvents: Object.freeze([
          Object.freeze({ kind: "audit", delivery: "pending", event: audit.event }),
          Object.freeze({
            kind: "integration",
            delivery: "pending",
            event: integration.event,
          }),
        ]),
        auditEvent: audit.event,
        integrationEvent: integration.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function getLead(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const leadId =
      input.leadId != null && String(input.leadId).trim()
        ? String(input.leadId).trim()
        : "";
    if (!leadId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "leadId is required.");
    }

    const lead = await leadRepository.getById(scope, leadId);
    if (!lead) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Lead not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.LEAD_VIEW, lead);
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, lead };
  }

  /**
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function listLeads(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const filters = {};
    if (input.status) filters.status = String(input.status);
    if (input.ownerUserId) filters.ownerUserId = String(input.ownerUserId);

    const leads = await leadRepository.list(scope, filters);
    for (const lead of leads) {
      if (lead.tenantId !== scope.tenantId || lead.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Repository returned a lead outside the requested scope."
        );
      }
    }

    return { ok: true, leads, scope };
  }

  /**
   * Assign Lead owner. One aggregate write. Returns pending audit envelope.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function assignLead(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_ASSIGN, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const leadId =
      input.leadId != null && String(input.leadId).trim()
        ? String(input.leadId).trim()
        : "";
    const ownerUserId =
      input.ownerUserId != null && String(input.ownerUserId).trim()
        ? String(input.ownerUserId).trim()
        : "";
    if (!leadId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "leadId is required.");
    }
    if (!ownerUserId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "ownerUserId is required.");
    }

    try {
      const existing = await leadRepository.getById(scope, leadId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Lead not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.LEAD_ASSIGN, existing);
      if (!resourceAuth.ok) return resourceAuth;

      if (!identityActorPort?.resolveActor) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "IdentityActorPort.resolveActor is required to assign a lead owner."
        );
      }

      const target = await identityActorPort.resolveActor(scope, ownerUserId);
      if (!target || typeof target !== "object") {
        return crmFailure(
          CRM_ERROR_CODES.NOT_FOUND,
          "Assignment target actor was not found."
        );
      }
      if (target.active === false) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "Assignment target actor is inactive."
        );
      }
      const targetTenant =
        typeof target.tenantId === "string" ? target.tenantId.trim() : "";
      if (!targetTenant || targetTenant !== scope.tenantId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Assignment target belongs to a different tenant."
        );
      }
      const targetVenues = Array.isArray(target.venueIds)
        ? target.venueIds.map(String).filter(Boolean)
        : [];
      if (targetVenues.length > 0 && !targetVenues.includes(scope.venueId)) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Assignment target is not allowed in this venue."
        );
      }

      const previousOwnerUserId = existing.ownerUserId;
      const updated = createLeadModel({
        ...existing,
        ownerUserId,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.LEAD_ASSIGNED,
        aggregateType: "Lead",
        aggregateId: updated.leadId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          leadId: updated.leadId,
          previousOwnerUserId,
          ownerUserId: updated.ownerUserId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await leadRepository.save(scope, updated);

      return {
        ok: true,
        lead: saved,
        pendingApplicationEvents: Object.freeze([
          Object.freeze({ kind: "audit", delivery: "pending", event: audit.event }),
        ]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  return {
    createContactReference: createContactReferenceCommand,
    createLead,
    getLead,
    listLeads,
    assignLead,
  };
}
