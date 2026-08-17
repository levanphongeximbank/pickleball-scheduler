/**
 * Venue model — physical facility. Distinct from Tenant.
 * Wave 3: every venue carries tenantId (parent). Never treat venue.id as tenant identity.
 */

export const DEFAULT_VENUE_TIMEZONE = "Asia/Ho_Chi_Minh";

export const VENUE_STATUS = Object.freeze({
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
});

function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `venue-${Date.now()}`;
}

export function normalizeVenue(venue) {
  const name = String(venue?.name || "").trim();
  const id = String(venue?.id || venue?.venueId || "").trim();
  const tenantId = String(venue?.tenantId || venue?.tenant_id || "").trim() || null;

  return {
    id,
    tenantId,
    name,
    slug: String(venue?.slug || "").trim() || slugify(name || id),
    /** User id của VENUE_OWNER chính. */
    ownerId: venue?.ownerId || venue?.owner_id
      ? String(venue.ownerId || venue.owner_id).trim()
      : null,
    timezone: venue?.timezone || DEFAULT_VENUE_TIMEZONE,
    status: venue?.status || VENUE_STATUS.ACTIVE,
    subscriptionId: venue?.subscriptionId || venue?.subscription_id
      ? String(venue.subscriptionId || venue.subscription_id).trim()
      : null,
    note: String(venue?.note || "").trim(),
    createdAt: venue?.createdAt || venue?.created_at || new Date().toISOString(),
    updatedAt: venue?.updatedAt || venue?.updated_at || new Date().toISOString(),
  };
}

export function createVenueRecord(name, options = {}) {
  const trimmed = String(name || "").trim();
  const slug = slugify(trimmed);
  const tenantId = String(options.tenantId || options.tenant_id || "").trim();
  if (!tenantId) {
    throw new TypeError("createVenueRecord requires tenantId — Venue must belong to a Tenant.");
  }
  const id =
    options.id ||
    (slug === "" ? `venue-${Date.now()}` : `${slug}-${Date.now()}`);

  return normalizeVenue({
    id,
    tenantId,
    name: trimmed,
    slug,
    ownerId: options.ownerId || null,
    timezone: options.timezone || DEFAULT_VENUE_TIMEZONE,
    status: options.status || VENUE_STATUS.TRIAL,
    subscriptionId: options.subscriptionId || null,
    note: options.note || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function isVenueOperational(venue) {
  return venue?.status === VENUE_STATUS.ACTIVE || venue?.status === VENUE_STATUS.TRIAL;
}
