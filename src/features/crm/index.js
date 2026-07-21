/**
 * CRM module — public facade (Phase 1B).
 *
 * Exports approved contracts, constants, pure models, authorization,
 * memory repository factories, and foundation helpers only.
 *
 * Does NOT export:
 * - internal repository mutable state
 * - Supabase implementations
 * - legacy localStorage services as canonical repositories
 *
 * Legacy LS services remain importable from their file paths / adapters
 * for compatibility only — see COMPATIBILITY.md.
 */

export { CRM_ERROR_CODES, CrmError, crmFailure } from "./constants/errorCodes.js";
export { CRM_PERMISSIONS, CRM_PERMISSION_VALUES, isCrmPermission } from "./constants/permissions.js";
export { LEAD_STATUS, LEAD_STATUS_VALUES, isLeadStatus } from "./constants/leadStatuses.js";
export { LEAD_SOURCE, LEAD_SOURCE_VALUES, isLeadSource } from "./constants/leadSources.js";
export {
  INTERACTION_TYPE,
  INTERACTION_TYPE_VALUES,
  isInteractionType,
} from "./constants/interactionTypes.js";
export {
  CRM_TASK_STATUS,
  CRM_TASK_STATUS_VALUES,
  isCrmTaskStatus,
} from "./constants/taskStatuses.js";
export {
  OPPORTUNITY_STAGE,
  OPPORTUNITY_STAGE_VALUES,
  DEFAULT_PIPELINE_STAGE_ORDER,
  isOpportunityStage,
} from "./constants/opportunityStages.js";
export {
  CRM_AUDIT_EVENT_TYPE,
  CRM_INTEGRATION_EVENT_TYPE,
  CRM_EVENT_TYPE_VALUES,
  isCrmEventType,
} from "./constants/eventTypes.js";
export {
  CRM_TIMESTAMP_FORMAT,
  isIsoTimestamp,
  normalizeIsoTimestamp,
} from "./constants/timestamps.js";

export {
  createTenantVenueScope,
  scopesEqual,
  assertSameScope,
  requireNonEmptyId,
} from "./models/scope.js";
export { createContactReference } from "./models/contactReference.js";
export { createLead } from "./models/lead.js";
export {
  createOpportunity,
  createPipeline,
  createPipelineStage,
} from "./models/opportunity.js";
export { createInteraction } from "./models/interaction.js";
export { createCrmTask } from "./models/task.js";
export { createCrmTag, createContactTagLink } from "./models/tag.js";
export { validateCrmAuditEvent, validateCrmIntegrationEvent } from "./models/events.js";

export { CRM_REPOSITORY_CONTRACT_NAMES } from "./contracts/repositories.js";
export {
  CRM_PORT_NAMES,
  createSystemCrmClock,
  createSequentialCrmIdGenerator,
} from "./contracts/ports.js";

export { requireCrmScope, assertCrmScopeMatch } from "./authorization/scopeGuards.js";
export {
  requireCrmActor,
  authorizeCrm,
  authorizeCrmResource,
} from "./authorization/crmAuthorize.js";

export { createMemoryLeadRepository } from "./repositories/memory/memoryLeadRepository.js";
export { createMemoryOpportunityRepository } from "./repositories/memory/memoryOpportunityRepository.js";
export { createMemoryInteractionRepository } from "./repositories/memory/memoryInteractionRepository.js";
export { createMemoryTaskRepository } from "./repositories/memory/memoryTaskRepository.js";

export { projectContactTimeline } from "./projectors/contactTimeline.js";
export { prepareLeadDraft } from "./services/prepareLeadDraft.js";

export {
  LEGACY_CRM_STORAGE_PREFIXES,
  LEGACY_CRM_COMPAT_CLASSIFICATION,
} from "./adapters/legacyLocalStorageCompat.js";
