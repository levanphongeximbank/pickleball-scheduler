import { DEFAULT_TIMEZONE } from "../ai/config.js";

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
  const id = String(venue?.id || "").trim();

  return {
    id,
    name,
    slug: String(venue?.slug || "").trim() || slugify(name || id),
    /** User id của VENUE_OWNER chính. */
    ownerId: venue?.ownerId ? String(venue.ownerId).trim() : null,
    timezone: venue?.timezone || DEFAULT_TIMEZONE,
    status: venue?.status || VENUE_STATUS.ACTIVE,
    subscriptionId: venue?.subscriptionId ? String(venue.subscriptionId).trim() : null,
    note: String(venue?.note || "").trim(),
    createdAt: venue?.createdAt || new Date().toISOString(),
    updatedAt: venue?.updatedAt || new Date().toISOString(),
  };
}

export function createVenueRecord(name, options = {}) {
  const trimmed = String(name || "").trim();
  const slug = slugify(trimmed);
  const id =
    options.id ||
    (slug === "" ? `venue-${Date.now()}` : `${slug}-${Date.now()}`);

  return normalizeVenue({
    id,
    name: trimmed,
    slug,
    ownerId: options.ownerId || null,
    timezone: options.timezone || DEFAULT_TIMEZONE,
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
