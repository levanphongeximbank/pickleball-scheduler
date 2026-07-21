/**
 * Persistence-neutral CRM repository contracts (Phase 1B + Phase 1E).
 *
 * These are documentation + shape helpers. Implementations must require
 * TenantVenueScope on every read/write. No Supabase imports allowed here.
 */

/**
 * @typedef {{ tenantId: string, venueId: string }} TenantVenueScope
 */

/**
 * @typedef {object} CrmContactReferenceRepository
 * @property {(scope: TenantVenueScope, contactRef: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, contactRefId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, contactRefId: string) => boolean|Promise<boolean>} delete
 */

/**
 * @typedef {object} CrmLeadRepository
 * @property {(scope: TenantVenueScope, lead: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, leadId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, leadId: string) => boolean|Promise<boolean>} delete
 */

/**
 * @typedef {object} CrmOpportunityRepository
 * @property {(scope: TenantVenueScope, opportunity: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, opportunityId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, opportunityId: string) => boolean|Promise<boolean>} delete
 */

/**
 * @typedef {object} CrmPipelineRepository
 * @property {(scope: TenantVenueScope, pipeline: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, pipelineId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, code: string) => object|null|Promise<object|null>} [getByCode]
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, pipelineId: string) => boolean|Promise<boolean>} delete
 */

/**
 * Phase 1E Interaction repository — create + get + list (append-only; no update).
 *
 * @typedef {object} CrmInteractionRepository
 * @property {(scope: TenantVenueScope, interaction: object) => object|Promise<object>} create
 * @property {(scope: TenantVenueScope, interaction: object) => object|Promise<object>} [save]
 * @property {(scope: TenantVenueScope, interactionId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 */

/**
 * Phase 1E Task repository — create + get + list + update.
 *
 * @typedef {object} CrmTaskRepository
 * @property {(scope: TenantVenueScope, task: object) => object|Promise<object>} create
 * @property {(scope: TenantVenueScope, task: object) => object|Promise<object>} update
 * @property {(scope: TenantVenueScope, task: object) => object|Promise<object>} [save]
 * @property {(scope: TenantVenueScope, taskId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 */

export const CRM_REPOSITORY_CONTRACT_NAMES = Object.freeze([
  "CrmContactReferenceRepository",
  "CrmLeadRepository",
  "CrmOpportunityRepository",
  "CrmPipelineRepository",
  "CrmInteractionRepository",
  "CrmTaskRepository",
]);
