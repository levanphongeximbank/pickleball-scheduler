import { normalizeUser } from "../../../models/user.js";
import { normalizePlayers } from "../../../models/player.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  buildAccountOnlyPlayerId,
  enrichAccountOnlyAthlete,
  loadAccountOnlyAthleteProfile,
  parsePlatformAthleteRouteId,
} from "./accountOnlyAthleteService.js";
import { rpcPlatformResolveAthleteProfile } from "./clubStorageV2RpcService.js";
import { loadPlayerHistoryProfileResolved } from "../../../tournament/engines/playerHistoryEngine.js";

/**
 * Resolve player profile for platform/admin UI using Club Storage V2 SSOT:
 * profiles + athletes + club_members (never profiles.club_id alone).
 */

export function isAccountOnlyByV2Data({ activeMemberships = [], athlete = null } = {}) {
  const hasMembership = Array.isArray(activeMemberships) && activeMemberships.length > 0;
  return !hasMembership && !athlete;
}

export function pickPrimaryMembership(activeMemberships = [], preferredClubId = null) {
  const list = Array.isArray(activeMemberships) ? activeMemberships : [];
  if (!list.length) {
    return null;
  }
  if (preferredClubId) {
    const preferred = list.find((row) => String(row.club_id || row.clubId) === String(preferredClubId));
    if (preferred) {
      return preferred;
    }
  }
  return list[0];
}

function mapResolvedPlayer({
  authUserId,
  profile,
  athlete,
  membership,
  enrichedPlayer,
}) {
  const clubId = membership?.club_id || membership?.clubId || null;
  const clubName = membership?.club_name || membership?.clubName || "";
  const athleteId = athlete?.id || membership?.athlete_id || membership?.athleteId || null;
  const routeId = athleteId
    ? `athlete-${athleteId}`
    : buildAccountOnlyPlayerId(authUserId);

  const base = {
    ...(enrichedPlayer || {}),
    id: routeId,
    name:
      enrichedPlayer?.name ||
      athlete?.display_name ||
      profile?.display_name ||
      profile?.displayName ||
      profile?.email ||
      "VĐV",
    email: enrichedPlayer?.email || profile?.email || "",
    authUserId,
    athleteId,
    clubId,
    sourceClubId: clubId,
    clubName,
    tenantId:
      athlete?.tenant_id ||
      membership?.tenant_id ||
      profile?.venue_id ||
      profile?.venueId ||
      null,
    linkStatus: membership ? "linked" : "account_only",
    membershipStatus: membership?.status || null,
    membershipId: membership?.id || membership?.membership_id || null,
    // Do not infer club membership from default playerType.
    playerType: enrichedPlayer?.playerType || null,
  };

  return normalizePlayers([base])[0];
}

/**
 * @returns {Promise<object>} profile payload compatible with PlayerProfile.jsx
 */
export async function resolveV2AthleteProfile({
  routePlayerId,
  preferredClubId = null,
  secondaryClubId = null,
  fallbackAuthUserId = null,
} = {}) {
  const route = parsePlatformAthleteRouteId(routePlayerId);
  const authUserId = route.authUserId || fallbackAuthUserId || null;

  if (!isClubStorageV2Enabled()) {
    const roster = loadPlayerHistoryProfileResolved(
      {
        primaryClubId: preferredClubId,
        secondaryClubId,
        playerId: routePlayerId,
        authUserId,
      },
      { recentLimit: 12 }
    );
    if (roster.ok) {
      return { ...roster, source: "legacy_blob" };
    }
    if (roster.isAccountOnlyRoute && roster.authUserId) {
      const accountProfile = await loadAccountOnlyAthleteProfile(roster.authUserId);
      return { ...accountProfile, source: "legacy_account_only" };
    }
    return {
      ok: false,
      error: roster.error || "Không tìm thấy VĐV.",
      source: "legacy_miss",
    };
  }

  if (!authUserId && !route.isAccountOnly) {
    const roster = loadPlayerHistoryProfileResolved(
      {
        primaryClubId: preferredClubId,
        secondaryClubId,
        playerId: routePlayerId,
        authUserId: fallbackAuthUserId,
      },
      { recentLimit: 12 }
    );
    if (roster.ok) {
      return { ...roster, source: "legacy_blob_fallback" };
    }
  }

  if (!authUserId) {
    return { ok: false, error: "Thiếu auth user để resolve hồ sơ V2." };
  }

  const resolved = await rpcPlatformResolveAthleteProfile(authUserId);
  if (!resolved.ok) {
    if (resolved.code === "RPC_NOT_DEPLOYED" || resolved.code === "NO_SUPABASE") {
      const accountProfile = await loadAccountOnlyAthleteProfile(authUserId);
      return {
        ...accountProfile,
        source: "v2_rpc_unavailable_account_only",
        warning: resolved.error,
      };
    }
    return {
      ok: false,
      error: resolved.error || "Không resolve được hồ sơ VĐV V2.",
      code: resolved.code,
      source: "v2_rpc",
    };
  }

  const data = resolved.data || {};
  const profile = normalizeUser({
    id: data.auth_user_id || authUserId,
    ...(data.profile || {}),
  });
  const athlete = data.athlete || null;
  const activeMemberships = Array.isArray(data.active_memberships)
    ? data.active_memberships
    : [];
  const accountOnly = isAccountOnlyByV2Data({ activeMemberships, athlete });
  const membership = pickPrimaryMembership(activeMemberships, preferredClubId);
  const enriched = await enrichAccountOnlyAthlete(profile);

  const player = mapResolvedPlayer({
    authUserId,
    profile,
    athlete,
    membership,
    enrichedPlayer: enriched,
  });

  // Prefer blob history when a real club blob player exists for this auth user.
  if (membership?.club_id) {
    const roster = loadPlayerHistoryProfileResolved(
      {
        primaryClubId: membership.club_id,
        secondaryClubId: preferredClubId || secondaryClubId,
        playerId: null,
        authUserId,
      },
      { recentLimit: 12 }
    );
    if (roster.ok) {
      return {
        ...roster,
        clubId: membership.club_id,
        resolvedPlayerId: roster.resolvedPlayerId || player.id,
        player: {
          ...roster.player,
          athleteId: player.athleteId,
          authUserId,
          clubName: player.clubName || roster.player?.clubName,
          linkStatus: "linked",
          membershipStatus: membership.status,
          membershipId: player.membershipId,
          playerType: roster.player?.playerType || null,
        },
        isAccountOnly: false,
        authUserId,
        athlete,
        activeMemberships,
        source: "v2_membership_plus_blob_history",
      };
    }
  }

  return {
    ok: true,
    clubId: membership?.club_id || null,
    resolvedPlayerId: player.id,
    player,
    stats: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    },
    recentMatches: [],
    topPartners: [],
    topOpponents: [],
    isAccountOnly: accountOnly,
    authUserId,
    athlete,
    activeMemberships,
    source: accountOnly ? "v2_account_only" : "v2_membership",
  };
}
