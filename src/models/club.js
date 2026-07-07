import { DEFAULT_TIMEZONE } from "../ai/config.js";
import { normalizeClubGovernance } from "../features/club/models/clubGovernance.js";

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
  const status =
    club?.status === "inactive"
      ? "inactive"
      : club?.status === "pending_approval"
        ? "pending_approval"
      : club?.status === "pending_setup"
        ? "pending_setup"
        : "active";

  const governance = normalizeClubGovernance(club);

  return {
    id,
    name,
    code: club?.code ? String(club.code).trim() : null,
    description: club?.description ? String(club.description).trim() : "",
    status,
    governance,
    slug: String(club?.slug || "").trim() || slugify(name || id),
    note: String(club?.note || "").trim(),
    /** Tenant — optional, dùng khi bật RBAC multi-tenant. tenantId === venueId. */
    tenantId: club?.tenantId
      ? String(club.tenantId).trim()
      : club?.venueId
        ? String(club.venueId).trim()
        : null,
    venueId: club?.venueId
      ? String(club.venueId).trim()
      : club?.tenantId
        ? String(club.tenantId).trim()
        : null,
    createdByUserId: club?.createdByUserId ? String(club.createdByUserId).trim() : null,
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
    code: options.code || null,
    description: options.description || "",
    status: options.status || "active",
    governance: options.governance,
    note: options.note || "",
    venueId: options.venueId || options.tenantId || null,
    tenantId: options.tenantId || options.venueId || null,
    createdByUserId: options.createdByUserId || null,
    timezone: options.timezone || DEFAULT_TIMEZONE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: Boolean(options.isDefault),
  });
}
