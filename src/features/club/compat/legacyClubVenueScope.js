/**
 * Wave 5 — explicit Club RPC compatibility translation boundary.
 *
 * Live Staging/Production canonical Club RPC field named `tenant_id` currently
 * stores a LEGACY VENUE SCOPE id (venues.id), not a Platform Tenant id.
 *
 * Never name a legacy Venue ID `tenantId` internally.
 * Never treat identity-equality (venue.id === platform_tenants.id) as proof.
 * Never copy tenantId ↔ venueId.
 *
 * Pre-SQL (no semantic marker):
 *   row.tenant_id = legacy Venue scope → resolve Venue → canonical Tenant.
 *
 * Post-SQL (explicit marker / canonical_tenant_id):
 *   tenant_id = Platform Tenant id; venueId only if independently sourced.
 */

export const CLUB_SCOPE_SEMANTICS = Object.freeze({
  LEGACY_VENUE_SCOPE: "legacy_venue_scope",
  CANONICAL_PLATFORM_TENANT: "canonical_platform_tenant",
});

const CANONICAL_MARKERS = new Set([
  "canonical_platform_tenant",
  "canonical",
  "v2",
  "platform_tenant",
]);

function trimId(value) {
  const id = String(value || "").trim();
  return id || null;
}

/**
 * Discriminate RPC/row Club-scope semantics. Marker/canonical_tenant_id only —
 * never "if this id exists in platform_tenants then assume canonical".
 *
 * @param {object|null|undefined} row
 * @returns {string}
 */
export function detectClubRowScopeSemantics(row = {}) {
  if (!row || typeof row !== "object") {
    return CLUB_SCOPE_SEMANTICS.LEGACY_VENUE_SCOPE;
  }
  const marker = String(
    row.scope_semantics ||
      row.scopeSemantics ||
      row.tenant_scope_version ||
      row.tenantScopeVersion ||
      ""
  )
    .trim()
    .toLowerCase();
  if (CANONICAL_MARKERS.has(marker)) {
    return CLUB_SCOPE_SEMANTICS.CANONICAL_PLATFORM_TENANT;
  }
  if (trimId(row.canonical_tenant_id || row.canonicalTenantId)) {
    return CLUB_SCOPE_SEMANTICS.CANONICAL_PLATFORM_TENANT;
  }
  // Application-model club (already translated / local record): camelCase tenantId
  // without a raw RPC tenant_id field is canonical Tenant, not a Venue alias.
  if (trimId(row.tenantId) && !Object.prototype.hasOwnProperty.call(row, "tenant_id")) {
    return CLUB_SCOPE_SEMANTICS.CANONICAL_PLATFORM_TENANT;
  }
  return CLUB_SCOPE_SEMANTICS.LEGACY_VENUE_SCOPE;
}

/**
 * Resolve canonical Platform Tenant from a legacy Club Venue-scope id.
 *
 * @param {string|null|undefined} legacyClubScopeId venues.id stored in clubs.tenant_id
 * @param {(venueId: string) => {id?: string, tenantId?: string, tenant_id?: string}|null|undefined} resolveVenue
 * @returns {{
 *   ok: boolean,
 *   code: string|null,
 *   canonicalTenantId: string|null,
 *   venueId: string|null,
 *   legacyClubScopeId: string|null,
 * }}
 */
export function resolveCanonicalTenantFromLegacyClubScope(legacyClubScopeId, resolveVenue) {
  const scopeId = trimId(legacyClubScopeId);
  if (!scopeId) {
    return {
      ok: false,
      code: "LEGACY_CLUB_SCOPE_MISSING",
      canonicalTenantId: null,
      venueId: null,
      legacyClubScopeId: null,
    };
  }
  if (typeof resolveVenue !== "function") {
    return {
      ok: false,
      code: "VENUE_RESOLVER_REQUIRED",
      canonicalTenantId: null,
      venueId: null,
      legacyClubScopeId: scopeId,
    };
  }

  const venue = resolveVenue(scopeId);
  const venueId = trimId(venue?.id);
  const canonicalTenantId = trimId(venue?.tenantId || venue?.tenant_id);
  if (!venueId || !canonicalTenantId) {
    return {
      ok: false,
      code: "LEGACY_CLUB_SCOPE_VENUE_UNRESOLVED",
      canonicalTenantId: null,
      venueId: null,
      legacyClubScopeId: scopeId,
    };
  }

  return {
    ok: true,
    code: null,
    canonicalTenantId,
    venueId,
    legacyClubScopeId: scopeId,
  };
}

/**
 * Translate a Club RPC/row into distinct application identities.
 *
 * Output:
 *   tenantId = canonical Platform Tenant
 *   venueId  = independently resolved Venue id (legacy source evidence) OR
 *              an independently sourced venue_id field — never copied from tenantId
 *
 * The resolved Venue is compatibility/migration context, not Club ownership.
 *
 * @param {object|null|undefined} row
 * @param {{ resolveVenue?: Function }} [options]
 */
export function translateLegacyClubVenueScope(row, { resolveVenue } = {}) {
  const semantics = detectClubRowScopeSemantics(row);
  const independentVenueId = trimId(row?.venue_id || row?.venueId);

  if (semantics === CLUB_SCOPE_SEMANTICS.CANONICAL_PLATFORM_TENANT) {
    const tenantId = trimId(
      row?.canonical_tenant_id || row?.canonicalTenantId || row?.tenant_id || row?.tenantId
    );
    return {
      tenantId,
      venueId: independentVenueId,
      scopeSemantics: semantics,
      legacyVenueScopeId: trimId(row?.legacy_venue_scope_id || row?.legacyVenueScopeId),
      translationOk: Boolean(tenantId),
      translationCode: tenantId ? null : "CANONICAL_TENANT_MISSING",
    };
  }

  const legacyClubScopeId = trimId(
    row?.legacy_venue_scope_id ||
      row?.legacyVenueScopeId ||
      row?.tenant_id ||
      row?.legacyClubScopeId
  );
  const resolved = resolveCanonicalTenantFromLegacyClubScope(legacyClubScopeId, resolveVenue);
  return {
    tenantId: resolved.canonicalTenantId,
    // Independently resolved Venue identity — source is Venue.id, not tenantId.
    venueId: independentVenueId || resolved.venueId,
    scopeSemantics: semantics,
    legacyVenueScopeId: resolved.legacyClubScopeId,
    translationOk: resolved.ok,
    translationCode: resolved.code,
  };
}

/**
 * Project Club tenant/venue identities from a row or already-normalized club.
 * Safe to call on UI clubs that already carry canonical tenantId.
 *
 * @param {object|null|undefined} row
 * @param {{ resolveVenue?: Function }} [options]
 */
export function projectClubTenantVenueIdentities(row, options = {}) {
  if (!row || typeof row !== "object") {
    return {
      tenantId: null,
      venueId: null,
      scopeSemantics: CLUB_SCOPE_SEMANTICS.LEGACY_VENUE_SCOPE,
      legacyVenueScopeId: null,
      translationOk: false,
      translationCode: "CLUB_ROW_MISSING",
    };
  }
  return translateLegacyClubVenueScope(row, options);
}
