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

/** Normalize club_list_members row → auth user id (snake/camel). */
export function resolveMembershipAuthUserId(member = {}) {
  return String(
    member.user_id || member.userId || member.authUserId || member.auth_user_id || ""
  ).trim();
}

function isActiveMembershipStatus(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

function collectLinkedUserIdsFromPlayers(players = []) {
  const linkedUserIds = new Set();
  for (const player of players) {
    const authUserId = String(player?.authUserId || "").trim();
    if (authUserId) {
      linkedUserIds.add(authUserId);
    }
    const id = String(player?.id || "").trim();
    if (id.startsWith("profile-")) {
      const fromId = id.slice("profile-".length).trim();
      if (fromId) {
        linkedUserIds.add(fromId);
      }
    }
  }
  return linkedUserIds;
}

function mergeLinkedUserIdSets(...sets) {
  const merged = new Set();
  for (const set of sets) {
    if (!set) continue;
    for (const value of set) {
      const id = String(value || "").trim();
      if (id) merged.add(id);
    }
  }
  return merged;
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
  const memberErrors = [];

  for (const club of registry.clubs || []) {
    if (!club?.id || club.isDefault) {
      continue;
    }
    const membersResult = await rpcV2ClubListMembers(club.id);
    if (!membersResult.ok) {
      memberErrors.push(membersResult.error || `club_list_members failed (${club.id})`);
      continue;
    }
    for (const member of membersResult.members || []) {
      if (!isActiveMembershipStatus(member.status || member.membershipStatus)) {
        continue;
      }
      const userId = resolveMembershipAuthUserId(member);
      if (!userId) {
        continue;
      }
      linkedUserIds.add(userId);
      if (byAuthUser.has(userId)) {
        continue;
      }
      const athleteId = member.athlete_id || member.athleteId || null;
      byAuthUser.set(
        userId,
        normalizePlayers([
          {
            // Canonical profile route (athlete-{id} bookmarks still resolve via loader).
            id: `profile-${userId}`,
            name:
              member.display_name ||
              member.displayName ||
              member.email ||
              "VĐV",
            email: member.email || "",
            authUserId: userId,
            athleteId,
            clubId: club.id,
            sourceClubId: club.id,
            clubName: club.name,
            tenantId: club.venueId || club.tenantId || null,
            linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
            membershipStatus: member.status || member.membershipStatus || "active",
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

  return {
    players: Array.from(byAuthUser.values()),
    linkedUserIds,
    warning: memberErrors.length ? memberErrors[0] : null,
  };
}

function buildPlayerIdForUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

function normalizeEmailKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isProfileLinkedToRoster(profile, rosterPlayers, linkedUserIds = null) {
  const userId = String(profile?.id || "").trim();
  if (!userId) {
    return false;
  }

  if (linkedUserIds?.has(userId)) {
    return true;
  }

  const profilePlayerId = String(profile?.playerId || profile?.player_id || "").trim();
  const expectedPlayerId = buildPlayerIdForUser(userId);
  const profileEmail = normalizeEmailKey(profile?.email);
  const profileRouteId = `profile-${userId}`;

  return rosterPlayers.some((player) => {
    const authUserId = String(player.authUserId || "").trim();
    const playerId = String(player.id || "").trim();
    const playerEmail = normalizeEmailKey(player.email);
    return (
      (authUserId && authUserId === userId) ||
      playerId === profileRouteId ||
      (profilePlayerId && playerId === profilePlayerId) ||
      playerId === expectedPlayerId ||
      (profileEmail && playerEmail && profileEmail === playerEmail)
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
 * Always merge Club Storage V2 active members so linkStatus is not blob-only.
 */
export async function getClubPlayersPlatformWideAware(options = {}) {
  const v2 = await getV2MembershipLinkedPlayers();

  if (!isCanonicalPlayerRepositoryEnabled(options.envSource)) {
    // Legacy path (canonical flag OFF, Production default): blob roster merged
    // with V2 membership so V2-only athletes still resolve without legacy blob.
    const blobRoster = getClubPlayersPlatformWide();
    const rosterByKey = new Map();

    for (const player of blobRoster) {
      const key = player.authUserId || player.id;
      rosterByKey.set(String(key), {
        ...player,
        linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
      });
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
          email: existing.email || player.email || "",
          authUserId: existing.authUserId || player.authUserId || null,
        });
      }
    }

    const players = Array.from(rosterByKey.values());
    return {
      ok: true,
      players,
      source: v2.players.length ? "legacy_blob+v2_membership" : "legacy_blob",
      mappingSummary: null,
      warnings: [],
      linkedUserIds: mergeLinkedUserIdSets(
        v2.linkedUserIds,
        collectLinkedUserIdsFromPlayers(players)
      ),
      v2Warning: v2.warning || null,
    };
  }

  const clubsResult = await listSourceClubsAware({
    tenantId: options.tenantId || null,
    userContext: options.userContext || { isPlatformAdmin: true },
  });
  if (!clubsResult.ok) {
    // Fall back to V2 membership roster so members are not mislabeled account_only.
    if (v2.players.length > 0) {
      return {
        ok: true,
        players: v2.players,
        source: "v2_membership_fallback",
        mappingSummary: null,
        warnings: [
          {
            code: clubsResult.code || "CLUB_LIST_FAILED",
            meta: { message: clubsResult.message || clubsResult.error },
          },
        ],
        linkedUserIds: mergeLinkedUserIdSets(v2.linkedUserIds),
        v2Warning: v2.warning || clubsResult.message || clubsResult.error || null,
      };
    }
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

  for (const player of v2.players) {
    let matchedExistingId = null;
    for (const [existingId, existing] of byId.entries()) {
      if (
        (existing.authUserId &&
          player.authUserId &&
          existing.authUserId === player.authUserId) ||
        existing.id === player.id
      ) {
        matchedExistingId = existingId;
        break;
      }
    }
    if (matchedExistingId) {
      const existing = byId.get(matchedExistingId);
      byId.set(matchedExistingId, {
        ...existing,
        ...player,
        id: existing.id,
        linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
        athleteId: player.athleteId || existing.athleteId || null,
        clubName: existing.clubName || player.clubName,
        email: existing.email || player.email || "",
        authUserId: existing.authUserId || player.authUserId || null,
      });
      continue;
    }
    byId.set(player.id, player);
  }

  const players = normalizePlayers(Array.from(byId.values()));
  return {
    ok: true,
    players,
    source: "membership_ssot",
    warnings,
    mappingSummary: {
      mappedPlayers,
      unmappedMembers,
      derivedPlayers,
      duplicatesRemoved,
      activeMembers: mappedPlayers + unmappedMembers + derivedPlayers,
    },
    linkedUserIds: mergeLinkedUserIdSets(
      v2.linkedUserIds,
      collectLinkedUserIdsFromPlayers(players)
    ),
    v2Warning: v2.warning || null,
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
  const linkedUserIds = mergeLinkedUserIdSets(
    rosterResult.linkedUserIds,
    collectLinkedUserIdsFromPlayers(rosterPlayers)
  );
  const profileResult = await fetchPlayerProfiles();

  if (!profileResult.ok) {
    return profileResult;
  }

  const orphanPlayers = await buildOrphanProfileAthletesAsync(
    profileResult.profiles,
    rosterPlayers,
    linkedUserIds
  );

  // Prefer membership/roster rows over orphan account_only when ids collide.
  const byId = new Map();
  for (const player of orphanPlayers) {
    byId.set(String(player.id), player);
  }
  for (const player of rosterPlayers) {
    byId.set(String(player.id), {
      ...player,
      linkStatus: PLATFORM_ATHLETE_LINK_STATUS.LINKED,
    });
  }
  const players = sortByName(Array.from(byId.values()));
  const accountOnlyCount = players.filter(
    (player) => player.linkStatus === PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY
  ).length;
  const linkedCount = players.length - accountOnlyCount;

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
      accountOnlyCount,
      linkedCount,
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
