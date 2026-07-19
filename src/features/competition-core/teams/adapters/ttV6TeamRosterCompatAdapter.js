/**
 * Core-05 — Team Tournament V6 → canonical Team/Roster map-only adapter.
 *
 * Rules:
 * - Never treat lockedPlayerIds as ROSTER_LOCKED
 * - absentPlayerIds → ABSENT status (not removal)
 * - Lineup selections are ignored (not roster membership)
 * - TT-only fields live in extensions
 * - No TT writes / RPC / SQL
 */

import {
  createCompetitionTeam,
  createCompetitionRoster,
  createCompetitionRosterMember,
} from "../../participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../../participants/contracts/identity.js";
import { createFormatExtension } from "../../participants/contracts/shared.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";
import {
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_ROSTER_MEMBER_STATUS,
} from "../../participants/enums/statuses.js";
import { buildTeamIdentityKey } from "../contracts/teamIdentity.js";
import { buildRosterIdentityKey } from "../contracts/rosterIdentity.js";

const FORMAT_KEY = "team-tournament-v6";
const SOURCE_VERSION = "team-tournament-v6";

/**
 * @param {unknown} source
 * @returns {Record<string, unknown>|null}
 */
function asObject(source) {
  return source && typeof source === "object" && !Array.isArray(source)
    ? /** @type {Record<string, unknown>} */ (source)
    : null;
}

/**
 * Explicit roster lock only — never lockedPlayerIds alone.
 * @param {Record<string, unknown>} team
 * @param {Record<string, unknown>} context
 */
function isExplicitRosterLocked(team, context) {
  if (context.rosterLocked === true) return true;
  if (team.locked === true) return true;
  if (String(team.rosterStatus || "").toUpperCase() === "ROSTER_LOCKED") return true;
  return false;
}

/**
 * @param {unknown} source — TT team-shaped object
 * @param {Record<string, unknown>} [context]
 */
export function mapTtV6TeamToCompetitionTeam(source, context = {}) {
  const team = asObject(source);
  /** @type {{ code: string, path: string, message: string }[]} */
  const diagnostics = [];
  if (!team) {
    return {
      success: false,
      value: null,
      diagnostics: [
        { code: "INVALID_SOURCE", path: "", message: "TT team source must be an object" },
      ],
      sourceVersion: SOURCE_VERSION,
    };
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || team.competitionId || team.tournamentId || ""
  ).trim();
  const id = String(team.id || "").trim();
  if (!id) {
    diagnostics.push({ code: "MISSING_ID", path: "id", message: "Team id is required" });
  }
  if (!competitionId) {
    diagnostics.push({
      code: "MISSING_COMPETITION_ID",
      path: "competitionId",
      message: "competitionId is required",
    });
  }

  const captainId = team.captainPlayerId ? String(team.captainPlayerId).trim() : "";
  const deputyIds = Array.isArray(team.deputyPlayerIds)
    ? team.deputyPlayerIds.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const withdrawn =
    team.withdrawn === true ||
    String(team.status || "").toLowerCase() === "withdrawn";

  const value = createCompetitionTeam({
    id,
    competitionId,
    name: String(team.name || ""),
    shortName: team.shortName != null ? String(team.shortName) : null,
    tenantId: context.tenantId || team.tenantId || null,
    divisionId: context.divisionId || team.divisionId || null,
    divisionCategoryId: context.divisionCategoryId || team.divisionCategoryId || null,
    entryId: context.entryId || team.entryId || null,
    status: withdrawn ? COMPETITION_TEAM_STATUS.WITHDRAWN : COMPETITION_TEAM_STATUS.ACTIVE,
    seed: typeof team.seed === "number" ? team.seed : null,
    captainRef: captainId
      ? createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: captainId,
        })
      : null,
    deputyRefs: deputyIds.map((pid) =>
      createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id: pid,
      })
    ),
    identityKey: buildTeamIdentityKey({ competitionId, stableTeamId: id }),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        color: team.color || null,
        logoUrl: team.logoUrl || null,
        avgLevel: team.avgLevel ?? null,
        topPlayerRating: team.topPlayerRating ?? null,
        totalRating: team.totalRating ?? null,
        playerIds: Array.isArray(team.playerIds) ? team.playerIds.map(String) : [],
        lockedPlayerIds: Array.isArray(team.lockedPlayerIds)
          ? team.lockedPlayerIds.map(String)
          : [],
        absentPlayerIds: Array.isArray(team.absentPlayerIds)
          ? team.absentPlayerIds.map(String)
          : [],
        withdrawn: withdrawn,
        withdrawalReason: team.withdrawalReason || null,
      },
    }),
  });

  return {
    success: diagnostics.length === 0,
    value: diagnostics.length === 0 ? value : null,
    diagnostics,
    sourceVersion: SOURCE_VERSION,
  };
}

/**
 * @param {unknown} source — TT team-shaped object (roster from playerIds)
 * @param {Record<string, unknown>} [context]
 */
