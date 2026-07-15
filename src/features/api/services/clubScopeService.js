import { canAccessClub } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { filterByTenant } from "../../tenant/guards/tenantGuard.js";
import { API_ERROR_CODES } from "../constants/apiErrors.js";
import {
  getScopedClubsForAuthz,
  hydrateClubScope,
} from "../../../auth/clubScopeResolver.js";

function createScopeError(message, code = API_ERROR_CODES.FORBIDDEN) {
  return Object.assign(new Error(message), {
    statusCode: 403,
    code,
  });
}

/**
 * Resolve canonical club scope for the API caller before any scope check.
 * Handlers must await this; the synchronous guards below then read the resolved
 * snapshot. Server-side resolution is independent of any client-supplied clubId.
 */
export async function hydrateApiClubScope(ctx) {
  return hydrateClubScope({
    user: ctx?.auth?.user || null,
    tenantId: ctx?.auth?.tenantId || null,
  });
}

/**
 * Resolve club IDs the authenticated API caller may read for a tenant.
 * Sourced from the canonical club registry (cloud-authoritative when configured);
 * never from the legacy local registry when the cloud is authoritative.
 */
export function resolveAllowedClubIds({ tenantId, user, rbacEnabled = isRbacEnabled() }) {
  const { clubs, cloudAuthoritative, ready } = getScopedClubsForAuthz({ user, tenantId });

  // Cloud registry authoritative but unresolved (loading / error) → deny (empty scope).
  if (cloudAuthoritative && !ready) {
    return new Set();
  }

  const scoped = filterByTenant(clubs, tenantId);

  if (!user || !rbacEnabled) {
    return new Set(scoped.map((club) => club.id));
  }

  return new Set(
    scoped
      .filter((club) =>
        canAccessClub(user, club.id, { venueId: club.venueId || null }, { rbacEnabled })
      )
      .map((club) => club.id)
  );
}

export function assertClubInScope(clubId, ctx) {
  const trimmed = String(clubId || "").trim();
  if (!trimmed) {
    throw createScopeError("Thiếu clubId.", API_ERROR_CODES.CLUB_REQUIRED);
  }

  const allowed = resolveAllowedClubIds({
    tenantId: ctx.auth?.tenantId,
    user: ctx.auth?.user,
  });

  if (!allowed.has(trimmed)) {
    throw createScopeError("CLB ngoài phạm vi cho phép.", API_ERROR_CODES.CLUB_OUT_OF_SCOPE);
  }

  return trimmed;
}

/**
 * Resolve effective clubId for list handlers — validates query param when present.
 * Never trusts a client-supplied clubId without verifying it against canonical scope.
 */
export function resolveScopedClubId(ctx) {
  const tenantId = ctx.auth?.tenantId;
  const requested = ctx.query?.clubId;

  if (requested) {
    return assertClubInScope(requested, ctx);
  }

  const { clubs, cloudAuthoritative, ready } = getScopedClubsForAuthz({
    user: ctx.auth?.user,
    tenantId,
  });

  if (cloudAuthoritative && !ready) {
    return null;
  }

  const scoped = filterByTenant(clubs, tenantId);
  const allowed = resolveAllowedClubIds({ tenantId, user: ctx.auth?.user });
  const first = scoped.find((club) => allowed.has(club.id));
  return first?.id || null;
}
