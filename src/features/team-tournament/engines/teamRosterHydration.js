/**
 * P0 — Shared Team Tournament roster identity hydration.
 *
 * Canonical: athletes.id is the primary athlete identity.
 * Cloud member player_id / athlete_id / aliases resolve through ONE mapper.
 * user_id may resolve an athlete when needed.
 * profile/blob IDs are aliases only.
 * Unresolved members are NEVER silently dropped.
 */

import { getPlayerGenderKey } from "../../../models/player.js";

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * Collect all lookup keys for a pool athlete (primary + aliases + user).
 * @param {object} athlete
 * @returns {string[]}
 */
export function collectRosterAthleteLookupKeys(athlete = {}) {
  const keys = [];
  const push = (value) => {
    const id = normalizeId(value);
    if (id && !keys.includes(id)) keys.push(id);
  };

  push(athlete.athleteId);
  push(athlete.pairingIdentityId);
  push(athlete.id);
  push(athlete.profilePlayerId);
  push(athlete.legacyPlayerId);
  push(athlete.authUserId);
  push(athlete.userId);
  push(athlete.user_id);
  push(athlete.metadata?.profilePlayerId);
  push(athlete.metadata?.legacyPlayerId);

  const aliasIds = athlete.metadata?.aliasIds;
  if (Array.isArray(aliasIds)) {
    for (const aliasId of aliasIds) push(aliasId);
  }

  return keys;
}

/**
 * Primary athletes.id for a pool row.
 * @param {object} athlete
 * @returns {string}
 */
export function getRosterAthleteId(athlete = {}) {
  return (
    normalizeId(athlete.athleteId) ||
    normalizeId(athlete.pairingIdentityId) ||
    normalizeId(athlete.id) ||
    ""
  );
}

/**
 * Build alias → athletes.id index. Duplicate aliases stay ambiguous (never silent pick).
 *
 * @param {object[]} athletePool
 * @returns {{
 *   byAthleteId: Map<string, object>,
 *   byKey: Map<string, string[]>,
 *   duplicateAliases: Array<{ aliasId: string, athleteIds: string[] }>
 * }}
 */
export function buildRosterAthleteIndex(athletePool = []) {
  const byAthleteId = new Map();
  const byKey = new Map();

  for (const athlete of athletePool || []) {
    if (!athlete) continue;
    const athleteId = getRosterAthleteId(athlete);
    if (!athleteId) continue;

    if (!byAthleteId.has(athleteId)) {
      byAthleteId.set(athleteId, athlete);
    }

    for (const key of collectRosterAthleteLookupKeys(athlete)) {
      const owners = byKey.get(key) || [];
      if (!owners.includes(athleteId)) owners.push(athleteId);
      byKey.set(key, owners);
    }
  }

  const duplicateAliases = [];
  for (const [aliasId, athleteIds] of byKey.entries()) {
    if (athleteIds.length > 1 && !byAthleteId.has(aliasId)) {
      duplicateAliases.push({ aliasId, athleteIds: [...athleteIds] });
    }
  }

  return { byAthleteId, byKey, duplicateAliases };
}

/**
 * Single mapper: cloud member player_id / athlete_id / user_id / alias → pool athlete.
 * Prefer direct athletes.id hit. Never invent an id from an unknown alias.
 *
 * @param {string} rawId
 * @param {{ byAthleteId: Map, byKey: Map }} index
 * @param {{ userId?: string|null }} [hints]
 * @returns {{
 *   ok: boolean,
 *   athleteId: string|null,
 *   athlete: object|null,
 *   via: "athlete"|"alias"|"user"|null,
 *   ambiguous?: boolean,
 *   athleteIds?: string[],
 *   diagnostic: string|null
 * }}
 */
