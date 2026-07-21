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
  TAG_CREATED: "crm.audit.tag.created",
  TAG_ACTIVATED: "crm.audit.tag.activated",
  TAG_DEACTIVATED: "crm.audit.tag.deactivated",
  TAG_ASSIGNED: "crm.audit.tag.assigned",
  TAG_REMOVED: "crm.audit.tag.removed",
  CONSENT_GRANTED: "crm.audit.consent.granted",
  CONSENT_REVOKED: "crm.audit.consent.revoked",
  PENDING_EVENTS_ENQUEUED: "crm.audit.pending_events.enqueued",
  PENDING_EVENT_CLAIMED: "crm.audit.pending_event.claimed",
  PENDING_EVENT_ACKNOWLEDGED: "crm.audit.pending_event.acknowledged",
  PENDING_EVENT_FAILED: "crm.audit.pending_event.failed",
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
