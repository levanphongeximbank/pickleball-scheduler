/**
 * Compatibility adapter boundary for legacy CRM localStorage services.
 *
 * Phase 1B: does NOT change page behavior. Surfaces explicit classification
 * and optional re-exports for gradual migration. These are NOT canonical
 * CRM repositories.
 *
 * @see ../COMPATIBILITY.md
 */

export const LEGACY_CRM_STORAGE_PREFIXES = Object.freeze({
  messages: "pickleball-crm-messages-v1::",
  templates: "pickleball-crm-templates-v1::",
  campaigns: "pickleball-crm-campaigns-v1::",
  contactHistory: "pickleball-crm-contact-history-v1::",
});

export const LEGACY_CRM_COMPAT_CLASSIFICATION = Object.freeze({
  crmMessageService: "COMPATIBILITY_ONLY",
  crmTemplateService: "COMPATIBILITY_ONLY",
  crmCampaignService: "COMPATIBILITY_ONLY",
  crmContactHistoryService: "COMPATIBILITY_ONLY",
  crmPages: "LEGACY_TRANSITIONAL",
  bookingReminderPage: "EXTERNAL_MODULE_REFERENCE",
  customerGroups: "EXTERNAL_MODULE_REFERENCE",
  notificationsOverlap: "EXTERNAL_MODULE_REFERENCE",
});

/**
 * Re-export legacy services for adapters that need them.
 * Callers must treat these as compatibility surfaces only.
 */
export {
  clearCrmMessages,
  createMessage,
  deleteMessage,
  listMessages,
  markMessageSent,
  updateMessage,
} from "../services/crmMessageService.js";

export {
  clearCrmTemplates,
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "../services/crmTemplateService.js";

export {
  clearCrmCampaigns,
  createCampaign,
  deleteCampaign,
  launchCampaign,
  listCampaigns,
  updateCampaign,
} from "../services/crmCampaignService.js";

export {
  addContactHistory,
  clearCrmContactHistory,
  listContactHistory,
} from "../services/crmContactHistoryService.js";
