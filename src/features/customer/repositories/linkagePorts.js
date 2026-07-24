/**
 * Customer linkage repository ports (CUSTOMER-05).
 */

export const CUSTOMER_LINKAGE_REPOSITORY_PORTS = Object.freeze({
  CustomerLinkageRepository: "CustomerLinkageRepository",
});

/**
 * @typedef {object} CustomerLinkageRepository
 * @property {(scope: object, linkageId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: object, customerId: string, options?: object) => object[]|Promise<object[]>} listByCustomer
 * @property {(scope: object, linkageType: string, externalReferenceId: string, options?: { externalSystem?: string, activeOnly?: boolean }) => object|null|Promise<object|null>} findActiveByExternalReference
 * @property {(scope: object, customerId: string, linkageType: string, options?: { externalSystem?: string, activeOnly?: boolean }) => object|null|Promise<object|null>} findActiveByCustomerAndType
 * @property {(linkage: object, history: object, options?: {
 *   expectedLinkageVersion?: number|null,
 *   expectedCustomerVersion?: number|null,
 *   customerVersionAfter?: number|null,
 *   syncCustomerAccountUserId?: string|null,
 *   syncCustomerPlayerId?: string|null,
 *   clearCustomerAccountUserId?: boolean,
 *   clearCustomerPlayerId?: boolean,
 * }) => object|Promise<object>} saveLinkageWithHistory
 * @property {(scope: object, linkageId: string) => object[]|Promise<object[]>} listHistory
 * @property {(scope: object, customerId: string) => object[]|Promise<object[]>} [listHistoryByCustomer]
 */
