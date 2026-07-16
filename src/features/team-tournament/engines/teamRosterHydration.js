/**
 * P0 / P0.1 — Shared Team Tournament roster identity hydration.
 *
 * Canonical: athletes.id is the primary athlete identity.
 * Cloud member player_id / athlete_id / aliases resolve through ONE mapper.
 * user_id may resolve an athlete when needed.
 * profile/blob IDs are aliases only.
 * Unresolved members are NEVER silently dropped after pool is ready.
 *
 * P0.1: do not treat empty/loading pool as final missing_identity.
 */

import { getPlayerGenderKey } from "../../../models/player.js";
import { projectCanonicalRatingFields } from "../../pairing-candidates/canonicalAthleteRating.js";

export const ROSTER_HYDRATION_STATUS = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  PARTIAL: "partial",
  ERROR: "error",
});

export const ROSTER_LOADING_MESSAGE = "Đang tải thông tin VĐV trong đội…";
export const ROSTER_MISSING_RATING_LABEL = "Chưa có trình";
export const ROSTER_UNRESOLVED_NAME = "VĐV chưa xác định (thiếu identity)";
export const ROSTER_MISSING_NAME = "VĐV chưa xác định (thiếu tên)";

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * Opaque cloud ids / UUIDs must never be shown as athlete names.
 * @param {string} value
 */
export function looksLikeOpaqueRosterId(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  if (/^[0-9a-f]{32}$/i.test(s)) return true;
  if (/^(ath-|player-|qa-mlp-|blob-)/i.test(s) && s.length >= 12) {
    // slug-like stored ids — still not human display names
    return !/\s/.test(s) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s);
  }
  return false;
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

/**
 * Locked display-name precedence. Never returns cloud player_id / UUID.
 *
 * 1. athlete.displayName / fullName / name
 * 2. linked profile full name
 * 3. email / nickname fallback
 * 4. explicit unresolved placeholder (only when allowUnresolvedPlaceholder)
 *
 * @param {object|null} athlete
 * @param {{ allowUnresolvedPlaceholder?: boolean, missingKind?: "identity"|"name" }} [options]
 * @returns {string|null}
 */
export function resolveCanonicalRosterDisplayName(athlete, options = {}) {
  const allowUnresolvedPlaceholder = options.allowUnresolvedPlaceholder !== false;
  const missingKind = options.missingKind || "identity";

  if (!athlete) {
    return allowUnresolvedPlaceholder ? ROSTER_UNRESOLVED_NAME : null;
  }

  const candidates = [
    athlete.displayName,
    athlete.fullName,
    athlete.name,
    athlete.profileFullName,
    athlete.profile_full_name,
    athlete.profile?.fullName,
    athlete.profile?.display_name,
    athlete.profile?.displayName,
    athlete.email,
    athlete.nickname,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (!text) continue;
    if (looksLikeOpaqueRosterId(text)) continue;
    const athleteId = getRosterAthleteId(athlete);
    if (athleteId && text === athleteId) continue;
    return text;
  }

  if (!allowUnresolvedPlaceholder) return null;
  return missingKind === "name" ? ROSTER_MISSING_NAME : ROSTER_UNRESOLVED_NAME;
}

/**
 * Normalize canonical rating fields once.
 * Preserves numeric 0 (no truthy/falsy loss).
 *
 * @param {object|null} athlete
 * @returns {{ ratingValue: number|null, ratingLabel: string }}
 */
export function normalizeRosterRating(athlete) {
  if (!athlete) {
    return { ratingValue: null, ratingLabel: ROSTER_MISSING_RATING_LABEL };
  }

  const canonical = projectCanonicalRatingFields(athlete);
  if (canonical.ratingValue !== null && canonical.ratingValue !== undefined) {
    return {
      ratingValue: canonical.ratingValue,
      ratingLabel: canonical.ratingLabel || String(canonical.ratingValue),
    };
  }

  return { ratingValue: null, ratingLabel: ROSTER_MISSING_RATING_LABEL };
}

/**
 * Resolve overall roster hydration status from setup + pool readiness.
 *
 * @param {{
 *   setupReady?: boolean,
 *   athletePoolLoading?: boolean,
 *   athletePoolError?: object|null|boolean,
 *   unresolvedCount?: number,
 * }} input
 * @returns {"loading"|"ready"|"partial"|"error"}
 */
