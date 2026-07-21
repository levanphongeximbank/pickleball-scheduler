/**
 * Phase 1E — CRM Task + Follow-up application foundation.
 *
 * Consistency model: MODEL 1 — COMMAND RETURNS EVENTS
 * - Each mutating command performs exactly one Task aggregate write.
 * - scheduleFollowUp creates one Task only (no Interaction / Lead / Opportunity mutation).
 * - No Notification, Calendar, email/SMS, or Finance side effects.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_AUDIT_EVENT_TYPE } from "../constants/eventTypes.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import {
  CRM_TASK_PRIORITY,
  isCrmTaskPriority,
} from "../constants/taskPriorities.js";
import {
  CRM_TASK_STATUS,
  isAllowedCrmTaskTransition,
  isCrmTaskTerminalStatus,
} from "../constants/taskStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import { createCrmTask as createCrmTaskModel } from "../models/task.js";
import { createMemoryContactReferenceRepository } from "../repositories/memory/memoryContactReferenceRepository.js";
import { createMemoryInteractionRepository } from "../repositories/memory/memoryInteractionRepository.js";
import { createMemoryLeadRepository } from "../repositories/memory/memoryLeadRepository.js";
import { createMemoryOpportunityRepository } from "../repositories/memory/memoryOpportunityRepository.js";
import { createMemoryTaskRepository } from "../repositories/memory/memoryTaskRepository.js";
import { buildCrmAuditEvent, toCrmFailure } from "./eventEmitHelpers.js";
import {
  resolveAssignableActor,
  resolveCrmRelationshipRefs,
} from "./resolveCrmRelationships.js";

/**
 * @param {object} [dependencies]
 */
