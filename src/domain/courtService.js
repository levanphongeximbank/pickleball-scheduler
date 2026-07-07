import { loadClubs } from "../data/club.js";
import { loadCourtsForClub } from "./clubStorage.js";import { filterByTenant } from "../features/tenant/guards/tenantGuard.js";

export function filterCourtsByTenant(courts = [], tenantId) {
  return filterByTenant(courts, tenantId);
}

/**
 * Gộp courts từ mọi CLB thuộc venue, kèm clubId/clubName để hiển thị.
 */
export function loadCourtsForVenue(venueId) {
  if (!venueId) {
    return [];
  }

  const clubs = loadClubs().filter((club) => club.venueId === venueId);
  const courts = [];

  clubs.forEach((club) => {
    loadCourtsForClub(club.id).forEach((court) => {
      courts.push({
        ...court,
        clubId: club.id,
        clubName: club.name || club.id,
      });
    });
  });

  return courts;
}

/** Courts thuộc venue, lọc tenant và chỉ sân active. */
export function loadCourtsForVenueScoped(venueId, tenantId) {
  const courts = loadCourtsForVenue(venueId);
  return filterCourtsByTenant(courts, tenantId).filter((court) => court.active !== false);
}

/** Courts của một CLB, lọc tenant. */
export function loadCourtsForClubScoped(clubId, tenantId) {
  if (!clubId) {
    return [];
  }

  const club = loadClubs().find((item) => item.id === clubId);
  if (tenantId && club?.venueId && club.venueId !== tenantId) {
    return [];
  }

  const courts = loadCourtsForClub(clubId);
  return filterCourtsByTenant(courts, tenantId).filter((court) => court.active !== false);
}
