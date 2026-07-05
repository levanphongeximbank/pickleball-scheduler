import { createId } from "../../../utils/id.js";
import { findMatchup, findTeam, normalizeTeamData } from "../models/index.js";

function patchSettings(teamData, patch) {
  return normalizeTeamData({
    ...teamData,
    settings: {
      ...teamData.settings,
      ...patch,
    },
  });
}

function normalizeReferee(referee = {}) {
  if (!referee?.id) {
    return null;
  }

  return {
    id: String(referee.id).trim(),
    name: String(referee.name || referee.id).trim(),
    phone: referee.phone ? String(referee.phone).trim() : "",
    active: referee.active !== false,
  };
}

function getAssignments(teamData) {
  const raw = teamData?.settings?.refereeAssignments;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return Object.entries(raw).reduce((accumulator, [matchId, refereeId]) => {
    const normalizedRefereeId = refereeId ? String(refereeId).trim() : "";
    if (normalizedRefereeId) {
      accumulator[String(matchId)] = normalizedRefereeId;
    }
    return accumulator;
  }, {});
}

export function listReferees(teamData) {
  const referees = teamData?.settings?.referees;
  if (!Array.isArray(referees)) {
    return [];
  }

  return referees.map(normalizeReferee).filter(Boolean);
}

export function addReferee(teamData, options = {}) {
  const referee = normalizeReferee({
    id: options.id || createId("ref"),
    name: options.name,
    phone: options.phone,
    active: options.active,
  });

  if (!referee?.name) {
    return { ok: false, error: "Tên trọng tài không được để trống." };
  }

  const referees = listReferees(teamData);
  if (referees.some((item) => item.id === referee.id)) {
    return { ok: false, error: "Trọng tài đã tồn tại." };
  }

  return {
    ok: true,
    teamData: patchSettings(teamData, { referees: [...referees, referee] }),
    referee,
  };
}

export function getRefereeForMatch(teamData, matchId) {
  const assignments = getAssignments(teamData);
  const refereeId = assignments[String(matchId)] || "";
  if (!refereeId) {
    return null;
  }

  return listReferees(teamData).find((referee) => referee.id === refereeId) || {
    id: refereeId,
    name: refereeId,
    phone: "",
    active: true,
  };
}

export function assignReferee(teamData, matchId, refereeId) {
  const matchup = findMatchup(teamData, matchId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const normalizedRefereeId = refereeId ? String(refereeId).trim() : "";
  if (!normalizedRefereeId) {
    return { ok: false, error: "Chọn trọng tài." };
  }

  const referee = listReferees(teamData).find((item) => item.id === normalizedRefereeId);
  if (!referee) {
    return { ok: false, error: "Trọng tài không hợp lệ." };
  }

  const assignments = {
    ...getAssignments(teamData),
    [String(matchId)]: normalizedRefereeId,
  };

  return {
    ok: true,
    teamData: patchSettings(teamData, { refereeAssignments: assignments }),
    matchId: String(matchId),
    referee,
  };
}

export function unassignReferee(teamData, matchId) {
  const assignments = { ...getAssignments(teamData) };
  if (!assignments[String(matchId)]) {
    return { ok: false, error: "Lượt đối đầu chưa được phân công trọng tài." };
  }

  delete assignments[String(matchId)];

  return {
    ok: true,
    teamData: patchSettings(teamData, { refereeAssignments: assignments }),
    matchId: String(matchId),
  };
}

export function listMatchesWithoutReferee(teamData) {
  const assignments = getAssignments(teamData);
  return (teamData?.matchups || []).filter((matchup) => !assignments[matchup.id]);
}

export function buildRefereeAssignmentTable(teamData) {
  const referees = listReferees(teamData);

  return (teamData?.matchups || []).map((matchup) => {
    const teamA = findTeam(teamData, matchup.teamAId);
    const teamB = findTeam(teamData, matchup.teamBId);
    const referee = getRefereeForMatch(teamData, matchup.id);

    return {
      matchId: matchup.id,
      scheduledAt: matchup.scheduledAt,
      courtLabel: matchup.courtLabel || "",
      teamAName: teamA?.name || matchup.teamAId,
      teamBName: teamB?.name || matchup.teamBId,
      refereeId: referee?.id || "",
      refereeName: referee?.name || "",
      assigned: Boolean(referee),
      availableReferees: referees,
    };
  });
}
