/**
 * Phase 1D — Pipeline + Opportunity application foundation.
 *
 * Consistency model: MODEL 1 — COMMAND RETURNS EVENTS
 * - Each mutating command performs exactly one aggregate write.
 * - Validated audit/integration envelopes are returned as pendingApplicationEvents.
 * - Dispatch is deferred to a later adapter/phase.
 * - No Lead+Opportunity multi-write; Lead conversion is a later coordinated operation.
 *
 * estimatedValue / amountEstimate are non-authoritative CRM data only.
 * No Finance transactions or revenue recognition.
 *
 * No localStorage, Supabase, SQL, or browser globals.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import {
  CRM_AUDIT_EVENT_TYPE,
  CRM_INTEGRATION_EVENT_TYPE,
} from "../constants/eventTypes.js";
import {
  normalizePipelineCode,
  PIPELINE_STAGE_CATEGORY,
} from "../constants/opportunityStages.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import {
  createOpportunity as createOpportunityModel,
  createPipeline as createPipelineModel,
  findPipelineStage,
  getInitialOpenStage,
  getTerminalStageByCategory,
  isAllowedStageTransition,
} from "../models/opportunity.js";
import { createMemoryLeadRepository } from "../repositories/memory/memoryLeadRepository.js";
import { createMemoryOpportunityRepository } from "../repositories/memory/memoryOpportunityRepository.js";
import { createMemoryPipelineRepository } from "../repositories/memory/memoryPipelineRepository.js";
import {
  buildCrmAuditEvent,
  buildCrmIntegrationEvent,
  toCrmFailure,
} from "./eventEmitHelpers.js";

/**
 * @param {object} [dependencies]
 */
