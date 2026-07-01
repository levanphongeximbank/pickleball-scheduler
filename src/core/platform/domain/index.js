export function createTenantEntity(input = {}) {
  const tenantId = input.tenant_id || input.id || `tenant-${Date.now()}`;

  return {
    id: tenantId,
    tenant_id: tenantId,
    name: input.name || "Unnamed tenant",
    plan: input.plan || "trial",
    status: input.status || "active",
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  };
}

export function createUserEntity(input = {}) {
  const userId = input.user_id || input.id || `user-${Date.now()}`;

  return {
    id: userId,
    user_id: userId,
    email: input.email || "",
    role: input.role || "PLAYER",
    tenant_id: input.tenant_id || null,
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  };
}

export function toTenantDto(entity = {}) {
  return {
    id: entity.id,
    tenantId: entity.tenant_id,
    name: entity.name,
    plan: entity.plan,
    status: entity.status,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function toTenantViewModel(entity = {}) {
  return {
    id: entity.id,
    tenantId: entity.tenant_id,
    displayName: entity.name,
    planLabel: entity.plan,
    statusLabel: entity.status,
  };
}

export function toUserDto(entity = {}) {
  return {
    id: entity.id,
    userId: entity.user_id,
    email: entity.email,
    role: entity.role,
    tenantId: entity.tenant_id,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

export function toUserViewModel(entity = {}) {
  return {
    id: entity.id,
    userId: entity.user_id,
    displayName: entity.email || entity.user_id,
    role: entity.role,
    tenantId: entity.tenant_id,
  };
}

export function createDomainProjection(entity, { dto = false, viewModel = false } = {}) {
  if (viewModel) {
    return entity?.tenant_id ? toTenantViewModel(entity) : toUserViewModel(entity);
  }

  if (dto) {
    return entity?.tenant_id ? toTenantDto(entity) : toUserDto(entity);
  }

  return entity;
}

export function buildPhase2DomainSummary({ tenant, user, subscription } = {}) {
  return {
    tenantId: tenant?.tenant_id || tenant?.id || null,
    tenantName: tenant?.name || null,
    role: user?.role || null,
    plan: subscription?.plan || tenant?.plan || null,
    status: subscription?.status || tenant?.status || null,
  };
}
