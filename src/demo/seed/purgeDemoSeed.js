import { getActiveClubId, loadClubs, saveClubs, setActiveClubId } from "../../data/club.js";
import { loadVenues, saveVenues } from "../../data/venue.js";
import { clearActiveTenantId, loadActiveTenantId } from "../../data/tenantSession.js";
import { purgeClubData } from "../../domain/clubStorage.js";
import { purgeClubExtension } from "../../features/club/storage/clubExtensionStorage.js";
import {
  disableDemoSeedAutoApply,
  getDemoSeedClubIds,
  getDemoSeedTenantIds,
} from "./demoSeedRegistry.js";

/**
 * Xóa toàn bộ CLB/tenant/VĐV demo (multi-tenant seed, club management seed, roster demo).
 * Chặn auto-seed chạy lại sau khi dọn.
 */
export function purgeDemoSeedData() {
  const tenantIds = new Set(getDemoSeedTenantIds());
  const clubIds = new Set(getDemoSeedClubIds());

  for (const clubId of clubIds) {
    purgeClubData(clubId);
    purgeClubExtension(clubId);
  }

  const remainingClubs = loadClubs().filter((club) => !clubIds.has(club.id));
  saveClubs(remainingClubs);

  const remainingVenues = loadVenues().filter((venue) => !tenantIds.has(venue.id));
  saveVenues(remainingVenues);

  const activeClubId = getActiveClubId();
  if (clubIds.has(activeClubId)) {
    const fallback =
      remainingClubs.find((club) => !club.isDefault) ||
      remainingClubs.find((club) => club.isDefault) ||
      remainingClubs[0] ||
      null;

    if (fallback?.id) {
      setActiveClubId(fallback.id);
    }
  }

  const activeTenantId = loadActiveTenantId();
  if (activeTenantId && tenantIds.has(activeTenantId)) {
    clearActiveTenantId();
  }

  disableDemoSeedAutoApply();

  return {
    ok: true,
    removedClubIds: Array.from(clubIds),
    removedTenantIds: Array.from(tenantIds),
    remainingClubCount: remainingClubs.length,
  };
}
