/**
 * Durable CrmTagAssignmentRepository adapter (Phase 1G).
 * remove() deletes only the assignment row (never the Tag definition).
 */

import {
  createTagAssignment,
  compareTagAssignmentsList,
} from "../../models/tag.js";
import { createTenantVenueScope } from "../../models/scope.js";
import {
  CRM_PHASE_1G_TABLES,
  requireCrmDatabaseClientPort,
} from "../databaseClientPort.js";
import { withPersistenceErrors } from "../errorTranslation.js";
import {
  mapTagAssignmentDomainToRow,
  mapTagAssignmentRowToDomain,
} from "../mapping/tagAssignmentMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CrmDatabaseClientPort }} deps
 */
export function createDurableTagAssignmentRepository(deps = {}) {
  const db = requireCrmDatabaseClientPort(deps.db);

  function resolveScope(scopeInput) {
    return createTenantVenueScope(scopeInput);
  }

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  return {
    async create(scopeInput, assignmentInput) {
      const scope = resolveScope(scopeInput);
      const assignment = createTagAssignment({
        ...assignmentInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return withPersistenceErrors(async () => {
        const existing = await db.select({
          table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
          filters: {
            ...scopeFilters(scope),
            tag_id: assignment.tagId,
            target_type: assignment.targetType,
            target_id: assignment.targetId,
          },
          limit: 1,
        });
        if (existing && existing.length > 0) {
          return mapTagAssignmentRowToDomain(existing[0]);
        }
        const row = mapTagAssignmentDomainToRow(assignment);
        try {
          const inserted = await db.insert({
            table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
            rows: row,
            returning: true,
          });
          return mapTagAssignmentRowToDomain(inserted[0]);
        } catch (err) {
          // Race: unique conflict → re-read and return existing (idempotent)
          if (
            String(err?.code) === "23505" ||
            /duplicate|unique|conflict/i.test(String(err?.message || ""))
          ) {
            const again = await db.select({
              table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
              filters: {
                ...scopeFilters(scope),
                tag_id: assignment.tagId,
                target_type: assignment.targetType,
                target_id: assignment.targetId,
              },
              limit: 1,
            });
            if (again && again.length > 0) {
              return mapTagAssignmentRowToDomain(again[0]);
            }
          }
          throw err;
        }
      });
    },

    async getByTargetAndTag(scopeInput, targetType, targetId, tagId) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
          filters: {
            ...scopeFilters(scope),
            target_type: String(targetType),
            target_id: String(targetId),
            tag_id: String(tagId),
          },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapTagAssignmentRowToDomain(rows[0]);
      });
    },

    async listByTarget(scopeInput, targetType, targetId) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
          filters: {
            ...scopeFilters(scope),
            target_type: String(targetType || ""),
            target_id: String(targetId || ""),
          },
          order: [
            { column: "assigned_at", ascending: true },
            { column: "assignment_id", ascending: true },
          ],
        });
        return (rows || [])
          .map(mapTagAssignmentRowToDomain)
          .sort(compareTagAssignmentsList);
      });
    },

    async listByTag(scopeInput, tagId) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
          filters: {
            ...scopeFilters(scope),
            tag_id: String(tagId || ""),
          },
          order: [
            { column: "assigned_at", ascending: true },
            { column: "assignment_id", ascending: true },
          ],
        });
        return (rows || [])
          .map(mapTagAssignmentRowToDomain)
          .sort(compareTagAssignmentsList);
      });
    },

    async remove(scopeInput, assignmentId) {
      const scope = resolveScope(scopeInput);
      const id = String(assignmentId || "").trim();
      if (!id) return false;
      return withPersistenceErrors(async () => {
        const deleted = await db.delete({
          table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
          filters: { ...scopeFilters(scope), assignment_id: id },
        });
        return Number(deleted) > 0;
      });
    },
  };
}
