/**
 * Phase 1F — CRM Tag + TagAssignment application foundation.
 *
 * Consistency model: MODEL 1 — COMMAND RETURNS EVENTS
 * No Notification delivery. No cross-aggregate silent creates.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_AUDIT_EVENT_TYPE } from "../constants/eventTypes.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { isTagTargetType } from "../constants/tagTargetTypes.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import {
  createCrmTag as createCrmTagModel,
  createTagAssignment as createTagAssignmentModel,
  compareTagsList,
  normalizeTagCode,
} from "../models/tag.js";
import { createMemoryContactReferenceRepository } from "../repositories/memory/memoryContactReferenceRepository.js";
import { createMemoryLeadRepository } from "../repositories/memory/memoryLeadRepository.js";
import { createMemoryOpportunityRepository } from "../repositories/memory/memoryOpportunityRepository.js";
import { createMemoryTagAssignmentRepository } from "../repositories/memory/memoryTagAssignmentRepository.js";
import { createMemoryTagRepository } from "../repositories/memory/memoryTagRepository.js";
import { buildCrmAuditEvent, toCrmFailure } from "./eventEmitHelpers.js";
import { resolveTagTarget } from "./resolveTagTarget.js";

/**
 * @param {object} [dependencies]
 */
export function createTagApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const tagRepository = dependencies.tagRepository || createMemoryTagRepository();
  const tagAssignmentRepository =
    dependencies.tagAssignmentRepository || createMemoryTagAssignmentRepository();
  const contactReferenceRepository =
    dependencies.contactReferenceRepository || createMemoryContactReferenceRepository();
  const leadRepository = dependencies.leadRepository || createMemoryLeadRepository();
  const opportunityRepository =
    dependencies.opportunityRepository || createMemoryOpportunityRepository();

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  async function createTag(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const name =
      input.name != null && String(input.name).trim() ? String(input.name).trim() : "";
    if (!name) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "name is required.");
    }

    const codeInput = input.code != null ? String(input.code).trim() : name;
    const code = normalizeTagCode(codeInput);
    if (!code) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "code is required.");
    }

    try {
      const duplicate = await tagRepository.getByCode(scope, code);
      if (duplicate) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Tag code already exists in this tenant/venue scope.",
          { code }
        );
      }

      const tagId = input.tagId ? String(input.tagId).trim() : ids.nextId("tag");
      const existing = await tagRepository.getById(scope, tagId);
      if (existing) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Tag already exists for this id.",
          { tagId }
        );
      }

      const tag = createCrmTagModel({
        tagId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        name,
        code,
        description: input.description,
        active: input.active !== false,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.TAG_CREATED,
        aggregateType: "CrmTag",
        aggregateId: tag.tagId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          tagId: tag.tagId,
          code: tag.code,
          name: tag.name,
          active: tag.active,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await tagRepository.create(scope, tag);
      return {
        ok: true,
        tag: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function getTag(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const tagId =
      input.tagId != null && String(input.tagId).trim() ? String(input.tagId).trim() : "";
    if (!tagId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "tagId is required.");
    }

    const tag = await tagRepository.getById(scope, tagId);
    if (!tag) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.TAG_VIEW, tag);
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, tag };
  }

  async function listTags(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const filters = {};
    if (input.active === true || input.active === false) filters.active = input.active;
    if (input.code) filters.code = String(input.code);

    const tags = await tagRepository.list(scope, filters);
    return { ok: true, tags: Object.freeze(tags.slice().sort(compareTagsList)) };
  }

  async function setTagActive(actor, input, active) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const tagId =
      input.tagId != null && String(input.tagId).trim() ? String(input.tagId).trim() : "";
    if (!tagId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "tagId is required.");
    }

    try {
      const existing = await tagRepository.getById(scope, tagId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.TAG_UPDATE, existing);
      if (!resourceAuth.ok) return resourceAuth;

      if (existing.active === active) {
        return {
          ok: true,
          tag: existing,
          pendingApplicationEvents: Object.freeze([]),
        };
      }

      const updated = createCrmTagModel({
        ...existing,
        active,
        updatedAt: now,
      });

      const eventType = active
        ? CRM_AUDIT_EVENT_TYPE.TAG_ACTIVATED
        : CRM_AUDIT_EVENT_TYPE.TAG_DEACTIVATED;

      const audit = buildCrmAuditEvent({
        scope,
        eventType,
        aggregateType: "CrmTag",
        aggregateId: updated.tagId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          tagId: updated.tagId,
          code: updated.code,
          active: updated.active,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await tagRepository.update(scope, updated);
      return {
        ok: true,
        tag: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function activateTag(actor, input = {}) {
    return setTagActive(actor, input, true);
  }

  async function deactivateTag(actor, input = {}) {
    return setTagActive(actor, input, false);
  }

  async function assignTag(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_ASSIGN, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const tagId =
      input.tagId != null && String(input.tagId).trim() ? String(input.tagId).trim() : "";
    if (!tagId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "tagId is required.");
    }

    const targetType =
      input.targetType != null && String(input.targetType).trim()
        ? String(input.targetType).trim()
        : "";
    if (!isTagTargetType(targetType)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, `Invalid targetType: ${targetType}`);
    }

    const targetId =
      input.targetId != null && String(input.targetId).trim()
        ? String(input.targetId).trim()
        : "";
    if (!targetId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "targetId is required.");
    }

    try {
      const tag = await tagRepository.getById(scope, tagId);
      if (!tag) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag not found in scope.");
      }
      if (!tag.active) {
        return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "Cannot assign an inactive tag.");
      }

      const tagAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.TAG_ASSIGN, tag);
      if (!tagAuth.ok) return tagAuth;

      const target = await resolveTagTarget({
        scope,
        targetType,
        targetId,
        contactReferenceRepository,
        leadRepository,
        opportunityRepository,
      });
      if (!target.ok) return target;

      const existing = await tagAssignmentRepository.getByTargetAndTag(
        scope,
        targetType,
        targetId,
        tagId
      );
      if (existing) {
        return {
          ok: true,
          assignment: existing,
          idempotentReplay: true,
          pendingApplicationEvents: Object.freeze([]),
        };
      }

      const assignment = createTagAssignmentModel({
        assignmentId: ids.nextId("tag_assign"),
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        tagId,
        targetType,
        targetId,
        assignedByActorId: auth.actor.userId,
        assignedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.TAG_ASSIGNED,
        aggregateType: "TagAssignment",
        aggregateId: assignment.assignmentId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          assignmentId: assignment.assignmentId,
          tagId: assignment.tagId,
          targetType: assignment.targetType,
          targetId: assignment.targetId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await tagAssignmentRepository.create(scope, assignment);
      return {
        ok: true,
        assignment: saved,
        idempotentReplay: false,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function removeTag(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_ASSIGN, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const tagId =
      input.tagId != null && String(input.tagId).trim() ? String(input.tagId).trim() : "";
    const targetType =
      input.targetType != null && String(input.targetType).trim()
        ? String(input.targetType).trim()
        : "";
    const targetId =
      input.targetId != null && String(input.targetId).trim()
        ? String(input.targetId).trim()
        : "";

    if (!tagId || !targetType || !targetId) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "tagId, targetType, and targetId are required."
      );
    }

    try {
      const tag = await tagRepository.getById(scope, tagId);
      if (!tag) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag not found in scope.");
      }

      const assignment = await tagAssignmentRepository.getByTargetAndTag(
        scope,
        targetType,
        targetId,
        tagId
      );
      if (!assignment) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag assignment not found.");
      }

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.TAG_REMOVED,
        aggregateType: "TagAssignment",
        aggregateId: assignment.assignmentId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          assignmentId: assignment.assignmentId,
          tagId: assignment.tagId,
          targetType: assignment.targetType,
          targetId: assignment.targetId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      await tagAssignmentRepository.remove(scope, assignment.assignmentId);

      return {
        ok: true,
        removedAssignmentId: assignment.assignmentId,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function listTagsForTarget(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const targetType =
      input.targetType != null && String(input.targetType).trim()
        ? String(input.targetType).trim()
        : "";
    const targetId =
      input.targetId != null && String(input.targetId).trim()
        ? String(input.targetId).trim()
        : "";
    if (!isTagTargetType(targetType) || !targetId) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "targetType and targetId are required."
      );
    }

    const target = await resolveTagTarget({
      scope,
      targetType,
      targetId,
      contactReferenceRepository,
      leadRepository,
      opportunityRepository,
    });
    if (!target.ok) return target;

    const assignments = await tagAssignmentRepository.listByTarget(
      scope,
      targetType,
      targetId
    );
    const tags = [];
    for (const assignment of assignments) {
      const tag = await tagRepository.getById(scope, assignment.tagId);
      if (tag) tags.push(tag);
    }
    tags.sort(compareTagsList);

    return {
      ok: true,
      assignments: Object.freeze([...assignments]),
      tags: Object.freeze(tags),
    };
  }

  async function listTargetsByTag(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TAG_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const tagId =
      input.tagId != null && String(input.tagId).trim() ? String(input.tagId).trim() : "";
    if (!tagId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "tagId is required.");
    }

    const tag = await tagRepository.getById(scope, tagId);
    if (!tag) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Tag not found in scope.");
    }

    const assignments = await tagAssignmentRepository.listByTag(scope, tagId);
    return {
      ok: true,
      tag,
      assignments: Object.freeze([...assignments]),
    };
  }

  return {
    createTag,
    getTag,
    listTags,
    activateTag,
    deactivateTag,
    assignTag,
    removeTag,
    listTagsForTarget,
    listTargetsByTag,
  };
}
