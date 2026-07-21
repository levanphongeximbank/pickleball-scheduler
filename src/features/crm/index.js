/**
 * CRM module — public facade (Phase 1B–1H-A).
 *
 * Exports approved contracts, constants, pure models, authorization,
 * memory repository factories, Phase 1C–1F application services,
 * Phase 1G durable repository adapters + mapping utilities,
 * Phase 1H-A injectable Supabase port adapter + composition guard,
 * and foundation helpers only.
 *
 * Does NOT export:
 * - internal repository mutable state
 * - concrete Supabase client instances or credentials
 * - test-only fakes (see `testing/phase1cFakes.js` for tests)
 * - raw SQL strings
 * - legacy localStorage services as canonical repositories
 *
 * Legacy LS services remain importable from their file paths / adapters
 * for compatibility only — see COMPATIBILITY.md.
 * Memory repositories remain the default runtime composition in Phase 1H-A.
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
  INTERACTION_DIRECTION,
  INTERACTION_DIRECTION_VALUES,
  isInteractionDirection,
} from "./constants/interactionDirections.js";
export {
  INTERACTION_CHANNEL,
  INTERACTION_CHANNEL_VALUES,
  isInteractionChannel,
} from "./constants/interactionChannels.js";
export {
  CRM_TASK_STATUS,
  CRM_TASK_STATUS_VALUES,
  CRM_TASK_TERMINAL_STATUSES,
  CRM_TASK_ALLOWED_TRANSITIONS,
  isCrmTaskStatus,
  isCrmTaskTerminalStatus,
  isAllowedCrmTaskTransition,
} from "./constants/taskStatuses.js";
export {
  CRM_TASK_PRIORITY,
  CRM_TASK_PRIORITY_VALUES,
  isCrmTaskPriority,
} from "./constants/taskPriorities.js";
export {
  OPPORTUNITY_STAGE,
  OPPORTUNITY_STAGE_VALUES,
  PIPELINE_STAGE_CATEGORY,
  PIPELINE_STAGE_CATEGORY_VALUES,
  DEFAULT_PIPELINE_STAGE_ORDER,
  isOpportunityStage,
  isPipelineStageCategory,
  normalizePipelineCode,
  inferStageCategoryFromCode,
} from "./constants/opportunityStages.js";
export {
  CRM_EVENT_SCHEMA_VERSION,
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
  TAG_TARGET_TYPE,
  TAG_TARGET_TYPE_VALUES,
  isTagTargetType,
} from "./constants/tagTargetTypes.js";
export {
  CONSENT_CHANNEL,
  CONSENT_CHANNEL_VALUES,
  isConsentChannel,
} from "./constants/consentChannels.js";
export {
  CONSENT_STATUS,
  CONSENT_STATUS_VALUES,
  isConsentStatus,
} from "./constants/consentStatuses.js";
export {
  CONSENT_PURPOSE,
  CONSENT_PURPOSE_VALUES,
  isConsentPurpose,
} from "./constants/consentPurposes.js";
export {
  PENDING_EVENT_STATUS,
  PENDING_EVENT_STATUS_VALUES,
  PENDING_EVENT_TERMINAL_STATUSES,
  isPendingEventStatus,
  isPendingEventTerminalStatus,
} from "./constants/pendingEventStatuses.js";

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
  assertValidPipelineStages,
  buildDefaultAllowedTransitions,
  getInitialOpenStage,
  getTerminalStageByCategory,
  findPipelineStage,
  isAllowedStageTransition,
} from "./models/opportunity.js";
export {
  createInteraction,
  INTERACTION_SUMMARY_MAX_LENGTH,
  INTERACTION_OUTCOME_MAX_LENGTH,
} from "./models/interaction.js";
export {
  createCrmTask,
  CRM_TASK_TITLE_MAX_LENGTH,
  CRM_TASK_DESCRIPTION_MAX_LENGTH,
  CRM_TASK_CANCELLATION_REASON_MAX_LENGTH,
} from "./models/task.js";
export {
  createCrmTag,
  createTagAssignment,
  createContactTagLink,
  normalizeTagCode,
  compareTagsList,
  CRM_TAG_NAME_MAX_LENGTH,
  CRM_TAG_CODE_MAX_LENGTH,
} from "./models/tag.js";
export {
  createConsentRecord,
  deriveEffectiveConsent,
  compareConsentHistoryDesc,
  CONSENT_POLICY_VERSION_MAX_LENGTH,
} from "./models/consentRecord.js";
export {
  createPendingEventRecord,
  comparePendingEventsClaimOrder,
} from "./models/pendingEventRecord.js";
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

export { createMemoryContactReferenceRepository } from "./repositories/memory/memoryContactReferenceRepository.js";
export { createMemoryLeadRepository } from "./repositories/memory/memoryLeadRepository.js";
export { createMemoryOpportunityRepository } from "./repositories/memory/memoryOpportunityRepository.js";
export { createMemoryPipelineRepository } from "./repositories/memory/memoryPipelineRepository.js";
export { createMemoryInteractionRepository } from "./repositories/memory/memoryInteractionRepository.js";
export { createMemoryTaskRepository } from "./repositories/memory/memoryTaskRepository.js";
export { createMemoryTagRepository } from "./repositories/memory/memoryTagRepository.js";
export { createMemoryTagAssignmentRepository } from "./repositories/memory/memoryTagAssignmentRepository.js";
export { createMemoryConsentRepository } from "./repositories/memory/memoryConsentRepository.js";
export { createMemoryPendingEventRepository } from "./repositories/memory/memoryPendingEventRepository.js";

export {
  CRM_PHASE_1G_TABLES,
  CRM_PHASE_1G_RPC,
  requireCrmDatabaseClientPort,
} from "./persistence/databaseClientPort.js";
export { createDurableTagRepository } from "./persistence/durable/durableTagRepository.js";
export { createDurableTagAssignmentRepository } from "./persistence/durable/durableTagAssignmentRepository.js";
export { createDurableConsentRepository } from "./persistence/durable/durableConsentRepository.js";
export { createDurablePendingEventRepository } from "./persistence/durable/durablePendingEventRepository.js";
export { mapTagDomainToRow, mapTagRowToDomain } from "./persistence/mapping/tagMapping.js";
export {
  mapTagAssignmentDomainToRow,
  mapTagAssignmentRowToDomain,
} from "./persistence/mapping/tagAssignmentMapping.js";
export {
  mapConsentDomainToRow,
  mapConsentRowToDomain,
} from "./persistence/mapping/consentMapping.js";
export {
  mapPendingEventDomainToRow,
  mapPendingEventRowToDomain,
} from "./persistence/mapping/pendingEventMapping.js";
export {
  createSupabaseCrmDatabaseClient,
  CRM_SUPABASE_TABLE_ALLOWLIST,
  CRM_SUPABASE_OPERATION_ALLOWLIST,
  CRM_SUPABASE_RPC_ALLOWLIST,
} from "./persistence/supabase/supabaseCrmDatabaseClient.js";
export {
  CRM_PERSISTENCE_MODE_ENV,
  CRM_PERSISTENCE_MEMORY_MODE,
  CRM_PERSISTENCE_DURABLE_MODE,
  resolveCrmPersistenceMode,
  assertCrmRuntimeCompositionGuard,
  getCrmDefaultRuntimePersistenceMode,
} from "./persistence/runtimeCompositionGuard.js";
export {
  CRM_PERMISSION_SEED_ROWS,
  CRM_PHASE_1G_REQUIRED_PERMISSIONS,
  CRM_PERMISSION_SEED_APPROVAL,
} from "./identity/crmPermissionSeedDefinitions.js";
export {
  CRM_PROPOSED_ROLE_PERMISSION_MATRIX,
  CRM_ROLE_MATRIX_APPROVAL,
  listProposedCrmRolePermissionGrants,
} from "./identity/crmRolePermissionMatrix.js";
export {
  CRM_TENANT_VENUE_RESOLVER_VERDICT,
  getCrmTenantVenueResolverVerdict,
} from "./identity/tenantVenueResolverCertification.js";

export { projectContactTimeline } from "./projectors/contactTimeline.js";
export { prepareLeadDraft } from "./services/prepareLeadDraft.js";
export { createLeadApplicationService } from "./services/leadApplicationService.js";
export { createOpportunityApplicationService } from "./services/opportunityApplicationService.js";
export { createInteractionApplicationService } from "./services/interactionApplicationService.js";
export { createTaskApplicationService } from "./services/taskApplicationService.js";
export { createTagApplicationService } from "./services/tagApplicationService.js";
export { createConsentApplicationService } from "./services/consentApplicationService.js";
export { createPendingEventDispatchService } from "./services/pendingEventDispatchService.js";

export {
  LEGACY_CRM_STORAGE_PREFIXES,
  LEGACY_CRM_COMPAT_CLASSIFICATION,
} from "./adapters/legacyLocalStorageCompat.js";
