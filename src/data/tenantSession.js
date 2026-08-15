const ACTIVE_TENANT_KEY = "pickleball-active-tenant-v1";

function normalizeUserId(userId) {
  const id = String(userId || "").trim();
  return id || null;
}

function readRecord() {
  const raw = localStorage.getItem(ACTIVE_TENANT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const tenantId = String(parsed.tenantId || "").trim();
      if (!tenantId) {
        return null;
      }
      return {
        tenantId,
        userId: normalizeUserId(parsed.userId),
      };
    }
  } catch {
    // Legacy unscoped plain string. Fail closed — do not restore across users.
  }

  return null;
}

/**
 * Session/UI selected-tenant only. Not tenant master-data authority.
 * When userId is provided, a mismatched stored actor is treated as absent.
 */
export function loadActiveTenantId(userId) {
  const record = readRecord();
  if (!record?.tenantId) {
    return null;
  }

  const actorId = normalizeUserId(userId);
  if (actorId) {
    if (!record.userId || record.userId !== actorId) {
      return null;
    }
  }

  return record.tenantId;
}

export function saveActiveTenantId(tenantId, userId) {
  const nextId = String(tenantId || "").trim();
  if (!nextId) {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    return;
  }

  const actorId = normalizeUserId(userId);
  localStorage.setItem(
    ACTIVE_TENANT_KEY,
    JSON.stringify({
      tenantId: nextId,
      userId: actorId,
    })
  );
}

export function clearActiveTenantId() {
  localStorage.removeItem(ACTIVE_TENANT_KEY);
}
