/**
 * Persistence-neutral CRM repository contracts (Phase 1B + Phase 1E + Phase 1F).
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

/**
 * Phase 1F Tag repository — create + get + list + update.
 *
 * @typedef {object} CrmTagRepository
 * @property {(scope: TenantVenueScope, tag: object) => object|Promise<object>} create
 * @property {(scope: TenantVenueScope, tagId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, code: string) => object|null|Promise<object|null>} getByCode
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, tag: object) => object|Promise<object>} update
 */

/**
 * Phase 1F TagAssignment repository.
 *
 * @typedef {object} CrmTagAssignmentRepository
 * @property {(scope: TenantVenueScope, assignment: object) => object|Promise<object>} create
 * @property {(scope: TenantVenueScope, targetType: string, targetId: string, tagId: string) => object|null|Promise<object|null>} getByTargetAndTag
 * @property {(scope: TenantVenueScope, targetType: string, targetId: string) => object[]|Promise<object[]>} listByTarget
 * @property {(scope: TenantVenueScope, tagId: string) => object[]|Promise<object[]>} listByTag
 * @property {(scope: TenantVenueScope, assignmentId: string) => boolean|Promise<boolean>} remove
 */

/**
 * Phase 1F Consent repository — append-only create + get + list.
 *
 * @typedef {object} CrmConsentRepository
 * @property {(scope: TenantVenueScope, consent: object) => object|Promise<object>} create
 * @property {(scope: TenantVenueScope, consentId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 */

/**
 * Phase 1F PendingEvent repository — enqueue + claim + update.
 *
 * @typedef {object} CrmPendingEventRepository
 * @property {(scope: TenantVenueScope, records: object[]) => object[]|Promise<object[]>} enqueue
 * @property {(scope: TenantVenueScope, pendingEventId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, filters?: object) => object[]|Promise<object[]>} list
 * @property {(scope: TenantVenueScope, request: object) => object[]|Promise<object[]>} claim
 * @property {(scope: TenantVenueScope, record: object) => object|Promise<object>} update
 * @property {(scope: TenantVenueScope, request?: object) => object[]|Promise<object[]>} [releaseExpiredClaims]
 */

export const CRM_REPOSITORY_CONTRACT_NAMES = Object.freeze([
  "CrmContactReferenceRepository",
  "CrmLeadRepository",
  "CrmOpportunityRepository",
  "CrmPipelineRepository",
  "CrmInteractionRepository",
  "CrmTaskRepository",
  "CrmTagRepository",
  "CrmTagAssignmentRepository",
  "CrmConsentRepository",
  "CrmPendingEventRepository",
]);
