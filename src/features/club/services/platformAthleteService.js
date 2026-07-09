import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import {
  ROLES,
  isGlobalRole,
  isPlatformScopedRole,
  normalizeRole,
} from "../../identity/constants/roles.js";
import { listUsers } from "../../identity/services/userManagementService.js";
import { getCurrentUser, isDevAuthAllowed, listDevUsers } from "../../../auth/authService.js";
import { normalizeUser } from "../../../models/user.js";

export const PLATFORM_ATHLETE_LINK_STATUS = Object.freeze({
  LINKED: "linked",
  ACCOUNT_ONLY: "account_only",
});

const DEV_REGISTRY_KEY = "pickleball-dev-user-registry-v1";

export function isPlatformAthleteViewer(role) {
  const normalized = normalizeRole(role);
  return isGlobalRole(normalized) || isPlatformScopedRole(normalized);
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

export function buildOrphanProfileAthletes(profiles, rosterPlayers) {
  const orphans = [];

  for (const profile of profiles || []) {
    if (normalizeRole(profile?.role) !== ROLES.PLAYER) {
      continue;
    }

    if (isProfileLinkedToRoster(profile, rosterPlayers)) {
      continue;
    }

    const userId = String(profile.id || "").trim();
    orphans.push(
      normalizePlayers([
        {
          id: `profile-${userId}`,
          name: profile.displayName || profile.email || "VĐV",
          email: profile.email || "",
          phone: profile.phone || "",
          gender: profile.gender || "",
          level: 3.5,
          rating: 3.5,
          status: profile.status === "suspended" ? "inactive" : "active",
          active: profile.status !== "suspended",
          authUserId: userId,
          clubId: profile.clubId || null,
          tenantId: profile.tenantId || profile.venueId || null,
          sourceClubId: profile.clubId || null,
          clubName: profile.clubId ? "" : "",
          linkStatus: PLATFORM_ATHLETE_LINK_STATUS.ACCOUNT_ONLY,
        },
      ])[0]
    );
  }

  return orphans;
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

export async function getPlatformAthletes() {
  const currentUser = getCurrentUser();
  if (!isPlatformAthleteViewer(currentUser?.role)) {
    return { ok: false, error: "Không có quyền xem VĐV toàn hệ thống.", code: "FORBIDDEN" };
  }

  const rosterPlayers = getClubPlayersPlatformWide();
  const profileResult = await fetchPlayerProfiles();

  if (!profileResult.ok) {
    return profileResult;
  }

  const orphanPlayers = buildOrphanProfileAthletes(profileResult.profiles, rosterPlayers);
  const players = sortByName([...rosterPlayers, ...orphanPlayers]);

  const accountOnlyCount = orphanPlayers.length;
  const rosterCount = rosterPlayers.length;

  return {
    ok: true,
    players,
    stats: {
      total: players.length,
      rosterCount,
      accountOnlyCount,
      linkedCount: rosterCount,
    },
    partial: Boolean(profileResult.partial),
    warning: profileResult.warning || null,
  };
}
