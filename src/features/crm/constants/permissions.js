/**
 * CRM permission namespace (Phase 1B proposal).
 *
 * Naming follows repository convention: dotted resource.action (e.g. customer.view).
 * NOT wired into Identity SQL / Production RBAC in Phase 1B.
 * Do NOT use customer.view as the canonical permission for CRM mutations.
 */

export const CRM_PERMISSIONS = Object.freeze({
  LEAD_VIEW: "crm.lead.view",
  LEAD_CREATE: "crm.lead.create",
  LEAD_UPDATE: "crm.lead.update",
  LEAD_ASSIGN: "crm.lead.assign",
  OPPORTUNITY_VIEW: "crm.opportunity.view",
  OPPORTUNITY_CREATE: "crm.opportunity.create",
  OPPORTUNITY_UPDATE: "crm.opportunity.update",
  PIPELINE_MANAGE: "crm.pipeline.manage",
  INTERACTION_VIEW: "crm.interaction.view",
  INTERACTION_CREATE: "crm.interaction.create",
  TASK_VIEW: "crm.task.view",
  TASK_CREATE: "crm.task.create",
  TASK_UPDATE: "crm.task.update",
  TASK_ASSIGN: "crm.task.assign",
  CAMPAIGN_VIEW: "crm.campaign.view",
  CAMPAIGN_MANAGE: "crm.campaign.manage",
  AUDIT_VIEW: "crm.audit.view",
});

export const CRM_PERMISSION_VALUES = Object.freeze(Object.values(CRM_PERMISSIONS));

/**
 * @param {string} permission
 * @returns {boolean}
 */
export function isCrmPermission(permission) {
  return CRM_PERMISSION_VALUES.includes(String(permission || ""));
}