export function resolveRosterMemberIdentity(rawId, index, hints = {}) {
  const id = normalizeId(rawId);
  if (!id || !index) {
    return {
      ok: false,
      athleteId: null,
      athlete: null,
      via: null,
      diagnostic: id ? "missing_identity_index" : "empty_member_id",
    };
  }

  if (index.byAthleteId?.has(id)) {
    return {
      ok: true,
      athleteId: id,
      athlete: index.byAthleteId.get(id),
      via: "athlete",
      diagnostic: null,
    };
  }

  const owners = index.byKey?.get(id) || [];
  if (owners.length === 1) {
    const athleteId = owners[0];
    return {
      ok: true,
      athleteId,
      athlete: index.byAthleteId.get(athleteId) || null,
      via: "alias",
      diagnostic: null,
    };
  }
  if (owners.length > 1) {
    return {
      ok: false,
      athleteId: null,
      athlete: null,
      via: "alias",
      ambiguous: true,
      athleteIds: [...owners],
      diagnostic: `ambiguous_alias:${id}`,
    };
  }

  const userId = normalizeId(hints.userId);
  if (userId && userId !== id) {
    const userOwners = index.byKey?.get(userId) || [];
    if (userOwners.length === 1) {
      const athleteId = userOwners[0];
      return {
        ok: true,
        athleteId,
        athlete: index.byAthleteId.get(athleteId) || null,
        via: "user",
        diagnostic: null,
      };
    }
    if (userOwners.length > 1) {
      return {
        ok: false,
        athleteId: null,
        athlete: null,
        via: "user",
        ambiguous: true,
        athleteIds: [...userOwners],
        diagnostic: `ambiguous_user:${userId}`,
      };
    }
  }

  return {
    ok: false,
    athleteId: null,
    athlete: null,
    via: null,
    diagnostic: `missing_identity:${id}`,
  };
}

function extractMemberSourceRows(team, teamMemberRows) {
  if (Array.isArray(teamMemberRows) && teamMemberRows.length > 0) {
    return teamMemberRows.map((row, index) => ({
      storedPlayerId: normalizeId(
        row?.player_id ||
          row?.playerId ||
          row?.athlete_id ||
          row?.athleteId ||
          row?.id
      ),
      userId: normalizeId(row?.user_id || row?.userId) || null,
      role: row?.role != null ? String(row.role) : null,
      sourceIndex: index,
    }));
  }

  return (team?.playerIds || []).map((playerId, index) => ({
    storedPlayerId: normalizeId(playerId),
    userId: null,
    role: null,
    sourceIndex: index,
  }));
}

function resolveCaptainAthleteId(team, index) {
  const raw = normalizeId(team?.captainPlayerId);
  if (!raw) return { athleteId: null, storedId: "" };
  const resolved = resolveRosterMemberIdentity(raw, index);
  return {
    athleteId: resolved.ok ? resolved.athleteId : null,
    storedId: raw,
  };
}

function resolveDeputyAthleteIds(team, index) {
  const athleteIds = new Set();
  const storedIds = new Set();
  for (const raw of team?.deputyPlayerIds || []) {
    const id = normalizeId(raw);
    if (!id) continue;
    storedIds.add(id);
    const resolved = resolveRosterMemberIdentity(id, index);
    if (resolved.ok && resolved.athleteId) {
      athleteIds.add(resolved.athleteId);
    }
  }
  return { athleteIds, storedIds };
}

function memberDisplayName(athlete, storedPlayerId, resolved) {
  if (!resolved.ok || !athlete) {
    const id = storedPlayerId || "unknown";
    return `${id} (thiếu identity)`;
  }
  const name = String(athlete.name || athlete.displayName || "").trim();
  if (!name) {
    return `${resolved.athleteId} (thiếu tên)`;
  }
  return name;
}

function inferRole({ isCaptain, isDeputy, explicitRole }) {
  if (explicitRole) return explicitRole;
  if (isCaptain) return "captain";
  if (isDeputy) return "deputy";
  return "member";
}

/**
 * Shared roster hydrator — cloud member rows × canonical athlete pool.
 *
 * @param {{
 *   team: object,
 *   teamMemberRows?: object[],
 *   athletePool?: object[],
 * }} input
 * @returns {{
 *   teamId: string,
 *   name: string,
 *   members: Array<{
 *     athleteId: string|null,
 *     userId: string|null,
 *     displayName: string,
 *     gender: string|null,
 *     rating: number|null,
 *     role: string,
 *     isCaptain: boolean,
 *     isDeputy: boolean,
 *     resolved: boolean,
 *     storedPlayerId: string,
 *     via: string|null,
 *     diagnostic: string|null,
 *     player: object|null
 *   }>,
 *   unresolvedCount: number,
 *   duplicateAliases: Array<{ aliasId: string, athleteIds: string[] }>,
 *   diagnostics: string[]
 * }}
 */