export function resolveRosterHydrationStatus({
  setupReady = true,
  athletePoolLoading = false,
  athletePoolError = null,
  unresolvedCount = 0,
} = {}) {
  if (athletePoolError) {
    return ROSTER_HYDRATION_STATUS.ERROR;
  }
  if (!setupReady || athletePoolLoading) {
    return ROSTER_HYDRATION_STATUS.LOADING;
  }
  if (Number(unresolvedCount) > 0) {
    return ROSTER_HYDRATION_STATUS.PARTIAL;
  }
  return ROSTER_HYDRATION_STATUS.READY;
}

/**
 * Visible roster row label: NAME · gender · ratingLabel
 * @param {object} member
 */
export function formatHydratedMemberLabel(member) {
  if (!member) return "";
  if (member.pending) return ROSTER_LOADING_MESSAGE;
  const parts = [member.displayName];
  if (member.gender) parts.push(String(member.gender));
  if (member.ratingLabel) parts.push(String(member.ratingLabel));
  return parts.filter(Boolean).join(" · ");
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

function inferRole({ isCaptain, isDeputy, explicitRole }) {
  if (explicitRole) return explicitRole;
  if (isCaptain) return "captain";
  if (isDeputy) return "deputy";
  return "member";
}

function buildPendingMembers(sourceRows, team) {
  const captainStored = normalizeId(team?.captainPlayerId);
  const deputyStored = new Set(
    (team?.deputyPlayerIds || []).map((id) => normalizeId(id)).filter(Boolean)
  );

  return sourceRows.map((row) => {
    const storedPlayerId = row.storedPlayerId || `missing-${row.sourceIndex}`;
    const isCaptain = Boolean(captainStored && storedPlayerId === captainStored);
    const isDeputy = deputyStored.has(storedPlayerId);
    return {
      athleteId: null,
      userId: row.userId,
      displayName: "",
      gender: null,
      rating: null,
      ratingValue: null,
      ratingLabel: "",
      role: inferRole({ isCaptain, isDeputy, explicitRole: row.role }),
      isCaptain,
      isDeputy,
      resolved: false,
      pending: true,
      storedPlayerId,
      via: null,
      diagnostic: null,
      player: null,
    };
  });
}

/**
 * Shared roster hydrator — cloud member rows × canonical athlete pool.
 *
 * @param {{
 *   team: object,
 *   teamMemberRows?: object[],
 *   athletePool?: object[],
 *   poolStatus?: "loading"|"ready"|"error",
 *   setupReady?: boolean,
 *   athletePoolLoading?: boolean,
 *   athletePoolError?: object|null|boolean,
 * }} input
 */
export function hydrateTeamRoster({
  team = {},
  teamMemberRows = null,
  athletePool = [],
  poolStatus = null,
  setupReady = true,
  athletePoolLoading = false,
  athletePoolError = null,
} = {}) {
  const sourceRows = extractMemberSourceRows(team, teamMemberRows);
  const effectivePoolStatus =
    poolStatus ||
    (athletePoolError
      ? "error"
      : athletePoolLoading || !setupReady
        ? "loading"
        : "ready");

  if (effectivePoolStatus === "loading") {
    return {
      teamId: normalizeId(team?.id) || "",
      name: String(team?.name || "").trim(),
      members: buildPendingMembers(sourceRows, team),
      memberCount: sourceRows.length,
      unresolvedCount: 0,
      duplicateAliases: [],
      diagnostics: [],
      status: ROSTER_HYDRATION_STATUS.LOADING,
      loadingMessage: ROSTER_LOADING_MESSAGE,
    };
  }

  if (effectivePoolStatus === "error") {
    return {
      teamId: normalizeId(team?.id) || "",
      name: String(team?.name || "").trim(),
      members: buildPendingMembers(sourceRows, team).map((member) => ({
        ...member,
        pending: false,
        displayName: ROSTER_UNRESOLVED_NAME,
        ratingLabel: ROSTER_MISSING_RATING_LABEL,
        diagnostic: "athlete_pool_error",
      })),
      memberCount: sourceRows.length,
      unresolvedCount: sourceRows.length,
      duplicateAliases: [],
      diagnostics: ["athlete_pool_error"],
      status: ROSTER_HYDRATION_STATUS.ERROR,
      loadingMessage: null,
    };
  }

  const index = buildRosterAthleteIndex(athletePool);
  const captain = resolveCaptainAthleteId(team, index);
  const deputies = resolveDeputyAthleteIds(team, index);
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

    const displayName = resolveCanonicalRosterDisplayName(athlete, {
      allowUnresolvedPlaceholder: true,
      missingKind: resolved.ok ? "name" : "identity",
    });

    // Never leak stored player_id / UUID into the visible name.
    const safeDisplayName =
      displayName && !looksLikeOpaqueRosterId(displayName)
        ? displayName
        : resolved.ok
          ? ROSTER_MISSING_NAME
          : ROSTER_UNRESOLVED_NAME;

    const genderRaw = athlete?.gender ?? null;
    const { ratingValue, ratingLabel } = normalizeRosterRating(athlete);

    return {
      athleteId,
      userId,
      displayName: safeDisplayName,
      gender: genderRaw,
      rating: ratingValue,
      ratingValue,
      ratingLabel,
      role: inferRole({
        isCaptain,
        isDeputy,
        explicitRole: row.role,
      }),
      isCaptain,
      isDeputy,
      resolved: resolved.ok === true,
      pending: false,
      storedPlayerId: storedPlayerId || `missing-${row.sourceIndex}`,
      via: resolved.via,
      diagnostic: resolved.diagnostic,
      player: resolved.ok
        ? {
            ...athlete,
            id: storedPlayerId || athleteId,
            athleteId: athleteId || athlete?.athleteId || null,
            name: safeDisplayName,
            displayName: safeDisplayName,
            gender: genderRaw,
            rating: ratingValue,
            ratingValue,
            ratingLabel,
            level: athlete?.level ?? ratingValue,
          }
        : null,
    };
  });

  const unresolvedCount = members.filter((member) => !member.resolved).length;
  const status = resolveRosterHydrationStatus({
    setupReady: true,
    athletePoolLoading: false,
    athletePoolError: null,
    unresolvedCount,
  });

  return {
    teamId: normalizeId(team?.id) || "",
    name: String(team?.name || "").trim(),
    members,
    memberCount: members.length,
    unresolvedCount,
    duplicateAliases: index.duplicateAliases,
    diagnostics: [...new Set(diagnostics)],
    status,
    loadingMessage: null,
  };
}

