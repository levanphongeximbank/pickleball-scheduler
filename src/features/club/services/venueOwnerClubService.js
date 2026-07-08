import { getActiveClubId } from "../../../data/club.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { canAccessClub } from "../../../auth/rbac.js";
import { isVenueScopedRole } from "../../../auth/roles.js";
import {
  bindClubVenueRegistry,
  createClub,
  getClubById,
  switchActiveClub,
} from "../../../domain/clubService.js";
import { getVenueById } from "../../../domain/venueService.js";
import {
  getExplicitTenantIdForClub,
  listClubsForTenant,
} from "../../tenant/guards/tenantGuard.js";
import { loadClubs } from "../../../data/club.js";

function findClubForVenue(venueId) {
  return loadClubs().find((club) => {
    if (club.isDefault) {
      return false;
    }

    if (club.venueId === venueId) {
      return true;
    }

    return getExplicitTenantIdForClub(club.id) === venueId;
  });
}

function syncClubVenueBinding(clubId, venueId) {
  const club = getClubById(clubId);
  if (!club || club.isDefault) {
    return { ok: true };
  }

  const explicitTenant = getExplicitTenantIdForClub(clubId);
  if (club.venueId === venueId && explicitTenant === venueId) {
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

/**
 * Đảm bảo chủ sân có CLB writable thuộc venue — tạo mới hoặc đồng bộ tenant nếu cần.
 */
export function ensureWritableClubForVenueOwner(user, options = {}) {
  const { activeClubId = getActiveClubId(), switchIfNeeded = true } = options;

  if (!isRbacEnabled() || !user || !isVenueScopedRole(user.role)) {
    return { ok: true, skipped: true };
  }

  const venueId = user.venueId || user.tenantId;
  if (!venueId) {
    return {
      ok: false,
      error: "Tài khoản chưa được gán cơ sở. Liên hệ quản trị viên.",
      code: "VENUE_UNASSIGNED",
    };
  }

  let targetClub = findClubForVenue(venueId);
  let wasCreated = false;

  if (!targetClub) {
    const venue = getVenueById(venueId);
    const clubName = venue?.name ? `CLB ${venue.name}` : "CLB chính";
    const created = createClub(clubName);
    if (!created.ok) {
      return created;
    }
    targetClub = created.club;
    wasCreated = true;
  } else {
    const synced = syncClubVenueBinding(targetClub.id, venueId);
    if (!synced.ok) {
      return synced;
    }
    targetClub = synced.club || getClubById(targetClub.id) || targetClub;
  }

  if (!isClubWritableForVenueOwner(user, targetClub.id, venueId)) {
    return {
      ok: false,
      error: "Không có quyền truy cập CLB này.",
      code: "FORBIDDEN",
    };
  }

  const tenantClubs = listClubsForTenant(venueId);
  const activeWritable =
    activeClubId &&
    tenantClubs.some((club) => club.id === activeClubId) &&
    isClubWritableForVenueOwner(user, activeClubId, venueId);

  if (switchIfNeeded && !activeWritable && targetClub.id !== activeClubId) {
    const switched = switchActiveClub(targetClub.id);
    if (!switched.ok) {
      return switched;
    }
  }

  return {
    ok: true,
    clubId: activeWritable ? activeClubId : targetClub.id,
    created: wasCreated,
  };
}