export function createOpportunityApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const opportunityRepository =
    dependencies.opportunityRepository || createMemoryOpportunityRepository();
  const pipelineRepository =
    dependencies.pipelineRepository || createMemoryPipelineRepository();
  const leadRepository = dependencies.leadRepository || createMemoryLeadRepository();
  const identityActorPort = dependencies.identityActorPort || null;

  /** @type {Map<string, string>} scopeKey::idempotencyKey → opportunityId */
  const opportunityIdempotencyIndex = new Map();
  /** @type {Map<string, string>} scopeKey::idempotencyKey → pipelineId */
  const pipelineIdempotencyIndex = new Map();

  function idemKey(scope, key) {
    return `${scope.tenantId}::${scope.venueId}::${key}`;
  }

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  function pendingIntegration(event) {
    return Object.freeze({ kind: "integration", delivery: "pending", event });
  }

  async function resolveAssignableOwner(scope, ownerUserId) {
    if (!identityActorPort?.resolveActor) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "IdentityActorPort.resolveActor is required to assign an opportunity owner."
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
    return { ok: true, target };
  }

  /**
   * Create a Pipeline definition. One aggregate write.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function createPipeline(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.PIPELINE_MANAGE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const idempotencyKey =
      input.idempotencyKey != null && String(input.idempotencyKey).trim()
        ? String(input.idempotencyKey).trim()
        : null;
    if (idempotencyKey) {
      const priorId = pipelineIdempotencyIndex.get(idemKey(scope, idempotencyKey));
      if (priorId) {
        const prior = await pipelineRepository.getById(scope, priorId);
        if (prior) {
          return {
            ok: true,
            pipeline: prior,
            idempotentReplay: true,
            pendingApplicationEvents: Object.freeze([]),
          };
        }
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key is reserved but pipeline is missing."
        );
      }
    }

    try {
      const code = normalizePipelineCode(input.code ?? input.name);
      if (!code) {
        return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "pipeline.code is required.");
      }

      if (typeof pipelineRepository.getByCode === "function") {
        const duplicate = await pipelineRepository.getByCode(scope, code);
        if (duplicate) {
          return crmFailure(
            CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
            "Pipeline code already exists in this tenant/venue scope.",
            { code }
          );
        }
      }

      const pipelineId = input.pipelineId
        ? String(input.pipelineId).trim()
        : ids.nextId("pipe");
      const existing = await pipelineRepository.getById(scope, pipelineId);
      if (existing) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Pipeline already exists for this id.",
          { pipelineId }
        );
      }

      const pipeline = createPipelineModel({
        pipelineId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        name: input.name,
        code,
        stages: input.stages,
        allowedTransitions: input.allowedTransitions,
        active: input.active !== false,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.PIPELINE_CREATED,
        aggregateType: "Pipeline",
        aggregateId: pipeline.pipelineId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          pipelineId: pipeline.pipelineId,
          code: pipeline.code,
          name: pipeline.name,
          stageCodes: pipeline.stages.map((s) => s.code),
          active: pipeline.active,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await pipelineRepository.save(scope, pipeline);

      if (idempotencyKey) {
        pipelineIdempotencyIndex.set(idemKey(scope, idempotencyKey), saved.pipelineId);
      }

      return {
        ok: true,
        pipeline: saved,
        idempotentReplay: false,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * List pipelines in explicit tenant/venue scope.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function listPipelines(actor, input = {}) {
    // Manage permission lists all; opportunity.view may list for create UX.
    let auth = authorizeCrm(actor, CRM_PERMISSIONS.PIPELINE_MANAGE, input);
    const usedViewFallback = !auth.ok;
    if (!auth.ok) {
      auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_VIEW, input);
      if (!auth.ok) return auth;
    }

    const { scope } = auth;
    const filters = {};
    if (input.active != null) {
      filters.active = input.active;
    } else if (usedViewFallback) {
      filters.active = true;
    }
    if (input.code) filters.code = String(input.code);

    const pipelines = await pipelineRepository.list(scope, filters);
    for (const row of pipelines) {
      if (row.tenantId !== scope.tenantId || row.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Repository returned a pipeline outside the requested scope."
        );
      }
    }
    return { ok: true, pipelines, scope };
  }

  /**
   * Create Opportunity from an existing Lead. One Opportunity write only.
   * Does not mark Lead converted (requires later transaction coordinator).
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function createOpportunityFromLead(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const leadId =
      input.leadId != null && String(input.leadId).trim()
        ? String(input.leadId).trim()
        : "";
    if (!leadId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "leadId is required.");
    }

    const pipelineId =
      input.pipelineId != null && String(input.pipelineId).trim()
        ? String(input.pipelineId).trim()
        : "";
    if (!pipelineId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "pipelineId is required.");
    }

    const idempotencyKey =
      input.idempotencyKey != null && String(input.idempotencyKey).trim()
        ? String(input.idempotencyKey).trim()
        : null;
    if (idempotencyKey) {
      const priorId = opportunityIdempotencyIndex.get(idemKey(scope, idempotencyKey));
      if (priorId) {
        const prior = await opportunityRepository.getById(scope, priorId);
        if (prior) {
          return {
            ok: true,
            opportunity: prior,
            idempotentReplay: true,
            pendingApplicationEvents: Object.freeze([]),
          };
        }
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key is reserved but opportunity is missing."
        );
      }
    }

    try {
      const lead = await leadRepository.getById(scope, leadId);
      if (!lead) {
        // Distinguish missing vs cross-scope: attempt not to leak other scopes —
        // scoped getById already isolates; missing means not in this scope.
        return crmFailure(
          CRM_ERROR_CODES.NOT_FOUND,
          "Lead not found in the requested tenant/venue scope."
        );
      }
      if (lead.tenantId !== scope.tenantId || lead.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Lead belongs to a different tenant/venue scope."
        );
      }
      if (!lead.contactRefId) {
        return crmFailure(
          CRM_ERROR_CODES.CONTACT_UNRESOLVED,
          "Lead has no ContactReference; cannot create Opportunity."
        );
      }

      const pipeline = await pipelineRepository.getById(scope, pipelineId);
      if (!pipeline) {
        return crmFailure(
          CRM_ERROR_CODES.NOT_FOUND,
          "Pipeline not found in the requested tenant/venue scope."
        );
      }
      if (pipeline.tenantId !== scope.tenantId || pipeline.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Pipeline belongs to a different tenant/venue scope."
        );
      }
      if (!pipeline.active) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Pipeline is not active."
        );
      }

      const initial = getInitialOpenStage(pipeline);
      if (!initial) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Pipeline has no approved initial open stage."
        );
      }

      if (input.stageCode != null && String(input.stageCode).trim()) {
        const requested = normalizePipelineCode(input.stageCode);
        if (requested !== initial.code) {
          return crmFailure(
            CRM_ERROR_CODES.INVALID_TRANSITION,
            "Opportunity may only start at the Pipeline's approved initial open stage.",
            { requiredStageCode: initial.code, requestedStageCode: requested }
          );
        }
      }

      const opportunityId = input.opportunityId
        ? String(input.opportunityId).trim()
        : ids.nextId("opp");
      const existingOpp = await opportunityRepository.getById(scope, opportunityId);
      if (existingOpp) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Opportunity already exists for this id.",
          { opportunityId }
        );
      }

      const opportunity = createOpportunityModel({
        opportunityId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        pipelineId: pipeline.pipelineId,
        stageCode: initial.code,
        stageCategory: initial.category,
        allowCustomStage: true,
        contactRefId: lead.contactRefId,
        leadId: lead.leadId,
        ownerUserId:
          input.ownerUserId != null && String(input.ownerUserId).trim()
            ? String(input.ownerUserId).trim()
            : lead.ownerUserId || auth.actor.userId,
        title:
          input.title != null
            ? input.title
            : lead.title != null
              ? lead.title
              : null,
        estimatedValue: input.estimatedValue ?? input.amountEstimate,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_CREATED,
        aggregateType: "Opportunity",
        aggregateId: opportunity.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: opportunity.opportunityId,
          leadId: opportunity.leadId,
          contactRefId: opportunity.contactRefId,
          pipelineId: opportunity.pipelineId,
          stageCode: opportunity.stageCode,
          ownerUserId: opportunity.ownerUserId,
          estimatedValue: opportunity.estimatedValue,
          estimatedValueAuthoritative: false,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await opportunityRepository.save(scope, opportunity);

      if (idempotencyKey) {
        opportunityIdempotencyIndex.set(
          idemKey(scope, idempotencyKey),
          saved.opportunityId
        );
      }

      return {
        ok: true,
        opportunity: saved,
        idempotentReplay: false,
        leadConversion: Object.freeze({
          performed: false,
          reason:
            "Lead conversion requires a later coordinated multi-aggregate transaction; Phase 1D writes Opportunity only.",
        }),
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
  async function getOpportunity(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : "";
    if (!opportunityId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "opportunityId is required.");
    }

    const opportunity = await opportunityRepository.getById(scope, opportunityId);
    if (!opportunity) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(
      actor,
      CRM_PERMISSIONS.OPPORTUNITY_VIEW,
      opportunity
    );
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, opportunity };
  }

  /**
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function listOpportunities(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const filters = {};
    if (input.pipelineId) filters.pipelineId = String(input.pipelineId);
    if (input.stageCode) filters.stageCode = normalizePipelineCode(input.stageCode);
    if (input.ownerUserId) filters.ownerUserId = String(input.ownerUserId);
    if (input.stageCategory || input.status) {
      filters.stageCategory = String(input.stageCategory || input.status);
    }
    if (input.leadId) filters.leadId = String(input.leadId);

    const opportunities = await opportunityRepository.list(scope, filters);
    for (const row of opportunities) {
      if (row.tenantId !== scope.tenantId || row.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Repository returned an opportunity outside the requested scope."
        );
      }
    }

    return { ok: true, opportunities, scope };
  }

  /**
   * Assign Opportunity owner. One aggregate write.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function assignOpportunity(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : "";
    const ownerUserId =
      input.ownerUserId != null && String(input.ownerUserId).trim()
        ? String(input.ownerUserId).trim()
        : "";
    if (!opportunityId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "opportunityId is required.");
    }
    if (!ownerUserId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "ownerUserId is required.");
    }

    try {
      const existing = await opportunityRepository.getById(scope, opportunityId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.OPPORTUNITY_UPDATE,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      const targetResult = await resolveAssignableOwner(scope, ownerUserId);
      if (!targetResult.ok) return targetResult;

      const previousOwnerUserId = existing.ownerUserId;
      const updated = createOpportunityModel({
        ...existing,
        ownerUserId,
        allowCustomStage: true,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_ASSIGNED,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          previousOwnerUserId,
          ownerUserId: updated.ownerUserId,
          pipelineId: updated.pipelineId,
          stageCode: updated.stageCode,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await opportunityRepository.save(scope, updated);

      return {
        ok: true,
        opportunity: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * Advance Opportunity to an allowed next open stage. One aggregate write.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function advanceOpportunityStage(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : "";
    const targetStageCode = normalizePipelineCode(input.targetStageCode ?? input.stageCode);
    if (!opportunityId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "opportunityId is required.");
    }
    if (!targetStageCode) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "targetStageCode is required.");
    }

    try {
      const existing = await opportunityRepository.getById(scope, opportunityId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.OPPORTUNITY_UPDATE,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      if (!existing.pipelineId) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Opportunity has no pipelineId."
        );
      }

      const pipeline = await pipelineRepository.getById(scope, existing.pipelineId);
      if (!pipeline) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity pipeline not found in scope.");
      }
      if (pipeline.tenantId !== scope.tenantId || pipeline.venueId !== scope.venueId) {
        return crmFailure(
          CRM_ERROR_CODES.FORBIDDEN_SCOPE,
          "Pipeline belongs to a different tenant/venue scope."
        );
      }

      const currentStage = findPipelineStage(pipeline, existing.stageCode);
      if (!currentStage) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Current opportunity stage does not belong to its Pipeline."
        );
      }
      if (currentStage.isTerminal) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Cannot advance an Opportunity that is already in a terminal stage."
        );
      }

      const targetStage = findPipelineStage(pipeline, targetStageCode);
      if (!targetStage) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Target stage does not belong to the Opportunity Pipeline."
        );
      }

      if (!isAllowedStageTransition(pipeline, existing.stageCode, targetStageCode)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Stage transition is not permitted (skipping, terminal exit, or not in allowedTransitions).",
          {
            from: existing.stageCode,
            to: targetStageCode,
          }
        );
      }

      const previousStageCode = existing.stageCode;
      const updated = createOpportunityModel({
        ...existing,
        stageCode: targetStage.code,
        stageCategory: targetStage.category,
        allowCustomStage: true,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_STAGE_CHANGED,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          previousStageCode,
          stageCode: updated.stageCode,
          stageCategory: updated.stageCategory,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await opportunityRepository.save(scope, updated);

      return {
        ok: true,
        opportunity: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * Close Opportunity as won. One aggregate write. No Finance transaction.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function closeOpportunityWon(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : "";
    if (!opportunityId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "opportunityId is required.");
    }

    try {
      const existing = await opportunityRepository.getById(scope, opportunityId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.OPPORTUNITY_UPDATE,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      const pipeline = await pipelineRepository.getById(scope, existing.pipelineId);
      if (!pipeline) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity pipeline not found in scope.");
      }

      const currentStage = findPipelineStage(pipeline, existing.stageCode);
      if (currentStage?.isTerminal) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Opportunity is already in a terminal stage; reopening is out of Phase 1D scope."
        );
      }

      const wonStage = getTerminalStageByCategory(pipeline, PIPELINE_STAGE_CATEGORY.WON);
      if (!wonStage) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Pipeline has no won terminal stage."
        );
      }

      const previousStageCode = existing.stageCode;
      const updated = createOpportunityModel({
        ...existing,
        stageCode: wonStage.code,
        stageCategory: wonStage.category,
        allowCustomStage: true,
        closedAt: now,
        lossReason: null,
        lossReasonCode: null,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_WON,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          previousStageCode,
          stageCode: updated.stageCode,
          closedAt: updated.closedAt,
          estimatedValue: updated.estimatedValue,
          estimatedValueAuthoritative: false,
          financeTransactionCreated: false,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const stageChanged = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_STAGE_CHANGED,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          previousStageCode,
          stageCode: updated.stageCode,
          stageCategory: updated.stageCategory,
          closeReason: "won",
        },
        ids,
      });
      if (!stageChanged.ok) return stageChanged;

      const integration = buildCrmIntegrationEvent({
        scope,
        eventType: CRM_INTEGRATION_EVENT_TYPE.OPPORTUNITY_WON,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        idempotencyKey: `opportunity-won:${updated.opportunityId}`,
        correlationId: audit.event.eventId,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          stageCode: updated.stageCode,
          estimatedValue: updated.estimatedValue,
          estimatedValueAuthoritative: false,
          financeTransactionCreated: false,
        },
        ids,
      });
      if (!integration.ok) return integration;

      const saved = await opportunityRepository.save(scope, updated);

      return {
        ok: true,
        opportunity: saved,
        financeTransactionCreated: false,
        pendingApplicationEvents: Object.freeze([
          pendingAudit(audit.event),
          pendingAudit(stageChanged.event),
          pendingIntegration(integration.event),
        ]),
        auditEvent: audit.event,
        integrationEvent: integration.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * Close Opportunity as lost. Requires loss reason. One aggregate write.
   *
   * @param {object|null|undefined} actor
   * @param {object} input
   */
  async function closeOpportunityLost(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.OPPORTUNITY_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : "";
    if (!opportunityId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "opportunityId is required.");
    }

    const lossReason =
      input.lossReason != null && String(input.lossReason).trim()
        ? String(input.lossReason).trim()
        : "";
    const lossReasonCode =
      input.lossReasonCode != null && String(input.lossReasonCode).trim()
        ? String(input.lossReasonCode).trim()
        : "";
    if (!lossReason && !lossReasonCode) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "closeOpportunityLost requires a non-empty lossReason or lossReasonCode."
      );
    }

    try {
      const existing = await opportunityRepository.getById(scope, opportunityId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.OPPORTUNITY_UPDATE,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      const pipeline = await pipelineRepository.getById(scope, existing.pipelineId);
      if (!pipeline) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Opportunity pipeline not found in scope.");
      }

      const currentStage = findPipelineStage(pipeline, existing.stageCode);
      if (currentStage?.isTerminal) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Opportunity is already in a terminal stage; reopening is out of Phase 1D scope."
        );
      }

      const lostStage = getTerminalStageByCategory(pipeline, PIPELINE_STAGE_CATEGORY.LOST);
      if (!lostStage) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_STATUS,
          "Pipeline has no lost terminal stage."
        );
      }

      const previousStageCode = existing.stageCode;
      const updated = createOpportunityModel({
        ...existing,
        stageCode: lostStage.code,
        stageCategory: lostStage.category,
        allowCustomStage: true,
        closedAt: now,
        lossReason: lossReason || lossReasonCode,
        lossReasonCode: lossReasonCode ? normalizePipelineCode(lossReasonCode) || lossReasonCode : null,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_LOST,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          previousStageCode,
          stageCode: updated.stageCode,
          closedAt: updated.closedAt,
          lossReason: updated.lossReason,
          lossReasonCode: updated.lossReasonCode,
          financeTransactionCreated: false,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const stageChanged = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_STAGE_CHANGED,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          previousStageCode,
          stageCode: updated.stageCode,
          stageCategory: updated.stageCategory,
          closeReason: "lost",
        },
        ids,
      });
      if (!stageChanged.ok) return stageChanged;

      const integration = buildCrmIntegrationEvent({
        scope,
        eventType: CRM_INTEGRATION_EVENT_TYPE.OPPORTUNITY_LOST,
        aggregateType: "Opportunity",
        aggregateId: updated.opportunityId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        idempotencyKey: `opportunity-lost:${updated.opportunityId}`,
        correlationId: audit.event.eventId,
        payload: {
          opportunityId: updated.opportunityId,
          pipelineId: updated.pipelineId,
          stageCode: updated.stageCode,
          lossReason: updated.lossReason,
          lossReasonCode: updated.lossReasonCode,
          financeTransactionCreated: false,
        },
        ids,
      });
      if (!integration.ok) return integration;

      const saved = await opportunityRepository.save(scope, updated);

      return {
        ok: true,
        opportunity: saved,
        financeTransactionCreated: false,
        pendingApplicationEvents: Object.freeze([
          pendingAudit(audit.event),
          pendingAudit(stageChanged.event),
          pendingIntegration(integration.event),
        ]),
        auditEvent: audit.event,
        integrationEvent: integration.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  return {
    createPipeline,
    listPipelines,
    createOpportunityFromLead,
    getOpportunity,
    listOpportunities,
    assignOpportunity,
    advanceOpportunityStage,
    closeOpportunityWon,
    closeOpportunityLost,
  };
}
