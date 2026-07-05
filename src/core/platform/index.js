export function createTenantRecord({ name, tenant_id, plan = "trial", status = "active" } = {}) {
  return {
    id: tenant_id || `tenant-${Date.now()}`,
    tenant_id: tenant_id || `tenant-${Date.now()}`,
    name: name || "Unnamed tenant",
    plan,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createUserRecord({ email, role, tenant_id, user_id } = {}) {
  return {
    id: user_id || `user-${Date.now()}`,
    user_id: user_id || `user-${Date.now()}`,
    email,
    role,
    tenant_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function assertTenantAccess(user, { tenant_id } = {}) {
  if (!user) {
    return { ok: false, allowed: false, code: "TENANT_REQUIRED" };
  }

  if (user.role === "SUPER_ADMIN" || user.role === "PLATFORM_ADMIN") {
    return { ok: true, allowed: true };
  }

  if (!tenant_id) {
    return { ok: false, allowed: false, code: "TENANT_REQUIRED" };
  }

  if (!user.tenant_id || user.tenant_id !== tenant_id) {
    return { ok: false, allowed: false, code: "TENANT_FORBIDDEN" };
  }

  return { ok: true, allowed: true };
}

export function canPerformAction(user, scope = {}, permission) {
  const tenantCheck = assertTenantAccess(user, scope);
  if (!tenantCheck.ok) {
    return { ok: false, allowed: false, code: tenantCheck.code };
  }

  return { ok: true, allowed: true, permission };
}

const PLATFORM_PERMISSIONS = Object.freeze([
  "tenant.manage",
  "user.manage",
  "subscription.manage",
  "audit.read",
  "tournament.manage",
  "club.manage",
  "booking.manage",
  "court.manage",
  "player.manage",
  "customer.manage",
  "checkin.manage",
  "payment.manage",
  "system.setting",
  "match.update",
  "match.view",
  "marketplace.manage",
  "player.view.self",
  "booking.view.self",
]);

export function getPermissionMatrix() {
  return {
    SUPER_ADMIN: [...PLATFORM_PERMISSIONS],
    TENANT_OWNER: [
      "tenant.manage",
      "user.manage",
      "subscription.manage",
      "audit.read",
      "tournament.manage",
      "club.manage",
      "booking.manage",
      "court.manage",
      "player.manage",
      "customer.manage",
      "checkin.manage",
      "payment.manage",
      "system.setting",
      "match.update",
      "match.view",
      "marketplace.manage",
    ],
    VENUE_MANAGER: [
      "booking.manage",
      "court.manage",
      "player.manage",
      "customer.manage",
      "tournament.manage",
      "checkin.manage",
      "match.update",
      "match.view",
    ],
    CLUB_OWNER: [
      "club.manage",
      "tournament.manage",
      "player.manage",
      "match.update",
      "match.view",
    ],
    STAFF: ["booking.manage", "checkin.manage", "court.manage"],
    CASHIER: ["payment.manage", "booking.manage", "checkin.manage"],
    REFEREE: ["match.update", "match.view", "checkin.manage"],
    PLAYER: ["player.view.self", "booking.view.self", "match.view"],
  };
}

export function getRlsPolicyMatrix() {
  return {
    SUPER_ADMIN: ["all"],
    TENANT_OWNER: ["tenant"],
    VENUE_MANAGER: ["tenant"],
    CLUB_OWNER: ["tenant"],
    STAFF: ["tenant"],
    CASHIER: ["tenant"],
    REFEREE: ["tenant"],
    PLAYER: ["self"],
  };
}

export function createAuditEvent({ tenant_id, actor_user_id, action, entity_type, metadata = {} } = {}) {
  return {
    id: `audit-${Date.now()}`,
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    metadata,
    created_at: new Date().toISOString(),
  };
}

export function createNotification({ tenant_id, user_id, channel, title, body = "" } = {}) {
  return {
    id: `notification-${Date.now()}`,
    tenant_id,
    user_id,
    channel,
    title,
    body,
    created_at: new Date().toISOString(),
  };
}

export function createSubscription({ tenant_id, plan, status = "active", feature_flags = {} } = {}) {
  return {
    id: `subscription-${Date.now()}`,
    tenant_id,
    plan,
    status,
    feature_flags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createSetting({ tenant_id, key, value, scope = "tenant" } = {}) {
  return {
    id: `setting-${Date.now()}`,
    tenant_id,
    scope,
    key,
    value,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getCorePlatformSeed() {
  return {
    roles: ["SUPER_ADMIN", "TENANT_OWNER", "VENUE_MANAGER", "CLUB_OWNER", "STAFF", "CASHIER", "REFEREE", "PLAYER"],
    permissions: ["tenant.manage", "user.manage", "subscription.manage", "audit.read", "booking.manage", "court.manage", "player.manage", "checkin.manage", "payment.manage", "match.update", "match.view", "player.view.self", "booking.view.self"],
  };
}
