import { getActiveClubId } from "../../../data/club.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { canAccessClub } from "../../../auth/rbac.js";
import { isVenueScopedRole } from "../../../auth/roles.js";
import {
  bindClubVenueRegistry,
  getClubById,
  switchActiveClub,
} from "../../../domain/clubService.js";
import { getVenueById } from "../../../domain/venueService.js";
import { listClubsForTenant } from "../../tenant/guards/tenantGuard.js";
import { loadClubs } from "../../../data/club.js";
import { createClub as createClubOffline } from "./clubOfflineCommandAdapter.js";
import { createClub as createClubCommand } from "./clubTenantService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

function findClubForVenue(venueId) {
  return loadClubs().find((club) => {
    if (club.isDefault) {
      return false;
    }

    return club.venueId === venueId;
  });
}

function syncClubVenueBinding(clubId, venueId) {
  const club = getClubById(clubId);
  if (!club || club.isDefault) {
    return { ok: true };
  }

  if (club.venueId === venueId) {
    return { ok: true, club };
  }

  return bindClubVenueRegistry(clubId, venueId, { skipGuard: true });
}

function isClubWritableForVenueOwner(user, clubId, venueId) {
  const club = getClubById(clubId);
  return canAccessClub(
    user,
    clubId,
    { venueId: club?.venueId || venueId },
    { rbacEnabled: true }
  );
}

function resolveVenueAndTenantForVenueOwner(user) {
  const venueId = user?.venueId || null;
  if (!venueId) {
    return {
      ok: false,
      error: "Tài khoản chưa được gán cơ sở. Liên hệ quản trị viên.",
      code: API_ERROR_CODES.TENANT_MISMATCH,
    };
  }

  const venue = getVenueById(venueId);
  const tenantId = user?.tenantId || venue?.tenantId || null;
  if (!tenantId) {
    return {
      ok: false,
      error: "Tài khoản chưa được gán tổ chức (tenant). Liên hệ quản trị viên.",
      code: API_ERROR_CODES.TENANT_MISMATCH,
    };
  }

  return { ok: true, venueId, tenantId, venue };
}

/**
 * Ensure a venue owner has a writable club — create or bind when needed.
 * Phase 45A.3D: under V2, create goes through clubTenantService → club_create.
 * Wave 5: Club tenant identity is Platform Tenant, not Venue.id.
 */
export async function ensureWritableClubForVenueOwner(user, options = {}) {
  const { activeClubId = getActiveClubId(), switchIfNeeded = true } = options;

  if (!isRbacEnabled() || !user || !isVenueScopedRole(user.role)) {
    return { ok: true, skipped: true };
  }

  const resolved = resolveVenueAndTenantForVenueOwner(user);
  if (!resolved.ok) {
    return resolved;
  }
  const { venueId, tenantId, venue } = resolved;

  let targetClub = findClubForVenue(venueId);
  let wasCreated = false;

  if (!targetClub) {
    const clubName = venue?.name ? `CLB ${venue.name}` : "CLB chính";
    const created = isClubStorageV2Enabled()
      ? await createClubCommand({ name: clubName, tenantId, venueId })
      : createClubOffline(clubName);
    if (!created.ok) {
      return created;
    }
    targetClub = created.club;
    wasCreated = true;

    if (!isClubStorageV2Enabled() && targetClub?.id) {
      const bound = syncClubVenueBinding(targetClub.id, venueId);
      if (!bound.ok) {
        return bound;
      }
      targetClub = bound.club || getClubById(targetClub.id) || targetClub;
    }
  } else if (!isClubStorageV2Enabled()) {
    const synced = syncClubVenueBinding(targetClub.id, venueId);
    if (!synced.ok) {
      return synced;
    }
    targetClub = synced.club || getClubById(targetClub.id) || targetClub;
  }

  // Under V2, cloud-created clubs may not yet be in local blob — skip blob access gate.
  if (!isClubStorageV2Enabled()) {
    if (!isClubWritableForVenueOwner(user, targetClub.id, venueId)) {
      return {
        ok: false,
        error: "Không có quyền truy cập CLB này.",
        code: API_ERROR_CODES.FORBIDDEN,
      };
    }
  }

  const tenantClubs = listClubsForTenant(tenantId);
  const activeWritable =
    activeClubId &&
    (isClubStorageV2Enabled()
      ? activeClubId === targetClub.id
      : tenantClubs.some((club) => club.id === activeClubId) &&
        isClubWritableForVenueOwner(user, activeClubId, venueId));

  if (switchIfNeeded && !activeWritable && targetClub.id !== activeClubId) {
    if (isClubStorageV2Enabled()) {
      // Selection is revalidated by ClubContext after canonical rehydrate.
    } else {
      const switched = switchActiveClub(targetClub.id);
      if (!switched.ok) {
        return switched;
      }
    }
  }

  return {
    ok: true,
    clubId: activeWritable ? activeClubId : targetClub.id,
    created: wasCreated,
    club: targetClub,
  };
}
