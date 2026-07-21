/**
 * CRM Identity permission seed definitions (Phase 1H-A).
 *
 * Source of truth for permission *strings* remains CRM_PERMISSIONS.
 * This module defines the Identity SQL seed catalog shape only —
 * idempotent inserts into public.permissions (no role grants here).
 *
 * Role grants live in crmRolePermissionMatrix.js (separately reviewable).
 * Do not invent parallel permission keys.
 */

import { CRM_PERMISSIONS, CRM_PERMISSION_VALUES } from "../constants/permissions.js";

/**
 * @typedef {{
 *   id: string,
 *   module: string,
 *   action: string,
 *   description: string,
 * }} CrmPermissionSeedRow
 */

/**
 * Split dotted CRM permission id into Identity catalog module/action.
 * Example: crm.lead.view → { module: "crm", action: "lead.view" }
 * @param {string} permissionId
 * @returns {{ module: string, action: string }}
 */
export function splitCrmPermissionCatalogParts(permissionId) {
  const id = String(permissionId || "").trim();
  const parts = id.split(".");
  if (parts.length < 3 || parts[0] !== "crm") {
    throw new Error(`Invalid CRM permission id for seed catalog: ${permissionId}`);
  }
  return {
    module: "crm",
    action: parts.slice(1).join("."),
  };
}

/** Human descriptions for Identity catalog (Vietnamese, matching platform seeds). */
const CRM_PERMISSION_DESCRIPTIONS = Object.freeze({
  [CRM_PERMISSIONS.LEAD_VIEW]: "Xem lead CRM",
  [CRM_PERMISSIONS.LEAD_CREATE]: "Tạo lead CRM",
  [CRM_PERMISSIONS.LEAD_UPDATE]: "Cập nhật lead CRM",
  [CRM_PERMISSIONS.LEAD_ASSIGN]: "Gán lead CRM",
  [CRM_PERMISSIONS.OPPORTUNITY_VIEW]: "Xem opportunity CRM",
  [CRM_PERMISSIONS.OPPORTUNITY_CREATE]: "Tạo opportunity CRM",
  [CRM_PERMISSIONS.OPPORTUNITY_UPDATE]: "Cập nhật opportunity CRM",
  [CRM_PERMISSIONS.PIPELINE_MANAGE]: "Quản lý pipeline CRM",
  [CRM_PERMISSIONS.INTERACTION_VIEW]: "Xem tương tác CRM",
  [CRM_PERMISSIONS.INTERACTION_CREATE]: "Tạo tương tác CRM",
  [CRM_PERMISSIONS.TASK_VIEW]: "Xem task CRM",
  [CRM_PERMISSIONS.TASK_CREATE]: "Tạo task CRM",
  [CRM_PERMISSIONS.TASK_UPDATE]: "Cập nhật task CRM",
  [CRM_PERMISSIONS.TASK_ASSIGN]: "Gán task CRM",
  [CRM_PERMISSIONS.TAG_CREATE]: "Tạo thẻ CRM",
  [CRM_PERMISSIONS.TAG_VIEW]: "Xem thẻ CRM",
  [CRM_PERMISSIONS.TAG_UPDATE]: "Cập nhật thẻ CRM",
  [CRM_PERMISSIONS.TAG_ASSIGN]: "Gán thẻ CRM",
  [CRM_PERMISSIONS.CONSENT_CREATE]: "Tạo bản ghi đồng ý CRM",
  [CRM_PERMISSIONS.CONSENT_VIEW]: "Xem đồng ý CRM",
  [CRM_PERMISSIONS.CONSENT_REVOKE]: "Thu hồi đồng ý CRM",
  [CRM_PERMISSIONS.CAMPAIGN_VIEW]: "Xem chiến dịch CRM",
  [CRM_PERMISSIONS.CAMPAIGN_MANAGE]: "Quản lý chiến dịch CRM",
  [CRM_PERMISSIONS.AUDIT_VIEW]: "Xem audit / pending-event CRM",
});

/**
 * Ordered, de-duplicated permission seed rows derived from CRM_PERMISSION_VALUES.
 * @type {ReadonlyArray<CrmPermissionSeedRow>}
 */
export const CRM_PERMISSION_SEED_ROWS = Object.freeze(
  [...new Set(CRM_PERMISSION_VALUES)].sort().map((id) => {
    const { module, action } = splitCrmPermissionCatalogParts(id);
    return Object.freeze({
      id,
      module,
      action,
      description: CRM_PERMISSION_DESCRIPTIONS[id] || `CRM permission ${id}`,
    });
  })
);

/**
 * Permissions required by Phase 1G RLS / RPC (subset of full CRM catalog).
 * @type {ReadonlyArray<string>}
 */
export const CRM_PHASE_1G_REQUIRED_PERMISSIONS = Object.freeze([
  CRM_PERMISSIONS.TAG_CREATE,
  CRM_PERMISSIONS.TAG_VIEW,
  CRM_PERMISSIONS.TAG_UPDATE,
  CRM_PERMISSIONS.TAG_ASSIGN,
  CRM_PERMISSIONS.CONSENT_CREATE,
  CRM_PERMISSIONS.CONSENT_VIEW,
  CRM_PERMISSIONS.CONSENT_REVOKE,
  CRM_PERMISSIONS.AUDIT_VIEW,
]);

export const CRM_PERMISSION_SEED_APPROVAL = Object.freeze({
  phase: "1H-A",
  status: "PROPOSED_AWAITING_OWNER_APPLY_APPROVAL",
  appliesTo: "public.permissions",
  roleGrantsSeparated: true,
  noProductionIds: true,
  noRealUserIds: true,
  noSecrets: true,
});
