/**
 * S2-D — Team tournament group stage → knockout (no KO-direct).
 */

import { createId } from "../../../utils/id.js";
import { MATCHUP_STATUS } from "../constants.js";
import {
  createMatchupRecord,
  findMatchup,
  normalizeTeamData,
} from "../models/index.js";
import { getStandingsTable } from "./teamStandingsEngine.js";

export const MATCHUP_STAGE = Object.freeze({
  GROUP: "group",
  KNOCKOUT: "knockout",
});

export function isKnockoutMatchup(matchup) {
  return String(matchup?.stage || "") === MATCHUP_STAGE.KNOCKOUT;
}

export function isGroupStageMatchup(matchup) {
  return !isKnockoutMatchup(matchup);
}

function nextPowerOfTwo(n) {
  let value = 1;
  const need = Math.max(1, Number(n) || 1);
  while (value < need) value *= 2;
  return value;
}

export function listGroupStageMatchups(teamData) {
  return (teamData?.matchups || []).filter(isGroupStageMatchup);
}

export function listKnockoutMatchups(teamData) {
  return (teamData?.matchups || []).filter(isKnockoutMatchup);
}

/**
 * Standings limited to one group (group RR matchups only).
 */
export function computeGroupStandings(teamData, groupId) {
  const group = (teamData?.groups || []).find((row) => String(row.id) === String(groupId));
  if (!group) {
    return [];
  }
  const teamIdSet = new Set((group.teamIds || []).map(String));
  const subset = {
    ...teamData,
    teams: (teamData.teams || []).filter((team) => teamIdSet.has(String(team.id))),
    matchups: listGroupStageMatchups(teamData).filter(
      (matchup) =>
        String(matchup.groupId || "") === String(groupId) ||
        (teamIdSet.has(String(matchup.teamAId)) &&
          teamIdSet.has(String(matchup.teamBId)))
    ),
  };
  return getStandingsTable(subset).map((row, index) => ({
    ...row,
    rank: index + 1,
    groupId: String(groupId),
    groupName: group.name || groupId,
  }));
}

export function qualifyTeamsFromGroups(teamData, options = {}) {
  const qualifiersPerGroup = Math.max(1, Number(options.qualifiersPerGroup) || 2);
  const groups = (teamData?.groups || []).filter(
    (group) => (group.teamIds || []).length >= 2
  );

  if (groups.length === 0) {
    return {
      ok: false,
      error: "Cần chia bảng trước khi tạo knockout (group → KO).",
      code: "GROUPS_REQUIRED",
      qualified: [],
    };
  }

  const perGroup = groups.map((group) => {
    const standing = computeGroupStandings(teamData, group.id);
    const qualified = standing.slice(0, qualifiersPerGroup).map((row, index) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      groupId: group.id,
      groupName: group.name || group.id,
      groupRank: index + 1,
      seedLabel: `${group.name || "Bảng"}-${index + 1}`,
    }));
    return { groupId: group.id, groupName: group.name, standing, qualified };
  });

  // Seed order: all #1s then #2s … (A1,B1,C1,… then A2,B2,…)
  const qualified = [];
  for (let rank = 1; rank <= qualifiersPerGroup; rank += 1) {
    perGroup.forEach((row) => {
      const slot = row.qualified[rank - 1];
      if (slot) qualified.push(slot);
    });
  }

  if (qualified.length < 2) {
    return {
      ok: false,
      error: "Cần ít nhất 2 đội vượt qua vòng bảng.",
      code: "NOT_ENOUGH_QUALIFIERS",
      perGroup,
      qualified,
    };
  }

  return { ok: true, qualifiersPerGroup, perGroup, qualified };
}

export function canGenerateTeamKnockout(teamData, options = {}) {
  const check = qualifyTeamsFromGroups(teamData, options);
  if (!check.ok) {
    return { ok: false, allowed: false, error: check.error, code: check.code };
  }
  if ((teamData?.disciplines || []).length === 0) {
    return {
      ok: false,
      allowed: false,
      error: "Cần ít nhất 1 nội dung thi đấu.",
      code: "NO_DISCIPLINES",
    };
  }
  return {
    ok: true,
    allowed: true,
    qualifiedCount: check.qualified.length,
    qualifiersPerGroup: check.qualifiersPerGroup,
  };
}

