/** CRM audit and integration event type codes (Phase 1B + 1C + 1D + 1E). */

export const CRM_EVENT_SCHEMA_VERSION = 1;

export const CRM_AUDIT_EVENT_TYPE = Object.freeze({
  CONTACT_REFERENCE_CREATED: "crm.audit.contact_reference.created",
  LEAD_CREATED: "crm.audit.lead.created",
  LEAD_UPDATED: "crm.audit.lead.updated",
  LEAD_ASSIGNED: "crm.audit.lead.assigned",
  PIPELINE_CREATED: "crm.audit.pipeline.created",
  OPPORTUNITY_CREATED: "crm.audit.opportunity.created",
  OPPORTUNITY_ASSIGNED: "crm.audit.opportunity.assigned",
  OPPORTUNITY_STAGE_CHANGED: "crm.audit.opportunity.stage_changed",
  OPPORTUNITY_WON: "crm.audit.opportunity.won",
  OPPORTUNITY_LOST: "crm.audit.opportunity.lost",
  INTERACTION_RECORDED: "crm.audit.interaction.recorded",
  TASK_CREATED: "crm.audit.task.created",
  TASK_UPDATED: "crm.audit.task.updated",
  FOLLOW_UP_SCHEDULED: "crm.audit.follow_up.scheduled",
  TASK_ASSIGNED: "crm.audit.task.assigned",
  TASK_RESCHEDULED: "crm.audit.task.rescheduled",
  TASK_STARTED: "crm.audit.task.started",
  TASK_COMPLETED: "crm.audit.task.completed",
  TASK_CANCELLED: "crm.audit.task.cancelled",
});

export const CRM_INTEGRATION_EVENT_TYPE = Object.freeze({
  LEAD_CREATED: "crm.integration.lead.created",
  OPPORTUNITY_WON: "crm.integration.opportunity.won",
  OPPORTUNITY_LOST: "crm.integration.opportunity.lost",
  CAMPAIGN_LAUNCH_REQUESTED: "crm.integration.campaign.launch_requested",
  FOLLOW_UP_DUE: "crm.integration.follow_up.due",
});

export const CRM_EVENT_TYPE_VALUES = Object.freeze([
  ...Object.values(CRM_AUDIT_EVENT_TYPE),
  ...Object.values(CRM_INTEGRATION_EVENT_TYPE),
]);

/**
 * @param {string} eventType
 * @returns {boolean}
 */
export function isCrmEventType(eventType) {
  return CRM_EVENT_TYPE_VALUES.includes(String(eventType || ""));
}
