import { loadClubs } from "../../../data/club.js";
import { canAccessClub } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { filterByTenant } from "../../tenant/guards/tenantGuard.js";
import { API_ERROR_CODES } from "../constants/apiErrors.js";

function createScopeError(message, code = API_ERROR_CODES.FORBIDDEN) {
  return Object.assign(new Error(message), {
    statusCode: 403,
    code,
  });
}

/**
 * Resolve club IDs the authenticated API caller may read for a tenant.
 */
export function resolveAllowedClubIds({ tenantId, user, rbacEnabled = isRbacEnabled() }) {
  const clubs = filterByTenant(loadClubs(), tenantId);

  if (!user || !rbacEnabled) {
    return new Set(clubs.map((club) => club.id));
  }

  return new Set(
    clubs
      .filter((club) =>
        canAccessClub(user, club.id, { venueId: club.venueId || null }, { rbacEnabled })
      )
      .map((club) => club.id)
  );
}

export function assertClubInScope(clubId, ctx) {
  const trimmed = String(clubId || "").trim();
  if (!trimmed) {
    throw createScopeError("Thiếu clubId.", "CLUB_REQUIRED");
  }

  const allowed = resolveAllowedClubIds({
    tenantId: ctx.auth?.tenantId,
    user: ctx.auth?.user,
  });

  if (!allowed.has(trimmed)) {
    throw createScopeError("CLB ngoài phạm vi cho phép.", "CLUB_OUT_OF_SCOPE");
  }

  return trimmed;
}

/**
 * Resolve effective clubId for list handlers — validates query param when present.
 */
export function resolveScopedClubId(ctx) {
  const tenantId = ctx.auth?.tenantId;
  const clubs = filterByTenant(loadClubs(), tenantId);
  const requested = ctx.query?.clubId;

  if (requested) {
    return assertClubInScope(requested, ctx);
  }

  const allowed = resolveAllowedClubIds({
    tenantId,
    user: ctx.auth?.user,
  });

  const first = clubs.find((club) => allowed.has(club.id));
  return first?.id || null;
}
