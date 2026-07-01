export function resolveRuntimeAccess(runtime, user, permission, tenantId, context = {}) {
  if (!runtime?.accessService?.authorize) {
    return {
      allowed: false,
      permission,
      reason: "runtime.access_unavailable",
      context,
    };
  }

  const decision = runtime.accessService.authorize(
    user,
    { tenant_id: tenantId, ...context },
    permission
  );

  return {
    ...decision,
    permission,
    context,
  };
}

export function buildRuntimeAccessState(runtime, user, permission, tenantId, context = {}) {
  const decision = resolveRuntimeAccess(runtime, user, permission, tenantId, context);

  return {
    allowed: decision.allowed,
    canAccess: decision.allowed,
    decision,
    message: decision.allowed
      ? null
      : decision.reason || "Bạn không có quyền thực hiện hành động này.",
  };
}
