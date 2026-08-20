/**
 * Tenant model default timezone — owned here (not imported from AI module).
 * Literal value: Asia/Ho_Chi_Minh.
 */
export const DEFAULT_TENANT_TIMEZONE = "Asia/Ho_Chi_Minh";

export const TENANT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  TRIAL: "trial",
  SUSPENDED: "suspended",
});

export const TENANT_PLANS = Object.freeze({
  TRIAL: "trial",
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
});

export const DEFAULT_TENANT_ID = "default-tenant";

function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `tenant-${Date.now()}`;
}

/** Wave 3 tenant model — distinct from Venue. Does not accept venueId as tenant id. */
export function normalizeTenant(tenant) {
  const name = String(tenant?.name || "").trim();
  const id = String(tenant?.id || tenant?.tenantId || "").trim();

  return {
    id,
    name,
    slug: String(tenant?.slug || "").trim() || slugify(name || id),
    status: tenant?.status || TENANT_STATUS.ACTIVE,
    plan: tenant?.plan || TENANT_PLANS.TRIAL,
    ownerUserId: tenant?.ownerUserId || tenant?.ownerId || null,
    timezone: tenant?.timezone || DEFAULT_TENANT_TIMEZONE,
    note: String(tenant?.note || "").trim(),
    createdAt: tenant?.createdAt || new Date().toISOString(),
    updatedAt: tenant?.updatedAt || new Date().toISOString(),
  };
}

export function createTenantRecord(name, options = {}) {
  const trimmed = String(name || "").trim();
  const slug = slugify(trimmed);
  const id =
    options.id ||
    (slug === "" ? `tenant-${Date.now()}` : `${slug}-${Date.now()}`);

  return normalizeTenant({
    id,
    name: trimmed,
    slug,
    ownerUserId: options.ownerUserId || options.ownerId || null,
    timezone: options.timezone || DEFAULT_TENANT_TIMEZONE,
    status: options.status || TENANT_STATUS.TRIAL,
    plan: options.plan || TENANT_PLANS.TRIAL,
    note: options.note || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function isTenantOperational(tenant) {
  if (!tenant) {
    return false;
  }

  return (
    tenant.status === TENANT_STATUS.ACTIVE || tenant.status === TENANT_STATUS.TRIAL
  );
}

export function tenantIdFromRecord(record) {
  if (!record) {
    return null;
  }

  return record.tenantId || record.venueId || null;
}
