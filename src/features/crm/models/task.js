/**
 * CrmTask domain model (Phase 1B foundation + Phase 1E lifecycle fields).
 *
 * Status transitions are enforced by application commands — not by direct
 * status assignment outside those commands.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import {
  CRM_TASK_PRIORITY,
  isCrmTaskPriority,
} from "../constants/taskPriorities.js";
import { CRM_TASK_STATUS, isCrmTaskStatus } from "../constants/taskStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

export const CRM_TASK_TITLE_MAX_LENGTH = 200;
export const CRM_TASK_DESCRIPTION_MAX_LENGTH = 4000;
export const CRM_TASK_CANCELLATION_REASON_MAX_LENGTH = 1000;

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
export function createCrmTask(input = {}) {
  const scope = createTenantVenueScope(input);
  const taskId = requireNonEmptyId(input.taskId ?? input.id, "taskId");

  const status = input.status != null ? String(input.status) : CRM_TASK_STATUS.OPEN;
  if (!isCrmTaskStatus(status)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid task status: ${status}`);
  }

  const priority =
    input.priority != null ? String(input.priority) : CRM_TASK_PRIORITY.NORMAL;
  if (!isCrmTaskPriority(priority)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid task priority: ${priority}`);
  }

  const title = requireBoundedText(input.title, "title", CRM_TASK_TITLE_MAX_LENGTH, {
    allowEmpty: true,
  });

  const description =
    input.description != null
      ? requireBoundedText(
          input.description,
          "description",
          CRM_TASK_DESCRIPTION_MAX_LENGTH,
          { allowEmpty: true }
        )
      : null;

  const cancellationReason =
    input.cancellationReason != null
      ? requireBoundedText(
          input.cancellationReason,
          "cancellationReason",
          CRM_TASK_CANCELLATION_REASON_MAX_LENGTH,
          { allowEmpty: true }
        )
      : null;

  const assignedToActorId =
    optionalId(input.assignedToActorId) || optionalId(input.assigneeUserId);

  const dueAt = normalizeIsoTimestamp(input.dueAt);
  if (input.dueAt != null && input.dueAt !== "" && !dueAt) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "dueAt must be a valid ISO-8601 timestamp.");
  }

  return Object.freeze({
    taskId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId: optionalId(input.contactRefId),
    leadId: optionalId(input.leadId),
    opportunityId: optionalId(input.opportunityId),
    sourceInteractionId: optionalId(input.sourceInteractionId),
    title,
    description,
    status,
    priority,
    dueAt,
    assignedToActorId,
    /** @deprecated Phase 1B alias — same as assignedToActorId */
    assigneeUserId: assignedToActorId,
    createdByActorId: optionalId(input.createdByActorId),
    startedAt: normalizeIsoTimestamp(input.startedAt),
    completedAt: normalizeIsoTimestamp(input.completedAt),
    cancelledAt: normalizeIsoTimestamp(input.cancelledAt),
    cancellationReason,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
