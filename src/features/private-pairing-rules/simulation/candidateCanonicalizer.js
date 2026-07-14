/**
 * PR-4.5 — canonicalize simulation players and candidate keys.
 * Selectable players must be MAPPED or DERIVED only.
 */

import { MAPPING_STATUS } from "../../club/repositories/canonicalRepositoryTypes.js";
import { playerIdOf } from "../runtime/evaluateHardOnCandidate.js";

const SELECTABLE = new Set([MAPPING_STATUS.MAPPED, MAPPING_STATUS.DERIVED]);

/**
 * Stable hash for deterministic keys (FNV-1a 32-bit hex).
 * @param {string} value
 * @returns {string}
 */
export function stableHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * @param {unknown} player
 * @returns {object|null}
 */
export function normalizeSimulationPlayer(player) {
  if (!player || typeof player !== "object") return null;
  const playerId = String(player.playerId || player.id || "").trim();
  const mappingStatus = String(
    player.mappingStatus || MAPPING_STATUS.MAPPED
  ).toUpperCase();
  const displayName = String(player.displayName || player.name || playerId || "").trim();
  const ratingRaw = player.rating ?? player.level ?? player.skillLevel;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Number(ratingRaw);

  return {
    id: playerId,
    playerId,
    profileId: player.profileId || null,
    authUserId: player.authUserId || null,
    clubId: player.clubId || player.sourceClubId || null,
    tenantId: player.tenantId || null,
    displayName,
    name: displayName,
    gender: player.gender ?? "",
    rating: Number.isFinite(rating) ? rating : null,
    level: Number.isFinite(rating) ? rating : null,
    status: player.status || "active",
    membershipStatus: player.membershipStatus || "active",
    mappingStatus,
    checkedIn: player.checkedIn === true,
    metadata: player.metadata || {},
    waitMinutes: Number(player.waitMinutes ?? player.metadata?.waitMinutes ?? 0) || 0,
    benchCount: Number(player.benchCount ?? player.metadata?.benchCount ?? 0) || 0,
    matchesPlayed: Number(player.matchesPlayed ?? player.metadata?.matchesPlayed ?? 0) || 0,
  };
}

/**
 * @param {Array} players
 * @returns {{
 *   eligible: object[],
 *   excluded: object[],
 *   warnings: object[],
 *   mappingSummary: object,
 * }}
 */
export function filterEligibleSimulationPlayers(players = []) {
  const warnings = [];
  const eligible = [];
  const excluded = [];
  const seen = new Set();
  let mappedPlayers = 0;
  let derivedPlayers = 0;
  let unmappedMembers = 0;
  let invalidMappings = 0;
  let duplicatesRemoved = 0;

  (players || []).forEach((raw) => {
    const player = normalizeSimulationPlayer(raw);
    if (!player) {
      invalidMappings += 1;
      excluded.push(raw);
      warnings.push({ code: "INVALID_PLAYER_MAPPING", meta: { reason: "empty" } });
      return;
    }

    if (!player.playerId || player.playerId.startsWith("unmapped:")) {
      unmappedMembers += 1;
      excluded.push(player);
      warnings.push({
        code: "UNMAPPED_ACTIVE_MEMBER",
        meta: {
          authUserId: player.authUserId,
          profileId: player.profileId,
          mappingStatus: player.mappingStatus,
        },
      });
      return;
    }

    if (!SELECTABLE.has(player.mappingStatus)) {
      if (player.mappingStatus === MAPPING_STATUS.UNMAPPED) {
        unmappedMembers += 1;
        warnings.push({
          code: "UNMAPPED_ACTIVE_MEMBER",
          meta: { playerId: player.playerId, authUserId: player.authUserId },
        });
      } else {
        invalidMappings += 1;
        warnings.push({
          code: "INVALID_PLAYER_MAPPING",
          meta: { playerId: player.playerId, mappingStatus: player.mappingStatus },
        });
      }
      excluded.push(player);
      return;
    }

    if (seen.has(player.playerId)) {
      duplicatesRemoved += 1;
      return;
    }
    seen.add(player.playerId);

    if (player.mappingStatus === MAPPING_STATUS.DERIVED) derivedPlayers += 1;
    else mappedPlayers += 1;

    eligible.push(player);
  });

  return {
    eligible,
    excluded,
    warnings,
    mappingSummary: {
      totalMembers: (players || []).length,
      activeMembers: eligible.length + unmappedMembers,
      mappedPlayers,
      derivedPlayers,
      unmappedMembers,
      invalidMappings,
      duplicatesRemoved,
      playersEligible: eligible.length,
      playersExcluded: excluded.length,
    },
  };
}

/**
 * Canonical key for a match schedule candidate.
 * @param {{ matches?: Array, teams?: Array, benchPlayers?: Array }} candidate
 * @returns {string}
 */
export function canonicalizeCandidateKey(candidate = {}) {
  const matches = (candidate.matches || []).map((match) => {
    const teamA = [...(match.teamAIds || match.teamA || [])]
      .map((p) => playerIdOf(p))
      .filter(Boolean)
      .sort();
    const teamB = [...(match.teamBIds || match.teamB || [])]
      .map((p) => playerIdOf(p))
      .filter(Boolean)
      .sort();
    const teams = [teamA.join("+"), teamB.join("+")].sort();
    return teams.join("vs");
  });

  if (!matches.length && candidate.teams) {
    const teamSig = (candidate.teams || [])
      .map((team) =>
        [...(team.playerIds || (team.members || []).map(playerIdOf))]
          .map(String)
          .sort()
          .join("+")
      )
      .sort()
      .join("||");
    const bench = [...(candidate.benchPlayers || []).map(playerIdOf)].sort().join(",");
    return stableHash(`${teamSig}#bench:${bench}`);
  }

  const bench = [...(candidate.benchPlayers || []).map(playerIdOf)].sort().join(",");
  return stableHash(`${matches.sort().join("|")}#bench:${bench}`);
}