export function createTaskApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const taskRepository = dependencies.taskRepository || createMemoryTaskRepository();
  const contactReferenceRepository =
    dependencies.contactReferenceRepository || createMemoryContactReferenceRepository();
  const leadRepository = dependencies.leadRepository || createMemoryLeadRepository();
  const opportunityRepository =
    dependencies.opportunityRepository || createMemoryOpportunityRepository();
  const interactionRepository =
    dependencies.interactionRepository || createMemoryInteractionRepository();
  const identityActorPort = dependencies.identityActorPort || null;

  /** @type {Map<string, string>} scopeKey::idempotencyKey → taskId */
  const idempotencyIndex = new Map();

  function idemKey(scope, key) {
    return `${scope.tenantId}::${scope.venueId}::${key}`;
  }

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  function sideEffectFlags() {
    return {
      notificationCreated: false,
      calendarEventCreated: false,
      financeRecordCreated: false,
      interactionCreated: false,
      leadUpdated: false,
      opportunityUpdated: false,
    };
  }

  async function resolveOptionalAssignee(scope, assignedToActorId) {
    if (!assignedToActorId) return { ok: true, assignedToActorId: null };
    const resolved = await resolveAssignableActor(
      scope,
      assignedToActorId,
      identityActorPort
    );
    if (!resolved.ok) return resolved;
    return { ok: true, assignedToActorId };
  }

  async function buildTaskFromInput(actor, scope, input, { requireFutureDueAt }) {
    const contactRefId =
      input.contactRefId != null && String(input.contactRefId).trim()
        ? String(input.contactRefId).trim()
        : "";
    if (!contactRefId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "contactRefId is required.");
    }

    const title =
      input.title != null && String(input.title).trim()
        ? String(input.title).trim()
        : "";
    if (!title) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "title is required.");
    }

    const priority =
      input.priority != null ? String(input.priority) : CRM_TASK_PRIORITY.NORMAL;
    if (!isCrmTaskPriority(priority)) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_STATUS,
        `Invalid task priority: ${priority}`
      );
    }

    const dueAt = normalizeIsoTimestamp(input.dueAt);
    if (input.dueAt != null && input.dueAt !== "" && !dueAt) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "dueAt must be a valid ISO-8601 timestamp."
      );
    }
    if (requireFutureDueAt) {
      if (!dueAt) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "scheduleFollowUp requires a future dueAt."
        );
      }
      const now = clock.nowIso();
      if (dueAt <= now) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "scheduleFollowUp requires dueAt strictly after CrmClock.nowIso()."
        );
      }
    }

    const leadId =
      input.leadId != null && String(input.leadId).trim()
        ? String(input.leadId).trim()
        : null;
    const opportunityId =
      input.opportunityId != null && String(input.opportunityId).trim()
        ? String(input.opportunityId).trim()
        : null;
    const sourceInteractionId =
      input.sourceInteractionId != null && String(input.sourceInteractionId).trim()
        ? String(input.sourceInteractionId).trim()
        : null;

    const refs = await resolveCrmRelationshipRefs({
      scope,
      contactRefId,
      leadId,
      opportunityId,
      sourceInteractionId,
      contactReferenceRepository,
      leadRepository,
      opportunityRepository,
      interactionRepository,
    });
    if (!refs.ok) return refs;

    const assignedToActorId =
      input.assignedToActorId != null && String(input.assignedToActorId).trim()
        ? String(input.assignedToActorId).trim()
        : input.assigneeUserId != null && String(input.assigneeUserId).trim()
          ? String(input.assigneeUserId).trim()
          : null;
    const assignee = await resolveOptionalAssignee(scope, assignedToActorId);
    if (!assignee.ok) return assignee;

    return {
      ok: true,
      contactRefId,
      leadId,
      opportunityId,
      sourceInteractionId,
      title,
      priority,
      dueAt,
      assignedToActorId: assignee.assignedToActorId,
      description: input.description,
      refs,
    };
  }

  async function createTaskInternal(actor, input, options) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TASK_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const idempotencyKey =
      input.idempotencyKey != null && String(input.idempotencyKey).trim()
        ? String(input.idempotencyKey).trim()
        : null;
    if (idempotencyKey) {
      const priorId = idempotencyIndex.get(idemKey(scope, idempotencyKey));
      if (priorId) {
        const prior = await taskRepository.getById(scope, priorId);
        if (prior) {
          return {
            ok: true,
            task: prior,
            idempotentReplay: true,
            pendingApplicationEvents: Object.freeze([]),
            ...sideEffectFlags(),
          };
        }
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key is reserved but task is missing."
        );
      }
    }

    try {
      const built = await buildTaskFromInput(actor, scope, input, options);
      if (!built.ok) return built;

      const taskId = input.taskId ? String(input.taskId).trim() : ids.nextId("task");
      const existing = await taskRepository.getById(scope, taskId);
      if (existing) {
        return crmFailure(
          CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Task already exists for this id.",
          { taskId }
        );
      }

      const task = createCrmTaskModel({
        taskId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        contactRefId: built.contactRefId,
        leadId: built.leadId,
        opportunityId: built.opportunityId,
        sourceInteractionId: built.sourceInteractionId,
        title: built.title,
        description: built.description,
        status: CRM_TASK_STATUS.OPEN,
        priority: built.priority,
        dueAt: built.dueAt,
        assignedToActorId: built.assignedToActorId,
        createdByActorId: auth.actor.userId,
        createdAt: now,
        updatedAt: now,
      });

      const eventType = options.followUp
        ? CRM_AUDIT_EVENT_TYPE.FOLLOW_UP_SCHEDULED
        : CRM_AUDIT_EVENT_TYPE.TASK_CREATED;

      const audit = buildCrmAuditEvent({
        scope,
        eventType,
        aggregateType: "CrmTask",
        aggregateId: task.taskId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          taskId: task.taskId,
          contactRefId: task.contactRefId,
          leadId: task.leadId,
          opportunityId: task.opportunityId,
          sourceInteractionId: task.sourceInteractionId,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          assignedToActorId: task.assignedToActorId,
          isFollowUp: Boolean(options.followUp),
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await taskRepository.create(scope, task);
      if (idempotencyKey) {
        idempotencyIndex.set(idemKey(scope, idempotencyKey), saved.taskId);
      }

      return {
        ok: true,
        task: saved,
        idempotentReplay: false,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  /**
   * Create a general CRM Task. dueAt is optional.
   */
  async function createTask(actor, input = {}) {
    return createTaskInternal(actor, input, {
      requireFutureDueAt: false,
      followUp: false,
    });
  }

  /**
   * Schedule a follow-up as one Task aggregate. Requires future dueAt.
   * Does not create Interaction / update Lead or Opportunity / notify / calendar.
   */
  async function scheduleFollowUp(actor, input = {}) {
    return createTaskInternal(actor, input, {
      requireFutureDueAt: true,
      followUp: true,
    });
  }

  async function getTask(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TASK_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const taskId =
      input.taskId != null && String(input.taskId).trim()
        ? String(input.taskId).trim()
        : "";
    if (!taskId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "taskId is required.");
    }

    const task = await taskRepository.getById(scope, taskId);
    if (!task) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Task not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.TASK_VIEW, task);
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, task };
  }

  async function listTasks(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TASK_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const filters = { nowIso: now };
    if (input.contactRefId) filters.contactRefId = String(input.contactRefId);
    if (input.leadId) filters.leadId = String(input.leadId);
    if (input.opportunityId) filters.opportunityId = String(input.opportunityId);
    if (input.assignedToActorId || input.assigneeUserId) {
      filters.assignedToActorId = String(input.assignedToActorId || input.assigneeUserId);
    }
    if (input.status) filters.status = String(input.status);
    if (input.priority) filters.priority = String(input.priority);
    if (input.dueFrom) {
      const from = normalizeIsoTimestamp(input.dueFrom);
      if (!from) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "dueFrom must be a valid ISO-8601 timestamp."
        );
      }
      filters.dueFrom = from;
    }
    if (input.dueTo) {
      const to = normalizeIsoTimestamp(input.dueTo);
      if (!to) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_INPUT,
          "dueTo must be a valid ISO-8601 timestamp."
        );
      }
      filters.dueTo = to;
    }
    if (input.overdueOnly) filters.overdueOnly = true;

    const tasks = await taskRepository.list(scope, filters);
    return { ok: true, tasks: Object.freeze([...tasks]) };
  }

  async function assignTask(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TASK_ASSIGN, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const taskId =
      input.taskId != null && String(input.taskId).trim()
        ? String(input.taskId).trim()
        : "";
    if (!taskId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "taskId is required.");
    }

    const assignedToActorId =
      input.assignedToActorId != null && String(input.assignedToActorId).trim()
        ? String(input.assignedToActorId).trim()
        : input.assigneeUserId != null && String(input.assigneeUserId).trim()
          ? String(input.assigneeUserId).trim()
          : "";
    if (!assignedToActorId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "assignedToActorId is required.");
    }

    try {
      const existing = await taskRepository.getById(scope, taskId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Task not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.TASK_ASSIGN,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      if (isCrmTaskTerminalStatus(existing.status)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Cannot assign a terminal task."
        );
      }

      const assignee = await resolveAssignableActor(
        scope,
        assignedToActorId,
        identityActorPort
      );
      if (!assignee.ok) return assignee;

      const previousAssignee = existing.assignedToActorId;
      const updated = createCrmTaskModel({
        ...existing,
        assignedToActorId,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.TASK_ASSIGNED,
        aggregateType: "CrmTask",
        aggregateId: updated.taskId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          taskId: updated.taskId,
          previousAssignedToActorId: previousAssignee,
          assignedToActorId: updated.assignedToActorId,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await taskRepository.update(scope, updated);
      return {
        ok: true,
        task: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function rescheduleTask(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.TASK_UPDATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const taskId =
      input.taskId != null && String(input.taskId).trim()
        ? String(input.taskId).trim()
        : "";
    if (!taskId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "taskId is required.");
    }

    const dueAt = normalizeIsoTimestamp(input.dueAt);
    if (!dueAt) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "dueAt must be a valid ISO-8601 timestamp."
      );
    }

    try {
      const existing = await taskRepository.getById(scope, taskId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Task not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(
        actor,
        CRM_PERMISSIONS.TASK_UPDATE,
        existing
      );
      if (!resourceAuth.ok) return resourceAuth;

      if (isCrmTaskTerminalStatus(existing.status)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Cannot reschedule a terminal task."
        );
      }

      const previousDueAt = existing.dueAt;
      const updated = createCrmTaskModel({
        ...existing,
        dueAt,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.TASK_RESCHEDULED,
        aggregateType: "CrmTask",
        aggregateId: updated.taskId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          taskId: updated.taskId,
          previousDueAt,
          dueAt: updated.dueAt,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await taskRepository.update(scope, updated);
      return {
        ok: true,
        task: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function transitionTask(actor, input, { toStatus, permission, eventType, mutate }) {
    const auth = authorizeCrm(actor, permission, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const taskId =
      input.taskId != null && String(input.taskId).trim()
        ? String(input.taskId).trim()
        : "";
    if (!taskId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "taskId is required.");
    }

    try {
      const existing = await taskRepository.getById(scope, taskId);
      if (!existing) {
        return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Task not found in scope.");
      }

      const resourceAuth = authorizeCrmResource(actor, permission, existing);
      if (!resourceAuth.ok) return resourceAuth;

      if (isCrmTaskTerminalStatus(existing.status)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          "Task is already terminal; reopening is out of Phase 1E scope."
        );
      }

      if (!isAllowedCrmTaskTransition(existing.status, toStatus)) {
        return crmFailure(
          CRM_ERROR_CODES.INVALID_TRANSITION,
          `Transition ${existing.status} → ${toStatus} is not allowed.`
        );
      }

      const patch = mutate(existing, now, input);
      if (patch && patch.ok === false) return patch;

      const updated = createCrmTaskModel({
        ...existing,
        ...(patch || {}),
        status: toStatus,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType,
        aggregateType: "CrmTask",
        aggregateId: updated.taskId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          taskId: updated.taskId,
          previousStatus: existing.status,
          status: updated.status,
          startedAt: updated.startedAt,
          completedAt: updated.completedAt,
          cancelledAt: updated.cancelledAt,
          cancellationReason: updated.cancellationReason,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await taskRepository.update(scope, updated);
      return {
        ok: true,
        task: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
        ...sideEffectFlags(),
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function startTask(actor, input = {}) {
    return transitionTask(actor, input, {
      toStatus: CRM_TASK_STATUS.IN_PROGRESS,
      permission: CRM_PERMISSIONS.TASK_UPDATE,
      eventType: CRM_AUDIT_EVENT_TYPE.TASK_STARTED,
      mutate(existing, now) {
        return {
          startedAt: existing.startedAt || now,
        };
      },
    });
  }

  async function completeTask(actor, input = {}) {
    return transitionTask(actor, input, {
      toStatus: CRM_TASK_STATUS.COMPLETED,
      permission: CRM_PERMISSIONS.TASK_UPDATE,
      eventType: CRM_AUDIT_EVENT_TYPE.TASK_COMPLETED,
      mutate(existing, now) {
        return {
          startedAt: existing.startedAt || now,
          completedAt: now,
        };
      },
    });
  }

  async function cancelTask(actor, input = {}) {
    return transitionTask(actor, input, {
      toStatus: CRM_TASK_STATUS.CANCELLED,
      permission: CRM_PERMISSIONS.TASK_UPDATE,
      eventType: CRM_AUDIT_EVENT_TYPE.TASK_CANCELLED,
      mutate(_existing, now, cmdInput) {
        const reason =
          cmdInput.cancellationReason != null &&
          String(cmdInput.cancellationReason).trim()
            ? String(cmdInput.cancellationReason).trim()
            : "";
        if (!reason) {
          return crmFailure(
            CRM_ERROR_CODES.INVALID_INPUT,
            "cancelTask requires a non-empty cancellationReason."
          );
        }
        return {
          cancelledAt: now,
          cancellationReason: reason,
        };
      },
    });
  }

  return {
    createTask,
    scheduleFollowUp,
    getTask,
    listTasks,
    assignTask,
    rescheduleTask,
    startTask,
    completeTask,
    cancelTask,
  };
}
