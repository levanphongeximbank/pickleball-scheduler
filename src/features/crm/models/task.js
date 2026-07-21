/**
 * CrmTask foundation model (Phase 1B). Follow-up workflows in 1E+.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { CRM_TASK_STATUS, isCrmTaskStatus } from "../constants/taskStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

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

  const contactRefId =
    input.contactRefId != null && String(input.contactRefId).trim()
      ? String(input.contactRefId).trim()
      : null;
  const leadId =
    input.leadId != null && String(input.leadId).trim() ? String(input.leadId).trim() : null;
  const opportunityId =
    input.opportunityId != null && String(input.opportunityId).trim()
      ? String(input.opportunityId).trim()
      : null;
  const assigneeUserId =
    input.assigneeUserId != null && String(input.assigneeUserId).trim()
      ? String(input.assigneeUserId).trim()
      : null;

  return Object.freeze({
    taskId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId,
    leadId,
    opportunityId,
    assigneeUserId,
    status,
    title: input.title != null ? String(input.title).trim() || null : null,
    dueAt: normalizeIsoTimestamp(input.dueAt),
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
