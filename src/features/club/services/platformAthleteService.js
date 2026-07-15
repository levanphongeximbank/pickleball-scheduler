import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { isDemoSeedPlayer, shouldHideDemoSeedData } from "../../../demo/seed/demoSeedRegistry.js";
import { enrichAccountOnlyAthletes } from "./accountOnlyAthleteService.js";
import {
  ROLES,
  isPlatformWideRole,
  normalizeRole,
} from "../../identity/constants/roles.js";
import { listUsers } from "../../identity/services/userManagementService.js";
import { getCurrentUser, isDevAuthAllowed, listDevUsers } from "../../../auth/authService.js";
import { normalizeUser } from "../../../models/user.js";
import { isCanonicalPlayerRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import {
  listPlayersForClubAware,
  listSourceClubsAware,
} from "../repositories/canonicalPlayerPickerAdapter.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  rpcV2ClubListMembers,
  rpcV2ClubListRegistry,
} from "./clubStorageV2RpcService.js";

export const PLATFORM_ATHLETE_LINK_STATUS = Object.freeze({
  LINKED: "linked",
  ACCOUNT_ONLY: "account_only",
});

const DEV_REGISTRY_KEY = "pickleball-dev-user-registry-v1";

export function isPlatformAthleteViewer(role) {
  return isPlatformWideRole(role);
}

function loadDevRegistryUsers() {
  try {
    const raw = localStorage.getItem(DEV_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((user) => normalizeUser(user)) : [];
  } catch {
    return [];
  }
}

function mergeDevPlayerProfiles() {
  const map = new Map();
  listDevUsers().forEach((user) => map.set(user.email, user));
  loadDevRegistryUsers().forEach((user) => map.set(user.email, user));
  return Array.from(map.values()).filter(
    (user) => normalizeRole(user.role) === ROLES.PLAYER
  );
}

function sortByName(players) {
  return [...players].sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""), "vi")
  );
}

export function getClubPlayersPlatformWide() {
  const byId = new Map();

  for (const club of loadClubs()) {
    if (club?.isDefault) {
      continue;
    }

    const data = loadClubData(club.id);
    const tenantId = club.venueId || club.tenantId || data.tenantId || null;

    for (const player of data.players || []) {
      if (shouldHideDemoSeedData() && isDemoSeedPlayer(player, club.id)) {
        continue;
      }

      if (byId.has(player.id)) {
        continue;
      }

      byId.set(player.id, {
        ...player,
        sourceClubId: club.id,
        clubName: player.clubName || club.name,
        tenantId,
        linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
      });
    }
  }

  return normalizePlayers(Array.from(byId.values()));
}

async function getV2MembershipLinkedPlayers() {
  if (!isClubStorageV2Enabled()) {
    return { players: [], linkedUserIds: new Set() };
  }

  const registry = await rpcV2ClubListRegistry({ includeInactive: false });
  if (!registry.ok) {
    return { players: [], linkedUserIds: new Set(), warning: registry.error };
  }

  const byAuthUser = new Map();
  const linkedUserIds = new Set();

  for (const club of registry.clubs || []) {
    if (!club?.id || club.isDefault) {
      continue;
    }
    const membersResult = await rpcV2ClubListMembers(club.id);
    if (!membersResult.ok) {
      continue;
    }
    for (const member of membersResult.members || []) {
      if (String(member.status || "").toLowerCase() !== "active") {
        continue;
      }
      const userId = String(member.user_id || "").trim();
      if (!userId) {
        continue;
      }
      linkedUserIds.add(userId);
      if (byAuthUser.has(userId)) {
        continue;
      }
      const athleteId = member.athlete_id || null;
      byAuthUser.set(
        userId,
        normalizePlayers([
          {
            // Canonical profile route (athlete-{id} bookmarks still resolve via loader).
            id: `profile-${userId}`,
            name: member.display_name || member.email || "VĐV",
            email: member.email || "",
            authUserId: userId,
            athleteId,
            clubId: club.id,
            sourceClubId: club.id,
            clubName: club.name,
            tenantId: club.venueId || club.tenantId || null,
            linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
            membershipStatus: member.status,
            membershipId: member.id,
            rating_status: "unrated",
            level: null,
            rating: null,
            skillLevel: null,
            playerType: null,
          },
        ])[0]
      );
    }
  }

  return { players: Array.from(byAuthUser.values()), linkedUserIds };
}

function buildPlayerIdForUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

function isProfileLinkedToRoster(profile, rosterPlayers, linkedUserIds = null) {
  const userId = String(profile?.id || "").trim();
  if (!userId) {
    return false;
  }

  if (linkedUserIds?.has(userId)) {
    return true;
  }

  const profilePlayerId = String(profile?.playerId || "").trim();
  const expectedPlayerId = buildPlayerIdForUser(userId);

  return rosterPlayers.some((player) => {
    const authUserId = String(player.authUserId || "").trim();
    const playerId = String(player.id || "").trim();
    return (
      (authUserId && authUserId === userId) ||
      (profilePlayerId && playerId === profilePlayerId) ||
      playerId === expectedPlayerId
    );
  });
}

function collectOrphanProfiles(profiles, rosterPlayers, linkedUserIds = null) {
  const pending = [];

  for (const profile of profiles || []) {
    if (normalizeRole(profile?.role) !== ROLES.PLAYER) {
      continue;
    }

    if (isProfileLinkedToRoster(profile, rosterPlayers, linkedUserIds)) {
      continue;
    }

    pending.push(profile);
  }

  return pending;
}

export async function buildOrphanProfileAthletesAsync(profiles, rosterPlayers, linkedUserIds = null) {
  return enrichAccountOnlyAthletes(collectOrphanProfiles(profiles, rosterPlayers, linkedUserIds));
}

/** Sync fallback for tests — không enrich rating từ RPC. */
export function buildOrphanProfileAthletes(profiles, rosterPlayers, linkedUserIds = null) {
  return collectOrphanProfiles(profiles, rosterPlayers, linkedUserIds).map((profile) => {
    const userId = String(profile.id || "").trim();
    return normalizePlayers([
      {
        id: `profile-${userId}`,
        name: profile.displayName || profile.email || "VĐV",
        email: profile.email || "",
        phone: profile.phone || "",
        gender: profile.gender || "",
        status: profile.status === "suspended" ? "inactive" : "active",
        active: profile.status !== "suspended",
        authUserId: userId,
        clubId: profile.clubId || null,
        tenantId: profile.tenantId || profile.venueId || null,
        sourceClubId: profile.clubId || null,
        clubName: "",
        linkStatus: PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY,
        rating_status: "unrated",
        level: null,
        rating: null,
        skillLevel: null,
        playerType: null,
      },
    ])[0];
  });
}

async function fetchPlayerProfiles() {
  const listResult = await listUsers({ role: ROLES.PLAYER });
  if (listResult.ok) {
    return { ok: true, profiles: listResult.users || [] };
  }

  const currentUser = getCurrentUser();
  if (!isPlatformAthleteViewer(currentUser?.role)) {
    return listResult;
  }

  if (isDevAuthAllowed()) {
    return { ok: true, profiles: mergeDevPlayerProfiles(), provider: "dev" };
  }

  return {
    ok: true,
    profiles: [],
    partial: true,
    warning:
      "Không tải được danh sách tài khoản VĐV từ server. Chỉ hiển thị VĐV trong danh sách CLB trên thiết bị này.",
    profileError: listResult.error || null,
  };
}

/**
 * Platform roster half — membership SSOT when canonical player flag ON.
 */
