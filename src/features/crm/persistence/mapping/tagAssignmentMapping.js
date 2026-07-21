/**
 * Explicit TagAssignment ↔ crm_tag_assignments row mapping (Phase 1G).
 */

import { createTagAssignment } from "../../models/tag.js";
import {
  requireMappedScope,
  requireMappedString,
  requireMappedTimestamp,
} from "./mappingHelpers.js";

/**
 * @param {object} assignment
 * @returns {object}
 */
export function mapTagAssignmentDomainToRow(assignment) {
  const scope = requireMappedScope(assignment);
  return {
    assignment_id: requireMappedString(assignment.assignmentId, "assignmentId"),
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    tag_id: requireMappedString(assignment.tagId, "tagId"),
    target_type: requireMappedString(assignment.targetType, "targetType"),
    target_id: requireMappedString(assignment.targetId, "targetId"),
    assigned_by_actor_id: requireMappedString(
      assignment.assignedByActorId,
      "assignedByActorId"
    ),
    assigned_at: requireMappedTimestamp(assignment.assignedAt, "assignedAt"),
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapTagAssignmentRowToDomain(row) {
  if (!row || typeof row !== "object") {
    throw new Error("crm_tag_assignments row is required.");
  }
  return createTagAssignment({
    assignmentId: requireMappedString(row.assignment_id, "assignment_id"),
    tenantId: requireMappedString(row.tenant_id, "tenant_id"),
    venueId: requireMappedString(row.venue_id, "venue_id"),
    tagId: requireMappedString(row.tag_id, "tag_id"),
    targetType: requireMappedString(row.target_type, "target_type"),
    targetId: requireMappedString(row.target_id, "target_id"),
    assignedByActorId: requireMappedString(
      row.assigned_by_actor_id,
      "assigned_by_actor_id"
    ),
    assignedAt: requireMappedTimestamp(row.assigned_at, "assigned_at"),
  });
}
