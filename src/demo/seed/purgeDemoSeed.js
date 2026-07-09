import { getActiveClubId, loadClubs, saveClubs, setActiveClubId } from "../../data/club.js";
import {
  loadClusterAssignments,
  loadCourtClusters,
  saveClusterAssignments,
  saveCourtClusters,
} from "../../data/courtCluster.js";
import { loadVenues, saveVenues } from "../../data/venue.js";
import { clearActiveTenantId, loadActiveTenantId } from "../../data/tenantSession.js";
import { CLUB_DATA_KEY, purgeClubData } from "../../domain/clubStorage.js";
import { purgeClubExtension } from "../../features/club/storage/clubExtensionStorage.js";
import {
  disableDemoSeedAutoApply,
  getDemoSeedClubIds,
  getDemoSeedTenantIds,
  isDemoSeedClubId,
  isDemoSeedPlayer,
  purgeAllDemoStorageKeys,
} from "./demoSeedRegistry.js";

function stripDemoPlayersFromStoredClubBlobs() {
  const prefix = `${CLUB_DATA_KEY}::`;
  let strippedPlayers = 0;

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const clubId = key.slice(prefix.length);
    if (isDemoSeedClubId(clubId)) {
      localStorage.removeItem(key);
      continue;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      const data = JSON.parse(raw);
      const players = Array.isArray(data?.players) ? data.players : null;
      if (!players) {
        continue;
      }

      const filtered = players.filter((player) => !isDemoSeedPlayer(player, clubId));
      if (filtered.length === players.length) {
        continue;
      }

      strippedPlayers += players.length - filtered.length;
      data.players = filtered;
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // ignore malformed blobs
    }
  }

  return strippedPlayers;
}

/**
 * Xóa toàn bộ CLB/tenant/VĐV demo (multi-tenant seed, club management seed, roster demo).
 * Chặn auto-seed chạy lại sau khi dọn.
 */
export function purgeDemoSeedData() {
  const removedKeyCount = purgeAllDemoStorageKeys();

  const tenantIds = new Set(getDemoSeedTenantIds());
  const clubIds = new Set(getDemoSeedClubIds());

  for (const clubId of clubIds) {
    purgeClubData(clubId);
    purgeClubExtension(clubId);
  }

  const strippedPlayers = stripDemoPlayersFromStoredClubBlobs();

  const remainingClubs = loadClubs().filter((club) => !clubIds.has(club.id));
  saveClubs(remainingClubs);

  const remainingVenues = loadVenues().filter((venue) => !tenantIds.has(venue.id));
  saveVenues(remainingVenues);

  const remainingClusters = loadCourtClusters().filter((cluster) => !tenantIds.has(cluster.venueId));
  let removedClusterCount = loadCourtClusters().length - remainingClusters.length;
  if (removedClusterCount > 0) {
    saveCourtClusters(remainingClusters);
    const keptClusterIds = new Set(remainingClusters.map((cluster) => cluster.id));
    saveClusterAssignments(
      loadClusterAssignments().filter((assignment) => keptClusterIds.has(assignment.clusterId))
    );
  }

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
    removedClusterCount,
    remainingClubCount: remainingClubs.length,
    removedKeyCount,
    strippedPlayers,
  };
}
