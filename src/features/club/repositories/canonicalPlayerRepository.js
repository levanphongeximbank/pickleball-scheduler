import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { isCanonicalPlayerRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { createCanonicalMembershipRepository } from "./canonicalMembershipRepository.js";
import { createCanonicalClubRepository } from "./canonicalClubRepository.js";
import {
  CANONICAL_SOURCE,
  CANONICAL_WARNING_CODE,
  MAPPING_STATUS,
  buildDerivedAuthPlayerId,
  buildRepoError,
  buildRepoResult,
  emptyMappingSummary,
} from "./canonicalRepositoryTypes.js";

/**
 * @typedef {object} CanonicalPlayerRecord
 * @property {string|null} playerId
 * @property {string|null} profileId
 * @property {string|null} authUserId
 * @property {string|null} clubId
 * @property {string|null} tenantId
 * @property {string} displayName
 * @property {string|null} gender
 * @property {unknown} rating
 * @property {string} status
 * @property {string} membershipStatus
 * @property {string} source
 * @property {string} mappingStatus
 * @property {Record<string, unknown>} metadata
 */

/**
 * Normalize a player-ish object to canonical output (never raw SQL row).
 * @param {object} partial
 * @returns {CanonicalPlayerRecord}
 */
export function normalizePlayerRecord(partial = {}) {
  const playerId = String(partial.playerId || partial.id || "").trim() || null;
  const profileId = String(partial.profileId || partial.profile_id || "").trim() || null;
  const authUserId =
    String(partial.authUserId || partial.auth_user_id || partial.userId || partial.user_id || "")
      .trim() || null;
  const clubId = String(partial.clubId || partial.club_id || "").trim() || null;
  const tenantId = String(partial.tenantId || partial.tenant_id || "").trim() || null;

  const selectable = Boolean(
    partial.selectable ??
      (partial.metadata && typeof partial.metadata === "object"
        ? partial.metadata.selectable
        : undefined) ??
      (partial.mappingStatus === MAPPING_STATUS.MAPPED ||
        partial.mappingStatus === MAPPING_STATUS.DERIVED)
  );

  return {
    playerId,
    profileId,
    authUserId,
    clubId,
    tenantId,
    displayName: String(
      partial.displayName || partial.display_name || partial.name || playerId || authUserId || ""
    ).trim(),
    gender: partial.gender ?? null,
    rating: partial.rating ?? partial.level ?? null,
    status: String(partial.status || "active").toLowerCase(),
    membershipStatus: String(partial.membershipStatus || partial.membership_status || "active"),
    source: partial.source || CANONICAL_SOURCE.HYBRID,
    mappingStatus: partial.mappingStatus || MAPPING_STATUS.UNMAPPED,
    metadata: {
      ...(partial.metadata && typeof partial.metadata === "object" ? partial.metadata : {}),
      selectable,
      athleteId: partial.athleteId || partial.athlete_id || null,
      membershipId: partial.membershipId || partial.membership_id || partial.id || null,
    },
  };
}

/**
 * Resolve canonical player identity for a profile row.
 * Policy: profiles.player_id → MAPPED; else player-auth-{id} if exists → DERIVED; else UNMAPPED.
 *
 * @param {object} profile
 * @param {object} [options]
 * @param {(playerId: string) => object|null|undefined} [options.findPlayerById]
 * @param {boolean} [options.allowDerived=true]
 */
export function resolvePlayerForProfile(profile, options = {}) {
  const allowDerived = options.allowDerived !== false;
  const findPlayerById = options.findPlayerById || (() => null);
  const profileId = String(profile?.id || profile?.profileId || "").trim() || null;
  const mappedId = String(profile?.player_id || profile?.playerId || "").trim();

  if (mappedId) {
    const existing = findPlayerById(mappedId);
    if (existing === null) {
      // explicit miss from directory
      return {
        record: normalizePlayerRecord({
          playerId: mappedId,
          profileId,
          authUserId: profileId,
          displayName: profile?.display_name || profile?.displayName || profile?.email,
          gender: profile?.gender,
          mappingStatus: MAPPING_STATUS.INVALID,
          selectable: false,
          status: profile?.status || "active",
          metadata: { reason: "profiles.player_id points to missing player" },
        }),
        warning: {
          code: CANONICAL_WARNING_CODE.INVALID_PLAYER_MAPPING,
          message: `Invalid profiles.player_id mapping: ${mappedId}`,
          meta: { profileId, playerId: mappedId },
        },
      };
    }
    return {
      record: normalizePlayerRecord({
        ...(existing && typeof existing === "object" ? existing : {}),
        playerId: mappedId,
        profileId,
        authUserId: profileId,
        displayName:
          existing?.name ||
          existing?.displayName ||
          profile?.display_name ||
          profile?.displayName ||
          mappedId,
        gender: existing?.gender ?? profile?.gender ?? null,
        rating: existing?.rating ?? existing?.level ?? null,
        mappingStatus: MAPPING_STATUS.MAPPED,
        selectable: true,
        status: existing?.status || profile?.status || "active",
      }),
      warning: null,
    };
  }

  if (allowDerived && profileId) {
    const derivedId = buildDerivedAuthPlayerId(profileId);
    const existing = findPlayerById(derivedId);
    if (existing) {
      return {
        record: normalizePlayerRecord({
          ...existing,
          playerId: derivedId,
          profileId,
          authUserId: profileId,
          displayName: existing.name || existing.displayName || profile?.display_name || derivedId,
          mappingStatus: MAPPING_STATUS.DERIVED,
          selectable: true,
          status: existing.status || "active",
        }),
        warning: null,
      };
    }
  }

  return {
    record: normalizePlayerRecord({
      playerId: null,
      profileId,
      authUserId: profileId,
      displayName: profile?.display_name || profile?.displayName || profile?.email || profileId,
      gender: profile?.gender,
      mappingStatus: MAPPING_STATUS.UNMAPPED,
      selectable: false,
      status: profile?.status || "active",
    }),
    warning: {
      code: CANONICAL_WARNING_CODE.UNMAPPED_ACTIVE_MEMBER,
      message: "Active member has no valid player mapping.",
      meta: { profileId },
    },
  };
}

/**
 * Resolve player identity from a club membership row (+ optional profile index).
 * @param {object} member
 * @param {object} [options]
 */
export function resolvePlayerForMembership(member, options = {}) {
  const userId = String(member?.user_id || member?.userId || member?.authUserId || "").trim();
  const profile =
    options.profile ||
    (options.profilesByUserId && userId ? options.profilesByUserId.get(userId) : null) ||
    {
      id: userId,
      player_id: member?.player_id || member?.playerId || null,
      display_name: member?.display_name || member?.displayName || null,
      gender: member?.gender || null,
      status: "active",
    };

  const resolved = resolvePlayerForProfile(profile, options);
  const clubId = String(options.clubId || member?.club_id || member?.clubId || "").trim() || null;
  const tenantId =
    String(options.tenantId || member?.tenant_id || member?.tenantId || "").trim() || null;

  return {
    record: normalizePlayerRecord({
      ...resolved.record,
      clubId,
      tenantId,
      membershipStatus: member?.membershipStatus || member?.status || "active",
      source: options.source || CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      athleteId: member?.athlete_id || member?.athleteId || null,
      membershipId: member?.id || member?.memberId || null,
      metadata: {
        ...resolved.record.metadata,
        membershipType: member?.membership_type || member?.membershipType || null,
      },
    }),
    warning: resolved.warning,
  };
}

/**
 * @param {object} [deps]
 */
export function createCanonicalPlayerRepository(deps = {}) {
  const {
    envSource = null,
    isV2Enabled = () => isCanonicalPlayerRepositoryEnabled(envSource),
    membershipRepository = createCanonicalMembershipRepository({ envSource, isV2Enabled }),
    clubRepository = createCanonicalClubRepository({ envSource }),
    loadLegacyPlayers = loadPlayersForClub,
    /**
     * Optional: Map|object|async fn(userIds) → profiles with player_id
     */
    loadProfilesByUserIds = null,
    /**
     * Optional player existence directory: (playerId) => player|null|undefined
     * undefined = existence unknown (MAPPED trusts profiles.player_id without INVALID)
     */
    findPlayerById = undefined,
    allowDerived = true,
  } = deps;

  async function resolveProfileIndex(userIds) {
    if (!loadProfilesByUserIds) return new Map();
    if (loadProfilesByUserIds instanceof Map) return loadProfilesByUserIds;
    if (typeof loadProfilesByUserIds === "function") {
      const result = await loadProfilesByUserIds(userIds);
      if (result instanceof Map) return result;
      const map = new Map();
      for (const row of result || []) {
        const id = String(row?.id || row?.user_id || "").trim();
        if (id) map.set(id, row);
      }
      return map;
    }
    return new Map();
  }

  function makeFindPlayer(clubId, optionFind) {
    if (typeof optionFind === "function") return optionFind;
    if (typeof findPlayerById === "function") return findPlayerById;
    // Default: check legacy blob only; missing → null (can mark INVALID / block DERIVED)
    const blobPlayers = (() => {
      try {
        return loadLegacyPlayers(clubId) || [];
      } catch {
        return [];
      }
    })();
    const byId = new Map(blobPlayers.map((p) => [String(p.id), p]));
    return (playerId) => {
      const id = String(playerId || "").trim();
      if (!id) return null;
      return byId.has(id) ? byId.get(id) : null;
    };
  }

  async function listPlayersForClub(clubId, options = {}) {
    const id = String(clubId || "").trim();
    if (!id) {
      return buildRepoError({ code: "CLUB_ID_REQUIRED", message: "clubId is required." });
    }

    const tenantId = String(options.tenantId || "").trim() || null;
    const userContext = options.userContext || {};

    if (tenantId && clubRepository) {
      let clubCheck;
      try {
        clubCheck = await clubRepository.getClubById(id, { userContext });
      } catch {
        clubCheck = { ok: false };
      }
      if (clubCheck?.ok && clubCheck.data?.tenantId) {
        if (String(clubCheck.data.tenantId) !== tenantId && !userContext.isPlatformAdmin) {
          const rbacUser = userContext.user;
          const global =
            userContext.isPlatformAdmin ||
            (rbacUser && ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(String(rbacUser.role || "")));
          if (!global) {
            return buildRepoError({
              code: CANONICAL_WARNING_CODE.PLAYER_OUTSIDE_TENANT,
              message: "Club is outside requested tenant.",
              source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
              warnings: [
                {
                  code: CANONICAL_WARNING_CODE.PLAYER_OUTSIDE_TENANT,
                  meta: { clubId: id, tenantId },
                },
              ],
            });
          }
        }
      }
    }

    if (!isV2Enabled()) {
      let players;
      try {
        players = loadLegacyPlayers(id) || [];
      } catch {
        players = [];
      }
      const data = players.map((p) =>
        normalizePlayerRecord({
          ...p,
          playerId: p.id,
          clubId: id,
          tenantId,
          mappingStatus: MAPPING_STATUS.MAPPED,
          selectable: true,
          source: CANONICAL_SOURCE.LEGACY_BLOB,
          displayName: p.name || p.id,
        })
      );
      return buildRepoResult({
        data,
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        mappingSummary: emptyMappingSummary({
          totalMembers: data.length,
          activeMembers: data.length,
          mappedPlayers: data.length,
        }),
        execution: { mode: "legacy", clubId: id },
      });
    }

    const membersResult = await membershipRepository.listActiveClubMembers(id, {
      includeInactive: false,
    });
    if (!membersResult.ok) return membersResult;

    const members = membersResult.data || [];
    const userIds = members.map((m) => String(m.user_id || m.userId || "").trim()).filter(Boolean);
    const profilesByUserId =
      options.profilesByUserId instanceof Map
        ? options.profilesByUserId
        : await resolveProfileIndex(userIds);
    const finder = makeFindPlayer(id, options.findPlayerById);

    const warnings = [...(membersResult.warnings || [])];
    const data = [];
    let mappedPlayers = 0;
    let derivedPlayers = 0;
    let unmappedMembers = 0;
    let invalidMappings = 0;

    for (const member of members) {
      const profilePlayerId = String(
        profilesByUserId.get(String(member.user_id || member.userId || "").trim())?.player_id ||
          profilesByUserId.get(String(member.user_id || member.userId || "").trim())?.playerId ||
          member.player_id ||
          member.playerId ||
          ""
      ).trim();

      // Cloud-only clubs: trust profiles.player_id without requiring blob player row.
      const memberFinder =
        options.requirePlayerRow === true || !profilePlayerId
          ? finder
          : (playerId) => {
              const hit = finder(playerId);
              if (hit) return hit;
              if (String(playerId) === profilePlayerId) {
                return {
                  id: profilePlayerId,
                  name: member.display_name || member.displayName || profilePlayerId,
                };
              }
              return null;
            };

      const { record, warning } = resolvePlayerForMembership(member, {
        clubId: id,
        tenantId:
          tenantId ||
          String(options.clubTenantId || member.tenant_id || member.tenantId || "").trim() ||
          null,
        profilesByUserId,
        findPlayerById: memberFinder,
        allowDerived,
        source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      });

      if (warning) warnings.push(warning);

      if (record.mappingStatus === MAPPING_STATUS.MAPPED) mappedPlayers += 1;
      else if (record.mappingStatus === MAPPING_STATUS.DERIVED) derivedPlayers += 1;
      else if (record.mappingStatus === MAPPING_STATUS.INVALID) invalidMappings += 1;
      else unmappedMembers += 1;

      data.push(record);
    }

    // Dedupe by playerId (or authUserId fallback) so duplicate membership never duplicates picker
    const seen = new Set();
    const deduped = [];
    for (const player of data) {
      const key = player.playerId || `auth:${player.authUserId}` || `profile:${player.profileId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(player);
    }

    return buildRepoResult({
      data: deduped,
      source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      warnings,
      mappingSummary: emptyMappingSummary({
        totalMembers: membersResult.mappingSummary?.totalMembers ?? members.length,
        activeMembers: members.length,
        mappedPlayers,
        derivedPlayers,
        unmappedMembers,
        invalidMappings,
        duplicatesRemoved: membersResult.mappingSummary?.duplicatesRemoved || 0,
      }),
      execution: {
        mode: "v2_membership",
        clubId: id,
        blobIndependent: true,
      },
    });
  }

  async function listPlayersForTenant(tenantId, options = {}) {
    const tid = String(tenantId || "").trim();
    if (!tid) {
      return buildRepoError({ code: "TENANT_ID_REQUIRED", message: "tenantId is required." });
    }
    const clubsResult = await clubRepository.listClubsForTenant(tid, {
      userContext: options.userContext,
    });
    if (!clubsResult.ok) return clubsResult;

    const all = [];
    const warnings = [...(clubsResult.warnings || [])];
    const summary = emptyMappingSummary();

    for (const club of clubsResult.data || []) {
      const playersResult = await listPlayersForClub(club.id, {
        ...options,
        tenantId: tid,
        clubTenantId: club.tenantId,
      });
      if (!playersResult.ok) {
        warnings.push({
          code: playersResult.code || "PLAYER_LIST_FAILED",
          message: playersResult.message,
          meta: { clubId: club.id },
        });
        continue;
      }
      all.push(...(playersResult.data || []));
      warnings.push(...(playersResult.warnings || []));
      const s = playersResult.mappingSummary || {};
      summary.activeMembers += s.activeMembers || 0;
      summary.mappedPlayers += s.mappedPlayers || 0;
      summary.derivedPlayers += s.derivedPlayers || 0;
      summary.unmappedMembers += s.unmappedMembers || 0;
      summary.invalidMappings += s.invalidMappings || 0;
      summary.duplicatesRemoved += s.duplicatesRemoved || 0;
      summary.totalMembers += s.totalMembers || 0;
    }

    const byPlayer = new Map();
    for (const player of all) {
      const key = player.playerId || `auth:${player.authUserId}`;
      if (!byPlayer.has(key)) byPlayer.set(key, player);
    }

    return buildRepoResult({
      data: Array.from(byPlayer.values()),
      source: isV2Enabled() ? CANONICAL_SOURCE.HYBRID : CANONICAL_SOURCE.LEGACY_BLOB,
      warnings,
      mappingSummary: summary,
      execution: { mode: "tenant_scan", tenantId: tid },
    });
  }

  async function getPlayerById(playerId, options = {}) {
    const id = String(playerId || "").trim();
    if (!id) {
      return buildRepoError({ code: "PLAYER_ID_REQUIRED", message: "playerId is required." });
    }
    if (options.clubId) {
      const listed = await listPlayersForClub(options.clubId, options);
      if (!listed.ok) return listed;
      const hit = (listed.data || []).find((p) => p.playerId === id) || null;
      if (!hit) {
        return buildRepoError({
          code: "NOT_FOUND",
          message: "Player not found in club scope.",
          source: listed.source,
        });
      }
      if (options.expectedClubId && hit.clubId && hit.clubId !== options.expectedClubId) {
        return buildRepoError({
          code: CANONICAL_WARNING_CODE.PLAYER_OUTSIDE_CLUB,
          message: "Player is outside expected club.",
          source: listed.source,
          warnings: [{ code: CANONICAL_WARNING_CODE.PLAYER_OUTSIDE_CLUB, meta: { playerId: id } }],
        });
      }
      return buildRepoResult({ data: hit, source: listed.source });
    }

    return buildRepoError({
      code: "CLUB_SCOPE_REQUIRED",
      message: "getPlayerById requires clubId in PR-4.25 (no automatic Production backfill lookup).",
    });
  }

  return {
    listPlayersForClub,
    listPlayersForTenant,
    getPlayerById,
    resolvePlayerForProfile,
    resolvePlayerForMembership,
    normalizePlayerRecord,
  };
}

export const canonicalPlayerRepository = createCanonicalPlayerRepository();
