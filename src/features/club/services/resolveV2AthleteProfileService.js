import { normalizeUser } from "../../../models/user.js";
import { normalizePlayers } from "../../../models/player.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  buildAccountOnlyPlayerId,
  enrichAccountOnlyAthlete,
  loadAccountOnlyAthleteProfile,
  parsePlatformAthleteRouteId,
} from "./accountOnlyAthleteService.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { rpcPlatformResolveAthleteProfile } from "./clubStorageV2RpcService.js";
import { loadPlayerHistoryProfileResolved } from "../../../tournament/engines/playerHistoryEngine.js";

/**
 * Resolve player profile for platform/admin UI using Club Storage V2 SSOT:
 * profiles + athletes + club_members (never profiles.club_id alone).
 */

/** Fallback when platform_resolve_athlete_profile RPC is not deployed yet. */
async function resolveV2AthleteProfileViaTables(authUserId) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const [{ data: profile, error: profileError }, { data: athlete, error: athleteError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      client.from("profiles").select("*").eq("id", authUserId).maybeSingle(),
      client.from("athletes").select("*").eq("user_id", authUserId).maybeSingle(),
      client
        .from("club_members")
        .select("id, club_id, tenant_id, athlete_id, status, membership_type, joined_at, clubs(id, name)")
        .eq("user_id", authUserId)
        .eq("status", "active")
        .order("joined_at", { ascending: true }),
    ]);

  if (profileError) {
    return { ok: false, code: "PROFILE_QUERY_FAILED", error: profileError.message };
  }
  if (athleteError) {
    return { ok: false, code: "ATHLETE_QUERY_FAILED", error: athleteError.message };
  }
  if (membershipError) {
    return { ok: false, code: "MEMBERSHIP_QUERY_FAILED", error: membershipError.message };
  }

  const activeMemberships = (memberships || []).map((row) => ({
    id: row.id,
    club_id: row.club_id,
    tenant_id: row.tenant_id,
    athlete_id: row.athlete_id,
    status: row.status,
    membership_type: row.membership_type,
    joined_at: row.joined_at,
    club_name: row.clubs?.name || "",
  }));

  return {
    ok: true,
    data: {
      auth_user_id: authUserId,
      profile: profile || null,
      athlete: athlete || null,
      active_memberships: activeMemberships,
    },
    source: "v2_tables_fallback",
  };
}

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

  let resolved = await rpcPlatformResolveAthleteProfile(authUserId);
  let resolveSource = "v2_rpc";
  if (!resolved.ok && (resolved.code === "RPC_NOT_DEPLOYED" || resolved.code === "NO_SUPABASE")) {
    const tableResolved = await resolveV2AthleteProfileViaTables(authUserId);
    if (tableResolved.ok) {
      resolved = tableResolved;
      resolveSource = "v2_tables_fallback";
    } else if (resolved.code === "NO_SUPABASE") {
      const accountProfile = await loadAccountOnlyAthleteProfile(authUserId);
      return {
        ...accountProfile,
        source: "v2_rpc_unavailable_account_only",
        warning: resolved.error,
      };
    } else {
      return {
        ok: false,
        error: tableResolved.error || resolved.error || "Không resolve được hồ sơ VĐV V2.",
        code: tableResolved.code || resolved.code,
        source: "v2_tables_fallback",
      };
    }
  } else if (!resolved.ok) {
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
        source:
          resolveSource === "v2_tables_fallback"
            ? "v2_membership_plus_blob_history_tables"
            : "v2_membership_plus_blob_history",
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
    source: accountOnly
      ? "v2_account_only"
      : resolveSource === "v2_tables_fallback"
        ? "v2_membership_tables"
        : "v2_membership",
  };
}