/**
 * Hydrate every team in a tournament teamData blob.
 */
export function hydrateAllTeamRosters(teamData, athletePool = [], options = {}) {
  return (teamData?.teams || []).map((team) =>
    hydrateTeamRoster({ team, athletePool, ...options })
  );
}

/**
 * Stats from a hydrated roster (badge count === rendered members).
 * While loading, gender stays 0 only when no members; UI should hide gender during loading.
 */
export function computeHydratedRosterStats(hydrated) {
  let males = 0;
  let females = 0;
  const members = hydrated?.members || [];
  const pending = hydrated?.status === ROSTER_HYDRATION_STATUS.LOADING;

  if (!pending) {
    for (const member of members) {
      if (member.pending) continue;
      const gender = getPlayerGenderKey(member.gender);
      if (gender === "male") males += 1;
      else if (gender === "female") females += 1;
    }
  }

  return {
    total: hydrated?.memberCount ?? members.length,
    males: pending ? 0 : males,
    females: pending ? 0 : females,
    unresolvedCount: pending ? 0 : hydrated?.unresolvedCount || 0,
    pending,
    status: hydrated?.status || ROSTER_HYDRATION_STATUS.READY,
  };
}

/**
 * Identity-aware membership set for picker / already-assigned filters.
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
 */
export function hydratedMembersAsPlayers(hydrated) {
  return (hydrated?.members || [])
    .filter((member) => !member.pending)
    .map((member) => {
      if (member.player) return member.player;
      return {
        id: member.storedPlayerId,
        athleteId: member.athleteId,
        name: member.displayName,
        gender: member.gender || "",
        rating: member.ratingValue,
        ratingValue: member.ratingValue,
        ratingLabel: member.ratingLabel,
        unresolved: true,
        diagnostic: member.diagnostic,
      };
    });
}
