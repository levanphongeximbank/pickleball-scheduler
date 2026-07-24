/**
 * Deterministic Customer domain ↔ row mapping (CUSTOMER-03).
 * Snake_case persistence rows; camelCase domain aggregates.
 * No Supabase types.
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object|null|undefined} profile
 * @returns {object}
 */
function profileToJsonb(profile) {
  if (!profile || typeof profile !== "object") return {};
  return cloneJson(profile);
}

/**
 * @param {object} jsonb
 * @returns {object|null}
 */
function jsonbToProfile(jsonb) {
  if (!jsonb || typeof jsonb !== "object" || Array.isArray(jsonb)) return null;
  const keys = Object.keys(jsonb);
  if (keys.length === 0) return null;
  return cloneJson(jsonb);
}

/**
 * @param {unknown} list
 * @returns {unknown[]}
 */
function listToJsonb(list) {
  if (!Array.isArray(list)) return [];
  return cloneJson(list);
}

/**
 * @param {object} customer
 * @returns {object}
 */
export function mapCustomerDomainToRootRow(customer) {
  return {
    customer_id: customer.customerId,
    customer_number: customer.customerNumber,
    tenant_id: customer.tenantId,
    venue_id: customer.venueId,
    customer_type: customer.customerType,
    status: customer.status,
    display_name: customer.displayName,
    legal_name: customer.legalName ?? null,
    locale: customer.locale ?? null,
    individual_profile: profileToJsonb(customer.individualProfile),
    organization_profile: profileToJsonb(customer.organizationProfile),
    account_user_id: customer.accountLinkage?.userAccountId ?? null,
    player_id: customer.playerLinkage?.playerId ?? null,
    organization_id: customer.organizationLinkage?.organizationId ?? null,
    classification: listToJsonb(customer.classification),
    segment_references: listToJsonb(customer.segmentReferences),
    tags: listToJsonb(customer.tags),
    communication_preferences: listToJsonb(customer.communicationPreferences),
    consent_references: listToJsonb(customer.consentReferences),
    metadata: profileToJsonb(customer.metadata),
    merged_into_customer_id: customer.mergedIntoCustomerId ?? null,
    merged_at: customer.mergedAt ?? null,
    merge_history_id: customer.mergeHistoryId ?? null,
    merge_proposal_id: customer.mergeProposalId ?? null,
    version: customer.version,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  };
}

/**
 * @param {object} contact
 * @param {{ tenantId: string, venueId: string, customerId: string }} scope
 * @returns {object}
 */
export function mapContactDomainToRow(contact, scope) {
  return {
    contact_point_id: contact.contactPointId,
    customer_id: scope.customerId,
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    contact_type: contact.type,
    normalized_value: contact.normalizedValue || contact.value,
    display_value: contact.displayValue || contact.normalizedValue || contact.value,
    purpose: contact.purpose || contact.label || "GENERAL",
    is_primary: contact.primary === true,
    verification_state: contact.verificationState || "UNVERIFIED",
    status: contact.status || "ACTIVE",
    version: Number.isInteger(contact.version) && contact.version > 0 ? contact.version : 1,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

/**
 * @param {object} address
 * @param {{ tenantId: string, venueId: string, customerId: string }} scope
 * @returns {object}
 */
export function mapAddressDomainToRow(address, scope) {
  return {
    address_id: address.addressId,
    customer_id: scope.customerId,
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    address_type: address.addressType,
    address_line1: address.addressLine1,
    address_line2: address.addressLine2 ?? null,
    locality: address.locality ?? null,
    admin_area: address.adminArea ?? null,
    postal_code: address.postalCode ?? null,
    country_code: address.countryCode || "VN",
    is_primary: address.primary === true,
    status: address.status || "ACTIVE",
    version: Number.isInteger(address.version) && address.version > 0 ? address.version : 1,
    created_at: address.createdAt,
    updated_at: address.updatedAt,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapContactRowToDomain(row) {
  const normalized = row.normalized_value;
  return Object.freeze({
    contactPointId: row.contact_point_id,
    type: row.contact_type,
    value: normalized,
    normalizedValue: normalized,
    displayValue: row.display_value,
    purpose: row.purpose,
    label: row.purpose,
    primary: row.is_primary === true,
    verificationState: row.verification_state,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapAddressRowToDomain(row) {
  return Object.freeze({
    addressId: row.address_id,
    addressType: row.address_type,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 ?? null,
    locality: row.locality ?? null,
    adminArea: row.admin_area ?? null,
    postalCode: row.postal_code ?? null,
    countryCode: row.country_code || "VN",
    primary: row.is_primary === true,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} rootRow
 * @param {object[]} [contactRows]
 * @param {object[]} [addressRows]
 * @returns {object}
 */
export function mapCustomerRowsToDomain(rootRow, contactRows = [], addressRows = []) {
  const individualProfile = jsonbToProfile(rootRow.individual_profile);
  const organizationProfile = jsonbToProfile(rootRow.organization_profile);

  return Object.freeze({
    customerId: rootRow.customer_id,
    customerNumber: rootRow.customer_number,
    tenantId: rootRow.tenant_id,
    venueId: rootRow.venue_id,
    displayName: rootRow.display_name,
    legalName: rootRow.legal_name ?? null,
    individualProfile: individualProfile ? Object.freeze(individualProfile) : null,
    organizationProfile: organizationProfile ? Object.freeze(organizationProfile) : null,
    customerType: rootRow.customer_type,
    status: rootRow.status,
    contactPoints: Object.freeze(
      (contactRows || []).map((row) => mapContactRowToDomain(row))
    ),
    addresses: Object.freeze(
      (addressRows || []).map((row) => mapAddressRowToDomain(row))
    ),
    locale: rootRow.locale ?? null,
    accountLinkage: rootRow.account_user_id
      ? Object.freeze({ userAccountId: rootRow.account_user_id })
      : null,
    playerLinkage: rootRow.player_id
      ? Object.freeze({ playerId: rootRow.player_id })
      : null,
    organizationLinkage: rootRow.organization_id
      ? Object.freeze({ organizationId: rootRow.organization_id })
      : null,
    classification: Object.freeze(listToJsonb(rootRow.classification)),
    segmentReferences: Object.freeze(listToJsonb(rootRow.segment_references)),
    tags: Object.freeze(listToJsonb(rootRow.tags)),
    communicationPreferences: Object.freeze(
      listToJsonb(rootRow.communication_preferences)
    ),
    consentReferences: Object.freeze(listToJsonb(rootRow.consent_references)),
    metadata: Object.freeze(profileToJsonb(rootRow.metadata)),
    mergedIntoCustomerId: rootRow.merged_into_customer_id ?? null,
    mergedAt: rootRow.merged_at ?? null,
    mergeHistoryId: rootRow.merge_history_id ?? null,
    mergeProposalId: rootRow.merge_proposal_id ?? null,
    createdAt: rootRow.created_at,
    updatedAt: rootRow.updated_at,
    version: rootRow.version,
  });
}

/**
 * @param {object} customer
 * @returns {{ customer: object, contactPoints: object[], addresses: object[] }}
 */
export function mapCustomerDomainToSavePayload(customer) {
  const scope = {
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    customerId: customer.customerId,
  };
  return {
    customer: mapCustomerDomainToRootRow(customer),
    contactPoints: (customer.contactPoints || []).map((cp) =>
      mapContactDomainToRow(cp, scope)
    ),
    addresses: (customer.addresses || []).map((addr) =>
      mapAddressDomainToRow(addr, scope)
    ),
  };
}