function stripExistingKnockout(teamData) {
  return normalizeTeamData({
    ...teamData,
    matchups: listGroupStageMatchups(teamData),
    knockout: null,
  });
}

/**
 * Pair seeds for first round: 1 vs last, 2 vs second-last, …
 */
export function pairSeedsForFirstRound(qualified = []) {
  const size = nextPowerOfTwo(qualified.length);
  const slots = Array.from({ length: size }, () => null);
  qualified.forEach((entry, index) => {
    slots[index] = entry;
  });

  const pairs = [];
  for (let i = 0; i < size / 2; i += 1) {
    pairs.push({
      teamA: slots[i],
      teamB: slots[size - 1 - i],
      matchNumberInRound: i + 1,
    });
  }
  return pairs;
}

function buildEmptyKnockoutMatchup(teamData, options = {}) {
  return createMatchupRecord(options.teamAId || "", options.teamBId || "", {
    disciplines: teamData.disciplines,
    groupId: "",
    roundNumber: options.roundNumber,
    matchNumberInRound: options.matchNumberInRound,
    status: options.status || MATCHUP_STATUS.LINEUP_OPEN,
    stage: MATCHUP_STAGE.KNOCKOUT,
    bracketMatchId: options.bracketMatchId,
    nextMatchupId: options.nextMatchupId || "",
    nextSlot: options.nextSlot || "",
    bracketRoundLabel: options.bracketRoundLabel || "",
  });
}

/**
 * Generate knockout bracket matchups; preserves group RR matchups.
 */
export function generateTeamKnockoutMatchups(teamData, options = {}) {
  const gate = canGenerateTeamKnockout(teamData, options);
  if (!gate.allowed) {
    return gate;
  }

  const qualification = qualifyTeamsFromGroups(teamData, options);
  const base = options.replaceExisting === false ? teamData : stripExistingKnockout(teamData);
  const pairs = pairSeedsForFirstRound(qualification.qualified);
  const bracketSize = pairs.length * 2;
  const roundCount = Math.log2(bracketSize);

  const roundLabels = [];
  for (let round = 1; round <= roundCount; round += 1) {
    const remaining = bracketSize / 2 ** round;
    let label = `Vòng ${round}`;
    if (remaining === 1) label = "Chung kết";
    else if (remaining === 2) label = "Bán kết";
    else if (remaining === 4) label = "Tứ kết";
    roundLabels.push(label);
  }

  /** @type {object[][]} */
  const rounds = Array.from({ length: roundCount }, () => []);

  // Pre-create all matchups with ids for next-pointer wiring
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const matchesInRound = bracketSize / 2 ** (roundIndex + 1);
    for (let m = 0; m < matchesInRound; m += 1) {
      const id = createId("ko");
      rounds[roundIndex].push({
        id,
        roundNumber: roundIndex + 1,
        matchNumberInRound: m + 1,
        bracketMatchId: `KO-R${roundIndex + 1}-M${m + 1}`,
        bracketRoundLabel: roundLabels[roundIndex],
      });
    }
  }

  for (let roundIndex = 0; roundIndex < roundCount - 1; roundIndex += 1) {
    rounds[roundIndex].forEach((slot, matchIndex) => {
      const next = rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
      slot.nextMatchupId = next.id;
      slot.nextSlot = matchIndex % 2 === 0 ? "A" : "B";
    });
  }

  const firstRoundPairs = pairs;
  const knockoutMatchups = [];

  rounds.forEach((roundSlots, roundIndex) => {
    roundSlots.forEach((slot, matchIndex) => {
      let teamAId = "";
      let teamBId = "";
      let status = MATCHUP_STATUS.LINEUP_OPEN;
      let result = null;

      if (roundIndex === 0) {
        const pair = firstRoundPairs[matchIndex];
        teamAId = pair?.teamA?.teamId || "";
        teamBId = pair?.teamB?.teamId || "";
        // Bye: only one side filled
        if (teamAId && !teamBId) {
          status = MATCHUP_STATUS.COMPLETED;
          result = {
            teamAWins: 1,
            teamBWins: 0,
            teamAPoints: 0,
            teamBPoints: 0,
            winnerTeamId: teamAId,
            resultType: "bye",
          };
        } else if (!teamAId && teamBId) {
          status = MATCHUP_STATUS.COMPLETED;
          result = {
            teamAWins: 0,
            teamBWins: 1,
            teamAPoints: 0,
            teamBPoints: 0,
            winnerTeamId: teamBId,
            resultType: "bye",
          };
        }
      }

      const matchup = buildEmptyKnockoutMatchup(base, {
        teamAId,
        teamBId,
        roundNumber: slot.roundNumber,
        matchNumberInRound: slot.matchNumberInRound,
        bracketMatchId: slot.bracketMatchId,
        nextMatchupId: slot.nextMatchupId,
        nextSlot: slot.nextSlot,
        bracketRoundLabel: slot.bracketRoundLabel,
        status,
      });
      matchup.id = slot.id;
      if (result) {
        matchup.result = result;
      }
      knockoutMatchups.push(matchup);
    });
  });

  const generatedAt = options.generatedAt || new Date().toISOString();
  let next = normalizeTeamData({
    ...base,
    matchups: [...listGroupStageMatchups(base), ...knockoutMatchups],
    knockout: {
      generatedAt,
      qualifiersPerGroup: qualification.qualifiersPerGroup,
      qualified: qualification.qualified,
      bracketSize,
      roundCount,
      roundLabels,
    },
    settings: {
      ...(base.settings || {}),
      tiebreakFrozen: true,
      tiebreakFrozenAt: generatedAt,
      tiebreakFrozenReason: "knockout_generate",
    },
  });

  // Advance byes into next round
  knockoutMatchups
    .filter((matchup) => matchup.result?.resultType === "bye" && matchup.result.winnerTeamId)
    .forEach((matchup) => {
      const advanced = advanceTeamKnockoutWinner(next, matchup.id);
      if (advanced.ok) {
        next = advanced.teamData;
      }
    });

  return {
    ok: true,
    teamData: next,
    qualified: qualification.qualified,
    knockoutMatchCount: listKnockoutMatchups(next).length,
  };
}

