const ACTIVE_TENANT_KEY = "pickleball-active-tenant-v1";

export function loadActiveTenantId() {
  const raw = localStorage.getItem(ACTIVE_TENANT_KEY);
  return raw ? String(raw).trim() : null;
}

export function saveActiveTenantId(tenantId) {
  if (!tenantId) {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_TENANT_KEY, String(tenantId).trim());
}

export function clearActiveTenantId() {
  localStorage.removeItem(ACTIVE_TENANT_KEY);
}
