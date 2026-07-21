/**
 * Explicit CrmTag ↔ crm_tags row mapping (Phase 1G).
 */

import { createCrmTag, normalizeTagCode } from "../../models/tag.js";
import {
  mapOptionalString,
  normalizeTagName,
  requireMappedScope,
  requireMappedString,
  requireMappedTimestamp,
} from "./mappingHelpers.js";

/**
 * @param {object} tag
 * @returns {object}
 */
export function mapTagDomainToRow(tag) {
  const scope = requireMappedScope(tag);
  const name = requireMappedString(tag.name, "name");
  const code = normalizeTagCode(tag.code || name);
  return {
    tag_id: requireMappedString(tag.tagId, "tagId"),
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    name,
    normalized_name: normalizeTagName(name),
    code,
    normalized_code: code,
    description: mapOptionalString(tag.description),
    active: tag.active === false ? false : true,
    created_at: requireMappedTimestamp(tag.createdAt, "createdAt"),
    updated_at: requireMappedTimestamp(tag.updatedAt ?? tag.createdAt, "updatedAt"),
    created_by_actor_id: mapOptionalString(tag.createdByActorId),
    updated_by_actor_id: mapOptionalString(tag.updatedByActorId),
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapTagRowToDomain(row) {
  if (!row || typeof row !== "object") {
    throw new Error("crm_tags row is required.");
  }
  return createCrmTag({
    tagId: requireMappedString(row.tag_id, "tag_id"),
    tenantId: requireMappedString(row.tenant_id, "tenant_id"),
    venueId: requireMappedString(row.venue_id, "venue_id"),
    name: requireMappedString(row.name, "name"),
    code: requireMappedString(row.normalized_code || row.code, "normalized_code"),
    description: mapOptionalString(row.description),
    active: row.active === false ? false : true,
    createdAt: requireMappedTimestamp(row.created_at, "created_at"),
    updatedAt: requireMappedTimestamp(row.updated_at, "updated_at"),
  });
}
