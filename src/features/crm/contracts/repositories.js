/**
 * Persistence-neutral CRM repository contracts (Phase 1B).
 *
 * These are documentation + shape helpers. Implementations must require
 * TenantVenueScope on every read/write. No Supabase imports allowed here.
 */

/**
 * @typedef {{ tenantId: string, venueId: string }} TenantVenueScope
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
 * @typedef {object} CrmInteractionRepository
 * @property {(scope: TenantVenueScope, interaction: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, interactionId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, interactionId: string) => boolean|Promise<boolean>} delete
 */

/**
 * @typedef {object} CrmTaskRepository
 * @property {(scope: TenantVenueScope, task: object) => object|Promise<object>} save
 * @property {(scope: TenantVenueScope, taskId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, taskId: string) => boolean|Promise<boolean>} delete
 */

export const CRM_REPOSITORY_CONTRACT_NAMES = Object.freeze([
  "CrmLeadRepository",
  "CrmOpportunityRepository",
  "CrmInteractionRepository",
  "CrmTaskRepository",
]);
