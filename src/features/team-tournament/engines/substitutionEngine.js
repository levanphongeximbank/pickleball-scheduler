/**
 * S2-C — Roster substitution before lineup lock/publish.
 * Mid-match / post-publish changes remain TT-3 BTC override (out of S2-C).
 */

import { createId } from "../../../utils/id.js";
import { LINEUP_STATUS } from "../constants.js";
import { findTeam, lineupKey, normalizeTeamData } from "../models/index.js";
import { findPlayerTeam, validateAddPlayerToTeam } from "./teamRosterEngine.js";
import { updateTeamInTournament } from "./teamTournamentEngine.js";
import {
  LINEUP_IMMUTABLE_STATUSES,
  canCaptainEditLineupStatus,
} from "./lineupStateMachine.js";

export const SUBSTITUTION_BLOCK_CODE = Object.freeze({
  TEAM_MISSING: "TEAM_MISSING",
  OUT_NOT_ON_TEAM: "OUT_NOT_ON_TEAM",
  IN_REQUIRED: "IN_REQUIRED",
  SAME_PLAYER: "SAME_PLAYER",
  IN_ALREADY_ON_TEAM: "IN_ALREADY_ON_TEAM",
  IN_ON_OTHER_TEAM: "IN_ON_OTHER_TEAM",
  LINEUP_LOCKED: "LINEUP_LOCKED",
  MLP_ROSTER: "MLP_ROSTER",
});

function normalizeId(value) {
  return value ? String(value).trim() : "";
}

export function listTeamLineups(teamData, teamId) {
  const tid = normalizeId(teamId);
  return Object.values(teamData?.lineups || {}).filter(
    (lineup) => normalizeId(lineup?.teamId) === tid
  );
}

/**
 * Substitution allowed only while no lineup for this team is locked/published/immutable.
 */
export function getSubstitutionGate(teamData, teamId) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return {
      ok: false,
      allowed: false,
      code: SUBSTITUTION_BLOCK_CODE.TEAM_MISSING,
      error: "Không tìm thấy đội.",
      blockingLineups: [],
    };
  }

  const blockingLineups = listTeamLineups(teamData, teamId).filter((lineup) =>
    LINEUP_IMMUTABLE_STATUSES.has(lineup.status)
  );

  if (blockingLineups.length > 0) {
    return {
      ok: false,
      allowed: false,
      code: SUBSTITUTION_BLOCK_CODE.LINEUP_LOCKED,
      error:
        "Đội hình đã khóa hoặc công bố — không thay người theo quy trình S2-C. BTC dùng override (TT-3) nếu cần.",
      blockingLineups: blockingLineups.map((lineup) => ({
        matchupId: lineup.matchupId,
        status: lineup.status,
      })),
    };
  }

  return { ok: true, allowed: true, blockingLineups: [] };
}

function replacePlayerInSelections(selections = {}, outPlayerId, inPlayerId) {
  const next = {};
  Object.entries(selections || {}).forEach(([disciplineId, playerIds]) => {
    next[disciplineId] = (playerIds || []).map((id) =>
      String(id) === outPlayerId ? inPlayerId : String(id)
    );
  });
  return next;
}

function patchEditableLineups(teamData, teamId, outPlayerId, inPlayerId) {
  const tid = normalizeId(teamId);
  const lineups = { ...(teamData.lineups || {}) };
  let patched = 0;

  Object.entries(lineups).forEach(([key, lineup]) => {
    if (normalizeId(lineup?.teamId) !== tid) return;
    if (!canCaptainEditLineupStatus(lineup.status || LINEUP_STATUS.NOT_SUBMITTED)) {
      return;
    }
    const selections = replacePlayerInSelections(
      lineup.selections,
      outPlayerId,
      inPlayerId
    );
    lineups[key] = {
      ...lineup,
      selections,
    };
    patched += 1;
  });

  return { lineups, patched };
}

/**
 * Apply out→in roster substitution (pre-lock/pre-publish only).
 */