export function mapTtV6TeamToCompetitionRoster(source, context = {}) {
  const team = asObject(source);
  /** @type {{ code: string, path: string, message: string }[]} */
  const diagnostics = [];
  if (!team) {
    return {
      success: false,
      value: null,
      diagnostics: [
        { code: "INVALID_SOURCE", path: "", message: "TT roster source must be an object" },
      ],
      sourceVersion: SOURCE_VERSION,
    };
  }

  const teamId = String(team.teamId || team.id || "").trim();
  const competitionId = String(
    context.competitionId || context.tournamentId || team.competitionId || team.tournamentId || ""
  ).trim();
  if (!teamId) {
    diagnostics.push({ code: "MISSING_ID", path: "teamId", message: "teamId is required" });
  }
  if (!competitionId) {
    diagnostics.push({
      code: "MISSING_COMPETITION_ID",
      path: "competitionId",
      message: "competitionId is required",
    });
  }

  // Explicitly ignore lineup selections — never import into roster
  if (context.lineup != null || team.selections != null || team.lineups != null) {
    // diagnostic info only — not an error
    diagnostics.push({
      code: "LINEUP_EXCLUDED",
      path: "lineup",
      message: "Lineup fields are excluded from roster membership mapping",
    });
  }

  const playerIds = Array.isArray(team.playerIds)
    ? team.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const absentSet = new Set(
    (Array.isArray(team.absentPlayerIds) ? team.absentPlayerIds : []).map(String)
  );
  const lockedPlayerSet = new Set(
    (Array.isArray(team.lockedPlayerIds) ? team.lockedPlayerIds : []).map(String)
  );
  const captainId = team.captainPlayerId ? String(team.captainPlayerId).trim() : "";
  const rosterId = `roster:tt:${teamId}`;
  const locked = isExplicitRosterLocked(team, context);

  // Core-05: lockedPlayerIds MUST NOT imply roster lock
  if (
    !locked &&
    lockedPlayerSet.size > 0 &&
    context.treatLockedPlayerIdsAsRosterLock === true
  ) {
    diagnostics.push({
      code: "LOCKED_PLAYER_IDS_IGNORED_FOR_FREEZE",
      path: "lockedPlayerIds",
      message:
        "Core-05 compat ignores treatLockedPlayerIdsAsRosterLock — lockedPlayerIds are not roster freeze",
    });
  }

  const members = playerIds.map((pid) =>
    createCompetitionRosterMember({
      id: `rm:${teamId}:${pid}`,
      rosterId,
      person: createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id: pid,
      }),
      status: absentSet.has(pid)
        ? COMPETITION_ROSTER_MEMBER_STATUS.ABSENT
        : COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE,
      role: captainId && captainId === pid ? "captain" : "player",
      joinedAt: null,
      extensions: createFormatExtension({
        formatKey: FORMAT_KEY,
        payload: {
          lockedPlayer: lockedPlayerSet.has(pid),
          // absent is status ABSENT — not removedAt
        },
      }),
    })
  );

  const value = createCompetitionRoster({
    id: rosterId,
    competitionId,
    teamId,
    tenantId: context.tenantId || team.tenantId || null,
    divisionId: context.divisionId || team.divisionId || null,
    divisionCategoryId: context.divisionCategoryId || team.divisionCategoryId || null,
    members,
    status: locked ? COMPETITION_ROSTER_STATUS.ROSTER_LOCKED : COMPETITION_ROSTER_STATUS.DRAFT,
    lockedAt: locked ? team.lockedAt || context.lockedAt || null : null,
    lockReason: locked ? team.lockReason || context.lockReason || null : null,
    minSize: typeof team.minSize === "number" ? team.minSize : null,
    maxSize: typeof team.maxSize === "number" ? team.maxSize : null,
    rosterVersion: typeof team.rosterVersion === "number" ? team.rosterVersion : 0,
    identityKey: buildRosterIdentityKey({ competitionId, teamId }),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        lockedPlayerIds: [...lockedPlayerSet],
        absentPlayerIds: [...absentSet],
        deputyPlayerIds: Array.isArray(team.deputyPlayerIds)
          ? team.deputyPlayerIds.map(String)
          : [],
        // Confirm lineup not present on roster payload
        lineupExcluded: true,
      },
    }),
  });

  const errors = diagnostics.filter((d) =>
    ["MISSING_ID", "MISSING_COMPETITION_ID", "INVALID_SOURCE"].includes(d.code)
  );

  return {
    success: errors.length === 0,
    value: errors.length === 0 ? value : null,
    diagnostics,
    sourceVersion: SOURCE_VERSION,
  };
}

/**
 * Map TT team → { team, roster } bundle. Lineup never included as roster members.
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTtV6TeamBundle(source, context = {}) {
  const teamResult = mapTtV6TeamToCompetitionTeam(source, context);
  const rosterResult = mapTtV6TeamToCompetitionRoster(source, context);
  const diagnostics = [...teamResult.diagnostics, ...rosterResult.diagnostics];
  const success = teamResult.success && rosterResult.success;
  return {
    success,
    value: success
      ? { team: teamResult.value, roster: rosterResult.value, lineup: null }
      : null,
    diagnostics,
    sourceVersion: SOURCE_VERSION,
  };
}