export function hydrateTeamRoster({
  team = {},
  teamMemberRows = null,
  athletePool = [],
} = {}) {
  const index = buildRosterAthleteIndex(athletePool);
  const captain = resolveCaptainAthleteId(team, index);
  const deputies = resolveDeputyAthleteIds(team, index);
  const sourceRows = extractMemberSourceRows(team, teamMemberRows);
  const diagnostics = [];

  if (index.duplicateAliases.length > 0) {
    diagnostics.push(`duplicate_aliases:${index.duplicateAliases.length}`);
  }

  const members = sourceRows.map((row) => {
    const storedPlayerId = row.storedPlayerId;
    const resolved = resolveRosterMemberIdentity(storedPlayerId, index, {
      userId: row.userId,
    });
    const athlete = resolved.athlete;
    const athleteId = resolved.athleteId || null;
    const userId =
      normalizeId(athlete?.authUserId || athlete?.userId || athlete?.user_id) ||
      row.userId ||
      null;

    const isCaptain =
      Boolean(athleteId && captain.athleteId && athleteId === captain.athleteId) ||
      Boolean(storedPlayerId && captain.storedId && storedPlayerId === captain.storedId);

    const isDeputy =
      Boolean(athleteId && deputies.athleteIds.has(athleteId)) ||
      Boolean(storedPlayerId && deputies.storedIds.has(storedPlayerId));

    if (!resolved.ok && resolved.diagnostic) {
      diagnostics.push(resolved.diagnostic);
    }

    const genderRaw = athlete?.gender ?? null;
    const ratingRaw = athlete?.rating ?? athlete?.level ?? null;

    return {
      athleteId,
      userId,
      displayName: memberDisplayName(athlete, storedPlayerId, resolved),
      gender: genderRaw,
      rating: ratingRaw != null && ratingRaw !== "" ? Number(ratingRaw) || ratingRaw : null,
      role: inferRole({
        isCaptain,
        isDeputy,
        explicitRole: row.role,
      }),
      isCaptain,
      isDeputy,
      resolved: resolved.ok === true,
      storedPlayerId: storedPlayerId || `missing-${row.sourceIndex}`,
      via: resolved.via,
      diagnostic: resolved.diagnostic,
      player: resolved.ok
        ? {
            ...athlete,
            id: storedPlayerId || athleteId,
            athleteId: athleteId || athlete?.athleteId || null,
            name: memberDisplayName(athlete, storedPlayerId, resolved),
            gender: genderRaw,
            rating: ratingRaw,
            level: athlete?.level ?? ratingRaw,
          }
        : null,
    };
  });

  return {
    teamId: normalizeId(team?.id) || "",
    name: String(team?.name || "").trim(),
    members,
    unresolvedCount: members.filter((member) => !member.resolved).length,
    duplicateAliases: index.duplicateAliases,
    diagnostics: [...new Set(diagnostics)],
  };
}

/**
 * Hydrate every team in a tournament teamData blob.
 *
 * @param {object} teamData
 * @param {object[]} athletePool
 * @returns {ReturnType<typeof hydrateTeamRoster>[]}
 */
export function hydrateAllTeamRosters(teamData, athletePool = []) {
  return (teamData?.teams || []).map((team) =>
    hydrateTeamRoster({ team, athletePool })
  );
}

/**
 * Stats from a hydrated roster (badge count === rendered members).
 *
 * @param {ReturnType<typeof hydrateTeamRoster>|null} hydrated
 * @returns {{ total: number, males: number, females: number, unresolvedCount: number }}
 */
export function computeHydratedRosterStats(hydrated) {
  let males = 0;
  let females = 0;
  const members = hydrated?.members || [];

  for (const member of members) {
    const gender = getPlayerGenderKey(member.gender);
    if (gender === "male") males += 1;
    else if (gender === "female") females += 1;
  }

  return {
    total: members.length,
    males,
    females,
    unresolvedCount: hydrated?.unresolvedCount || 0,
  };
}

/**
 * Identity-aware membership set for picker / already-assigned filters.
 *
 * @param {ReturnType<typeof hydrateTeamRoster>|null} hydrated
 * @returns {Set<string>}
 */
export function collectHydratedMemberKeys(hydrated) {
  const keys = new Set();
  for (const member of hydrated?.members || []) {
    if (member.storedPlayerId) keys.add(String(member.storedPlayerId));
    if (member.athleteId) keys.add(String(member.athleteId));
    if (member.userId) keys.add(String(member.userId));
    const player = member.player;
    if (player) {
      for (const key of collectRosterAthleteLookupKeys(player)) {
        keys.add(key);
      }
    }
  }
  return keys;
}

/**
 * Project hydrated members to legacy player rows for lineup selectors.
 * `id` stays the stored cloud player_id so membership checks keep working.
 *
 * @param {ReturnType<typeof hydrateTeamRoster>|null} hydrated
 * @returns {object[]}
 */
export function hydratedMembersAsPlayers(hydrated) {
  return (hydrated?.members || []).map((member) => {
    if (member.player) return member.player;
    return {
      id: member.storedPlayerId,
      athleteId: member.athleteId,
      name: member.displayName,
      gender: member.gender || "",
      rating: member.rating,
      unresolved: true,
      diagnostic: member.diagnostic,
    };
  });
}
