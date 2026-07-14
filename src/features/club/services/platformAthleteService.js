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

function buildPlayerIdForUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

function isProfileLinkedToRoster(profile, rosterPlayers) {
  const userId = String(profile?.id || "").trim();
  if (!userId) {
    return false;
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

function collectOrphanProfiles(profiles, rosterPlayers) {
  const pending = [];

  for (const profile of profiles || []) {
    if (normalizeRole(profile?.role) !== ROLES.PLAYER) {
      continue;
    }

    if (isProfileLinkedToRoster(profile, rosterPlayers)) {
      continue;
    }

    pending.push(profile);
  }

  return pending;
}

export async function buildOrphanProfileAthletesAsync(profiles, rosterPlayers) {
  return enrichAccountOnlyAthletes(collectOrphanProfiles(profiles, rosterPlayers));
}

/** Sync fallback for tests — không enrich rating từ RPC. */
export function buildOrphanProfileAthletes(profiles, rosterPlayers) {
  return collectOrphanProfiles(profiles, rosterPlayers).map((profile) => {
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
    return {
      ok: true,
      players: getClubPlayersPlatformWide(),
      source: "legacy_blob",
      mappingSummary: null,
      warnings: [],
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
  const profileResult = await fetchPlayerProfiles();

  if (!profileResult.ok) {
    return profileResult;
  }

  const orphanPlayers = await buildOrphanProfileAthletesAsync(
    profileResult.profiles,
    rosterPlayers
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
    warning: `${profileResult.warning || ""}${unmappedNote}`.trim() || null,
  };
}