export function applyRosterSubstitution(teamData, options = {}, players = []) {
  const teamId = normalizeId(options.teamId);
  const outPlayerId = normalizeId(options.outPlayerId);
  const inPlayerId = normalizeId(options.inPlayerId);
  const reason = options.reason ? String(options.reason).trim() : "";

  const gate = getSubstitutionGate(teamData, teamId);
  if (!gate.allowed) {
    return gate;
  }

  const team = findTeam(teamData, teamId);
  if (!outPlayerId || !(team.playerIds || []).includes(outPlayerId)) {
    return {
      ok: false,
      error: "VĐV ra phải thuộc đội.",
      code: SUBSTITUTION_BLOCK_CODE.OUT_NOT_ON_TEAM,
    };
  }

  if (!inPlayerId) {
    return {
      ok: false,
      error: "Chọn VĐV vào.",
      code: SUBSTITUTION_BLOCK_CODE.IN_REQUIRED,
    };
  }

  if (outPlayerId === inPlayerId) {
    return {
      ok: false,
      error: "VĐV ra và vào trùng nhau.",
      code: SUBSTITUTION_BLOCK_CODE.SAME_PLAYER,
    };
  }

  if ((team.playerIds || []).includes(inPlayerId)) {
    return {
      ok: false,
      error: "VĐV vào đã có trong đội.",
      code: SUBSTITUTION_BLOCK_CODE.IN_ALREADY_ON_TEAM,
    };
  }

  const otherTeam = findPlayerTeam(teamData, inPlayerId);
  const allowCrossTeam = teamData?.settings?.allowPlayerCrossTeam === true;
  if (otherTeam && otherTeam.id !== teamId && !allowCrossTeam) {
    return {
      ok: false,
      error: `VĐV vào đã thuộc đội ${otherTeam.name}.`,
      code: SUBSTITUTION_BLOCK_CODE.IN_ON_OTHER_TEAM,
    };
  }

  // Validate MLP / roster rules as if adding after a remove
  const provisional = {
    ...teamData,
    teams: (teamData.teams || []).map((row) =>
      row.id === teamId
        ? {
            ...row,
            playerIds: row.playerIds.filter((id) => id !== outPlayerId),
          }
        : row
    ),
  };
  const addCheck = validateAddPlayerToTeam(
    provisional,
    teamId,
    inPlayerId,
    players
  );
  if (!addCheck.ok) {
    return {
      ok: false,
      error: addCheck.error,
      code: SUBSTITUTION_BLOCK_CODE.MLP_ROSTER,
      errors: addCheck.errors,
    };
  }

  const nextPlayerIds = [
    ...team.playerIds.filter((id) => id !== outPlayerId),
    inPlayerId,
  ];
  let nextCaptain = team.captainPlayerId || "";
  let captainChanged = false;
  if (nextCaptain === outPlayerId) {
    nextCaptain = inPlayerId;
    captainChanged = true;
  }

  const nextDeputies = (team.deputyPlayerIds || [])
    .filter((id) => id !== outPlayerId && id !== nextCaptain)
    .concat(
      // if in was deputy of someone else — n/a; keep deputies clean
    );

  let next = updateTeamInTournament(teamData, teamId, {
    playerIds: nextPlayerIds,
    captainPlayerId: nextCaptain,
    deputyPlayerIds: nextDeputies,
  });

  const lineupPatch = patchEditableLineups(next, teamId, outPlayerId, inPlayerId);
  next = normalizeTeamData({
    ...next,
    lineups: lineupPatch.lineups,
  });

  const entry = {
    id: createId("sub"),
    teamId,
    outPlayerId,
    inPlayerId,
    reason,
    captainChanged,
    lineupsPatched: lineupPatch.patched,
    at: options.at || new Date().toISOString(),
    actorRole: options.actorRole || "",
    actorPlayerId: options.actorPlayerId ? String(options.actorPlayerId) : "",
  };

  const priorLog = Array.isArray(next.substitutionLog)
    ? next.substitutionLog
    : Array.isArray(next.settings?.substitutionLog)
      ? next.settings.substitutionLog
      : [];

  next = normalizeTeamData({
    ...next,
    substitutionLog: [...priorLog, entry].slice(-100),
    settings: {
      ...(next.settings || {}),
      substitutionLog: [...priorLog, entry].slice(-100),
    },
  });

  return {
    ok: true,
    teamData: next,
    entry,
    warnings: captainChanged
      ? ["Đội trưởng bị thay — VĐV vào được gán làm đội trưởng mới."]
      : [],
  };
}

export function listSubstitutionLog(teamData, teamId = "") {
  const log = Array.isArray(teamData?.substitutionLog)
    ? teamData.substitutionLog
    : Array.isArray(teamData?.settings?.substitutionLog)
      ? teamData.settings.substitutionLog
      : [];
  if (!teamId) return log;
  const tid = normalizeId(teamId);
  return log.filter((row) => normalizeId(row.teamId) === tid);
}

export { lineupKey };
