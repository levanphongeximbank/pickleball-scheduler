/**
 * Durable CrmTagRepository adapter (Phase 1G).
 * Implements Phase 1F contract via injectable CrmDatabaseClientPort.
 */

import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import { createCrmTag, compareTagsList, normalizeTagCode } from "../../models/tag.js";
import { createTenantVenueScope } from "../../models/scope.js";
import {
  CRM_PHASE_1G_TABLES,
  requireCrmDatabaseClientPort,
} from "../databaseClientPort.js";
import { withPersistenceErrors } from "../errorTranslation.js";
import { mapTagDomainToRow, mapTagRowToDomain } from "../mapping/tagMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CrmDatabaseClientPort }} deps
 */
export function createDurableTagRepository(deps = {}) {
  const db = requireCrmDatabaseClientPort(deps.db);

  function resolveScope(scopeInput) {
    return createTenantVenueScope(scopeInput);
  }

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  return {
    async create(scopeInput, tagInput) {
      const scope = resolveScope(scopeInput);
      const tag = createCrmTag({
        ...tagInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      const row = mapTagDomainToRow(tag);
      return withPersistenceErrors(
        async () => {
          const inserted = await db.insert({
            table: CRM_PHASE_1G_TABLES.TAGS,
            rows: row,
            returning: true,
          });
          const first = Array.isArray(inserted) ? inserted[0] : inserted;
          return mapTagRowToDomain(first);
        },
        { conflictMessage: `Duplicate tag code in scope: ${tag.code}` }
      );
    },

    async getById(scopeInput, tagId) {
      const scope = resolveScope(scopeInput);
      const id = String(tagId || "").trim();
      if (!id) return null;
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAGS,
          filters: { ...scopeFilters(scope), tag_id: id },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapTagRowToDomain(rows[0]);
      });
    },

    async getByCode(scopeInput, codeInput) {
      const scope = resolveScope(scopeInput);
      const code = normalizeTagCode(codeInput);
      if (!code) return null;
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAGS,
          filters: { ...scopeFilters(scope), normalized_code: code },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapTagRowToDomain(rows[0]);
      });
    },

    async list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const queryFilters = { ...scopeFilters(scope) };
        if (filters.active === true) queryFilters.active = true;
        if (filters.active === false) queryFilters.active = false;
        if (filters.code) queryFilters.normalized_code = normalizeTagCode(filters.code);

        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.TAGS,
          filters: queryFilters,
          order: [
            { column: "normalized_name", ascending: true },
            { column: "tag_id", ascending: true },
          ],
        });
        return (rows || []).map(mapTagRowToDomain).sort(compareTagsList);
      });
    },

    async update(scopeInput, tagInput) {
      const scope = resolveScope(scopeInput);
      const tagId = String(tagInput?.tagId || "").trim();
      if (!tagId) {
        throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "tagId is required for update.");
      }
      return withPersistenceErrors(
        async () => {
          const existingRows = await db.select({
            table: CRM_PHASE_1G_TABLES.TAGS,
            filters: { ...scopeFilters(scope), tag_id: tagId },
            limit: 1,
          });
          if (!existingRows || existingRows.length === 0) {
            const notFound = new Error(`Tag not found for update: ${tagId}`);
            notFound.name = "CrmNotFound";
            throw notFound;
          }
          const existing = mapTagRowToDomain(existingRows[0]);
          const tag = createCrmTag({
            ...existing,
            ...tagInput,
            tagId: existing.tagId,
            tenantId: scope.tenantId,
            venueId: scope.venueId,
          });
          const row = mapTagDomainToRow(tag);
          const updated = await db.update({
            table: CRM_PHASE_1G_TABLES.TAGS,
            values: row,
            filters: { ...scopeFilters(scope), tag_id: tagId },
            returning: true,
          });
          if (!updated || updated.length === 0) {
            const notFound = new Error(`Tag not found for update: ${tagId}`);
            notFound.name = "CrmNotFound";
            throw notFound;
          }
          return mapTagRowToDomain(updated[0]);
        },
        {
          conflictMessage: `Duplicate tag code in scope: ${tagInput?.code || ""}`,
          notFoundMessage: `Tag not found for update: ${tagId}`,
        }
      );
    },
  };
}