export async function getClubPlayersPlatformWideAware(options = {}) {
  if (!isCanonicalPlayerRepositoryEnabled(options.envSource)) {
    // Legacy path (canonical flag OFF, Production default): blob roster merged
    // with V2 membership so V2-only athletes still resolve without legacy blob.
    const blobRoster = getClubPlayersPlatformWide();
    const v2 = await getV2MembershipLinkedPlayers();
    const rosterByKey = new Map();

    for (const player of blobRoster) {
      const key = player.authUserId || player.id;
      rosterByKey.set(String(key), player);
    }
    for (const player of v2.players) {
      const key = player.authUserId || player.id;
      if (!rosterByKey.has(String(key))) {
        rosterByKey.set(String(key), player);
      } else {
        const existing = rosterByKey.get(String(key));
        rosterByKey.set(String(key), {
          ...existing,
          ...player,
          linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
          athleteId: player.athleteId || existing.athleteId || null,
          clubName: existing.clubName || player.clubName,
        });
      }
    }

    return {
      ok: true,
      players: Array.from(rosterByKey.values()),
      source: "legacy_blob",
      mappingSummary: null,
      warnings: [],
      linkedUserIds: v2.linkedUserIds || new Set(),
      v2Warning: v2.warning || null,
    };
  }

  const clubsResult = await listSourceClubsAware({
    tenantId: options.tenantId || null,
    userContext: options.userContext || { isPlatformAdmin: true },
  });
  if (!clubsResult.ok) {
    return { ok: false, error: clubsResult.message || clubsResult.code, players: [] };
  }

  const byId = new Map();
  const warnings = [...(clubsResult.warnings || [])];
  let mappedPlayers = 0;
  let unmappedMembers = 0;
  let derivedPlayers = 0;
  let duplicatesRemoved = 0;

  for (const club of clubsResult.data || []) {
    const playersResult = await listPlayersForClubAware(club.id, {
      tenantId: club.tenantId || options.tenantId || null,
      userContext: options.userContext || { isPlatformAdmin: true },
      profilesByUserId: options.profilesByUserId,
      includeUnmappedInData: true,
    });
    if (!playersResult.ok) {
      warnings.push({
        code: playersResult.code || "PLAYER_LIST_FAILED",
        meta: { clubId: club.id },
      });
      continue;
    }
    warnings.push(...(playersResult.warnings || []));
    mappedPlayers += playersResult.mappingSummary?.mappedPlayers || 0;
    unmappedMembers += playersResult.mappingSummary?.unmappedMembers || 0;
    derivedPlayers += playersResult.mappingSummary?.derivedPlayers || 0;
    duplicatesRemoved += playersResult.mappingSummary?.duplicatesRemoved || 0;

    for (const player of playersResult.legacyPlayers || []) {
      if (byId.has(player.id)) continue;
      byId.set(player.id, {
        ...player,
        sourceClubId: club.id,
        clubName: player.clubName || club.name,
        linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
      });
    }
  }

  return {
    ok: true,
    players: normalizePlayers(Array.from(byId.values())),
    source: "membership_ssot",
    warnings,
    mappingSummary: {
      mappedPlayers,
      unmappedMembers,
      derivedPlayers,
      duplicatesRemoved,
      activeMembers: mappedPlayers + unmappedMembers + derivedPlayers,
    },
    // Canonical roster already includes linked members; orphan exclusion relies
    // on roster presence, so no extra linkedUserIds set is required here.
    linkedUserIds: new Set(),
  };
}

export async function getPlatformAthletes(options = {}) {
  const currentUser = getCurrentUser();
  if (!isPlatformAthleteViewer(currentUser?.role)) {
    return { ok: false, error: "Không có quyền xem VĐV toàn hệ thống.", code: "FORBIDDEN" };
  }

  const rosterResult = await getClubPlayersPlatformWideAware({
    ...options,
    userContext: { user: currentUser, isPlatformAdmin: true },
  });
  if (!rosterResult.ok) {
    return rosterResult;
  }
  const rosterPlayers = rosterResult.players || [];
  const linkedUserIds = rosterResult.linkedUserIds || new Set();
  const profileResult = await fetchPlayerProfiles();

  if (!profileResult.ok) {
    return profileResult;
  }

  const orphanPlayers = await buildOrphanProfileAthletesAsync(
    profileResult.profiles,
    rosterPlayers,
    linkedUserIds
  );
  const players = sortByName([...rosterPlayers, ...orphanPlayers]);

  const unmappedNote =
    rosterResult.mappingSummary?.unmappedMembers > 0
      ? ` · ${rosterResult.mappingSummary.unmappedMembers} thành viên active chưa map playerId`
      : "";

  return {
    ok: true,
    players,
    stats: {
      total: players.length,
      rosterCount: rosterPlayers.length,
      accountOnlyCount: orphanPlayers.length,
      linkedCount: rosterPlayers.length,
      mappedPlayers: rosterResult.mappingSummary?.mappedPlayers,
      unmappedMembers: rosterResult.mappingSummary?.unmappedMembers,
      derivedPlayers: rosterResult.mappingSummary?.derivedPlayers,
    },
    mappingSummary: rosterResult.mappingSummary || null,
    source: rosterResult.source || null,
    warnings: rosterResult.warnings || [],
    partial: Boolean(profileResult.partial),
    warning:
      `${profileResult.warning || ""}${unmappedNote}`.trim() ||
      rosterResult.v2Warning ||
      null,
  };
}