/**
 * Place winner into next knockout matchup slot.
 */
export function advanceTeamKnockoutWinner(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup || !isKnockoutMatchup(matchup)) {
    return { ok: false, error: "Không phải trận knockout.", code: "NOT_KNOCKOUT" };
  }

  const winnerId = matchup.result?.winnerTeamId
    ? String(matchup.result.winnerTeamId)
    : "";
  if (!winnerId) {
    return { ok: false, error: "Trận chưa có đội thắng.", code: "NO_WINNER" };
  }

  const nextId = matchup.nextMatchupId ? String(matchup.nextMatchupId) : "";
  if (!nextId) {
    return {
      ok: true,
      teamData,
      advanced: false,
      championTeamId: winnerId,
      message: "Đã xác định nhà vô địch (chung kết).",
    };
  }

  const slot = matchup.nextSlot === "B" ? "B" : "A";
  const matchups = (teamData.matchups || []).map((row) => {
    if (String(row.id) !== nextId) return row;
    if (slot === "A") {
      return { ...row, teamAId: winnerId };
    }
    return { ...row, teamBId: winnerId };
  });

  return {
    ok: true,
    teamData: normalizeTeamData({ ...teamData, matchups }),
    advanced: true,
    nextMatchupId: nextId,
    slot,
    winnerTeamId: winnerId,
  };
}

/**
 * Call after a matchup result is finalized.
 */
export function maybeAdvanceKnockoutAfterResult(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup || !isKnockoutMatchup(matchup)) {
    return { ok: true, teamData, advanced: false };
  }
  if (matchup.status !== MATCHUP_STATUS.COMPLETED && !matchup.result?.winnerTeamId) {
    return { ok: true, teamData, advanced: false };
  }
  if (!matchup.result?.winnerTeamId) {
    return { ok: true, teamData, advanced: false };
  }
  return advanceTeamKnockoutWinner(teamData, matchupId);
}
