import { DEFAULT_TIMEZONE } from "../ai/config.js";

function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `club-${Date.now()}`;
}

export function normalizeClub(club) {
  const name = String(club?.name || "").trim();
  const id = String(club?.id || "").trim();

  return {
    id,
    name,
    slug: String(club?.slug || "").trim() || slugify(name || id),
    note: String(club?.note || "").trim(),
    /** Tenant venue — optional, dùng khi bật RBAC multi-tenant. */
    venueId: club?.venueId ? String(club.venueId).trim() : null,
    timezone: club?.timezone || DEFAULT_TIMEZONE,
    createdAt: club?.createdAt || new Date().toISOString(),
    updatedAt: club?.updatedAt || new Date().toISOString(),
    isDefault: Boolean(club?.isDefault),
  };
}

export function createClubRecord(name, options = {}) {
  const trimmed = String(name || "").trim();
  const slug = slugify(trimmed);
  const id =
    options.id ||
    (slug === "" ? `club-${Date.now()}` : `${slug}-${Date.now()}`);

  return normalizeClub({
    id,
    name: trimmed,
    slug,
    note: options.note || "",
    venueId: options.venueId || null,
    timezone: options.timezone || DEFAULT_TIMEZONE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: Boolean(options.isDefault),
  });
}
