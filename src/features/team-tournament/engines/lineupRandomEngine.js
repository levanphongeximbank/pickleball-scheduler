import { LINEUP_SOURCE, LINEUP_STATUS, GENDER_REQUIREMENT } from "../constants.js";
import { getPlayerGenderKey } from "../../../models/player.js";
import {
  findTeam,
  lineupKey,
  normalizeLineup,
  normalizeTeamData,
} from "../models/index.js";
import { computeTeamRosterStats } from "./teamRosterEngine.js";
import { validateDisciplineSelection } from "./lineupValidationEngine.js";
import {
  PRIVATE_PAIRING_OPERATION,
  attachV6CompetitionOptimizationAudit,
  createV6SeededRng,
  evaluateV6PrivatePairingCandidate,
  mintV6OptimizationSeed,
  snapshotLineupSelections,
  V6_OPTIMIZATION_ACTION,
} from "../private-pairing/index.js";
import { seededShuffle } from "../../private-pairing-rules/runtime/seededRng.js";
import { buildScoreBreakdown } from "../../private-pairing-rules/index.js";
import {
  LINEUP_GLOBAL_ALGORITHM_VERSION,
  runLineupGlobalOptimizer,
} from "../../competition-optimizer/index.js";

function shuffle(array = [], rng = null) {
  if (typeof rng === "function") {
    return seededShuffle(array, rng);
  }
  // Deterministic fallback when caller forgot seed — never use unseeded entropy on V6 path.
  return seededShuffle(array, createV6SeededRng("lineup-fallback"));
}

function sortByAppearanceCount(playerIds, appearanceCounts) {
  return [...playerIds].sort((left, right) => {
    const leftCount = appearanceCounts.get(String(left)) || 0;
    const rightCount = appearanceCounts.get(String(right)) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }
    return String(left).localeCompare(String(right));
  });
}

function matchesGenderRequirement(player, requirement) {
  const gender = getPlayerGenderKey(player.gender);

  if (requirement === GENDER_REQUIREMENT.MALE) {
    return gender === "male";
  }

  if (requirement === GENDER_REQUIREMENT.FEMALE) {
    return gender === "female";
  }

  return true;
}

function eligiblePlayersForDiscipline(team, discipline, players, usedPlayerIds, allowReuse) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));

  return team.playerIds.filter((playerId) => {
    if (!allowReuse && usedPlayerIds.has(String(playerId))) {
      return false;
    }

    if (team.absentPlayerIds?.includes(String(playerId)) ||
      team.lockedPlayerIds?.includes(String(playerId))) {
      return false;
    }

    const player = playersById.get(String(playerId));
    if (!player) {
      return false;
    }

    if (!matchesGenderRequirement(player, discipline.genderRequirement)) {
      return false;
    }

    if (discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR) {
      const genderKey = getPlayerGenderKey(player.gender);
      if (genderKey !== "male" && genderKey !== "female") {
        return false;
      }
    }

    if (discipline.playerCount === 1) {
      return validateDisciplineSelection({
        team,
        discipline,
        playerIds: [playerId],
        players,
        usedPlayerIds,
        allowReuse: true,
      }).ok;
    }

    return true;
  });
}

function combinations(values, size) {
  if (size <= 0) {
    return [[]];
  }

  if (values.length < size) {
    return [];
  }

  if (size === 1) {
    return values.map((value) => [value]);
  }

  const results = [];
  values.forEach((head, index) => {
    const tailCombos = combinations(values.slice(index + 1), size - 1);
    tailCombos.forEach((combo) => {
      results.push([head, ...combo]);
    });
  });
  return results;
}

function scorePairAgainstPrivateRules(playerIds, playersById, pairingOptions) {
  if (!pairingOptions?.privatePairingRules?.length) {
    return { feasible: true, scoreBreakdown: buildScoreBreakdown({}), rejectionCodes: [] };
  }

  const members = playerIds
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  return evaluateV6PrivatePairingCandidate(
    {
      id: `lineup-pair-${playerIds.map(String).sort().join("-")}`,
      teams: [
        {
          playerIds: playerIds.map(String),
          members,
        },
      ],
    },
    {
      operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
      privatePairingRules: pairingOptions.privatePairingRules,
      clubId: pairingOptions.clubId,
      tournamentId: pairingOptions.tournamentId,
      eventId: pairingOptions.eventId,
      teamId: pairingOptions.teamId,
      matchupId: pairingOptions.matchupId,
      competitionClass: pairingOptions.competitionClass,
      envSource: pairingOptions.envSource,
      playersById: Object.fromEntries(playersById),
      history: pairingOptions.pairingHistory || {},
      defaultPenalty: 0,
    }
  );
}

function pickMixedPair({
  team,
  discipline,
  players,
  usedPlayerIds,
  appearanceCounts,
  allowReuse,
  rng,
  pairingOptions,
}) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const maleIds = [];
  const femaleIds = [];

  const eligible = new Set(
    eligiblePlayersForDiscipline(team, discipline, players, usedPlayerIds, allowReuse).map(String)
  );

  team.playerIds.forEach((playerId) => {
    if (!eligible.has(String(playerId))) {
      return;
    }
    const player = playersById.get(String(playerId));
    if (!player) {
      return;
    }
    const genderKey = getPlayerGenderKey(player.gender);
    if (genderKey === "male") {
      maleIds.push(String(playerId));
    } else if (genderKey === "female") {
      femaleIds.push(String(playerId));
    }
  });

  const rankedMales = sortByAppearanceCount(shuffle(maleIds, rng), appearanceCounts);
  const rankedFemales = sortByAppearanceCount(shuffle(femaleIds, rng), appearanceCounts);

  let best = null;

  for (const maleId of rankedMales) {
    for (const femaleId of rankedFemales) {
      const validation = validateDisciplineSelection({
        team,
        discipline,
        playerIds: [maleId, femaleId],
        players,
        usedPlayerIds,
        allowReuse,
      });

      if (!validation.ok) {
        continue;
      }

      const scored = scorePairAgainstPrivateRules(
        validation.playerIds,
        playersById,
        pairingOptions
      );
      if (scored.feasible === false) {
        continue;
      }

      const defaultPenalty = Number(scored.scoreBreakdown?.defaultPenalty) || 0;
      const soft =
        (Number(scored.scoreBreakdown?.superAdminPenalty) || 0) +
        (Number(scored.scoreBreakdown?.tournamentPenalty) || 0) +
        (Number(scored.scoreBreakdown?.clubPenalty) || 0) +
        (Number(scored.scoreBreakdown?.sessionPenalty) || 0);

      if (
        !best ||
        soft < best.soft ||
        (soft === best.soft && defaultPenalty < best.defaultPenalty)
      ) {
        best = {
          playerIds: validation.playerIds,
          soft,
          defaultPenalty,
          scoreBreakdown: scored.scoreBreakdown,
        };
      }
    }
  }

  if (best) {
    return {
      ok: true,
      playerIds: best.playerIds,
      scoreBreakdown: best.scoreBreakdown,
    };
  }

  return {
    ok: false,
    error: `${discipline.name}: không đủ cặp nam/nữ để random.`,
  };
}

function pickPlayersForDiscipline({
  team,
  discipline,
  players,
  usedPlayerIds,
  appearanceCounts,
  allowReuse,
  rng,
  pairingOptions,
}) {
  if (
    discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR &&
    discipline.playerCount === 2
  ) {
    return pickMixedPair({
      team,
      discipline,
      players,
      usedPlayerIds,
      appearanceCounts,
      allowReuse,
      rng,
      pairingOptions,
    });
  }

  const candidates = eligiblePlayersForDiscipline(
    team,
    discipline,
    players,
    usedPlayerIds,
    allowReuse
  );

  const ranked = sortByAppearanceCount(shuffle(candidates, rng), appearanceCounts);
  const combos = combinations(ranked, discipline.playerCount);
  const playersById = new Map(players.map((player) => [String(player.id), player]));

  let best = null;

  for (const combo of combos) {
    const validation = validateDisciplineSelection({
      team,
      discipline,
      playerIds: combo,
      players,
      usedPlayerIds,
      allowReuse,
    });

    if (!validation.ok) {
      continue;
    }

    let scoreBreakdown = buildScoreBreakdown({});
    if (discipline.playerCount >= 2) {
      const scored = scorePairAgainstPrivateRules(
        validation.playerIds,
        playersById,
        pairingOptions
      );
      if (scored.feasible === false) {
        continue;
      }
      scoreBreakdown = scored.scoreBreakdown || scoreBreakdown;
    }

    const soft =
      (Number(scoreBreakdown.superAdminPenalty) || 0) +
      (Number(scoreBreakdown.tournamentPenalty) || 0) +
      (Number(scoreBreakdown.clubPenalty) || 0) +
      (Number(scoreBreakdown.sessionPenalty) || 0);
    const defaultPenalty = Number(scoreBreakdown.defaultPenalty) || 0;

    if (
      !best ||
      soft < best.soft ||
      (soft === best.soft && defaultPenalty < best.defaultPenalty)
    ) {
      best = {
        playerIds: validation.playerIds,
        soft,
        defaultPenalty,
        scoreBreakdown,
      };
    }
  }

  if (best) {
    return {
      ok: true,
      playerIds: best.playerIds,
      scoreBreakdown: best.scoreBreakdown,
    };
  }

  return {
    ok: false,
    error: `${discipline.name}: không đủ VĐV hợp lệ để random.`,
  };
}

function buildRandomSelections(team, teamData, players, allowReuse, rng, pairingOptions) {
  const usedPlayerIds = new Set();
  const appearanceCounts = new Map();
  const selections = {};
  const errors = [];
  const scoreParts = [];

  team.playerIds.forEach((playerId) => {
    appearanceCounts.set(String(playerId), 0);
  });

  for (const discipline of teamData.disciplines) {
    const result = pickPlayersForDiscipline({
      team,
      discipline,
      players,
      usedPlayerIds,
      appearanceCounts,
      allowReuse,
      rng,
      pairingOptions,
    });

    if (!result.ok) {
      errors.push(result.error);
      continue;
    }

    result.playerIds.forEach((playerId) => {
      if (!allowReuse) {
        usedPlayerIds.add(String(playerId));
      }
      appearanceCounts.set(
        String(playerId),
        (appearanceCounts.get(String(playerId)) || 0) + 1
      );
    });
    selections[discipline.id] = result.playerIds;
    if (result.scoreBreakdown) {
      scoreParts.push(result.scoreBreakdown);
    }
  }

  const mergedScore = buildScoreBreakdown({
    penaltyBySource: {
      SUPER_ADMIN: scoreParts.reduce((s, p) => s + (Number(p.superAdminPenalty) || 0), 0),
      TOURNAMENT: scoreParts.reduce((s, p) => s + (Number(p.tournamentPenalty) || 0), 0),
      CLUB: scoreParts.reduce((s, p) => s + (Number(p.clubPenalty) || 0), 0),
      SESSION: scoreParts.reduce((s, p) => s + (Number(p.sessionPenalty) || 0), 0),
    },
    defaultPenalty: scoreParts.reduce((s, p) => s + (Number(p.defaultPenalty) || 0), 0),
  });

  return {
    ok: errors.length === 0,
    selections,
    errors,
    usedReuse: allowReuse,
    scoreBreakdown: mergedScore,
  };
}

function formatRandomLineupFailure(team, players, errors) {
  const stats = computeTeamRosterStats(team, players);
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const missingCount = team.playerIds.filter((playerId) => !playersById.has(String(playerId))).length;

  const parts = [
    `${team.name}: ${errors.join(" ")}`,
    `Đội có ${stats.males} nam, ${stats.females} nữ (${stats.total} VĐV).`,
  ];

  if (missingCount > 0) {
    parts.push(`${missingCount} VĐV trên đội không khớp dữ liệu hệ thống — kiểm tra CLB/giới tính.`);
  }

  parts.push(
    "Gợi ý: thêm đủ VĐV nam/nữ theo nội dung giải, hoặc bật «Cho phép VĐV đá nhiều nội dung»."
  );

  return parts.join(" ");
}

/**
 * Auto-generate locked lineup for a missing team.
 * Uses shared Private Pairing Rules (LINEUP_FORMATION) + seeded RNG.
 */
export function randomizeMissingLineups(
  teamData,
  {
    matchupId,
    teamId,
    players = [],
    now = new Date(),
    randomSeed = null,
    privatePairingRules = [],
    clubId = null,
    tournamentId = null,
    eventId = null,
    competitionClass = null,
    envSource,
    pairingHistory = null,
    actorId = null,
    budget = undefined,
  } = {}
) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const existing = teamData?.settings?.competitionOptimizationAudit?.byOperation?.[
    PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION
  ];
  if ((privatePairingRules || []).length > 0 && !tournamentId && !clubId) {
    return {
      ok: false,
      error: "Thiếu context giải/CLB khi auto-generate đội hình theo quy tắc ưu tiên.",
      code: "PRIVATE_PAIRING_CONTEXT_REQUIRED",
    };
  }

  const seed = randomSeed || mintV6OptimizationSeed(existing?.randomSeed);
  const playersById = Object.fromEntries(
    (players || []).map((player) => [String(player.id), player])
  );
  const configuredReuse = teamData.settings?.allowPlayerReusePerMatchup === true;
  const previousSelections =
    teamData.lineups?.[lineupKey(matchupId, teamId)]?.selections || null;

  const optimized = runLineupGlobalOptimizer({
    team,
    disciplines: teamData.disciplines || [],
    players,
    playersById,
    matchupId,
    teamId,
    randomSeed: seed,
    allowReuse: configuredReuse,
    allowReuseFallback: !configuredReuse,
    previousSelections,
    privatePairingRules,
    rules: privatePairingRules,
    pairingHistory,
    history: pairingHistory,
    context: {
      clubId,
      tournamentId,
      eventId,
      competitionClass,
      teamId,
      matchupId,
      operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
    },
    budget,
  });

  if (!optimized.ok || !optimized.selections) {
    const baselineErrors = ["Không tìm được đội hình hợp lệ theo Global Optimizer."];
    // Keep greedy baseline as diagnostic fallback message only — do not persist it.
    const rng = createV6SeededRng(seed);
    const diagnostic = buildRandomSelections(
      team,
      teamData,
      players,
      configuredReuse,
      rng,
      {
        privatePairingRules,
        clubId,
        tournamentId,
        eventId,
        teamId,
        matchupId,
        competitionClass,
        envSource,
        pairingHistory,
      }
    );
    return {
      ok: false,
      error: formatRandomLineupFailure(
        team,
        players,
        diagnostic.ok ? baselineErrors : diagnostic.errors || baselineErrors
      ),
      code: "NO_FEASIBLE_LINEUP",
      diagnostics: optimized.diagnostics || null,
      rejectionCodes: optimized.rejectionCodes || [],
    };
  }

  const usedReuseFallback =
    optimized.bestCandidate?.allowReuse === true && !configuredReuse;
  const lockTime = new Date(now).toISOString();
  const timeLabel = new Date(now).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const reuseNote = usedReuseFallback
    ? " Một số VĐV được xếp cho nhiều nội dung vì đội thiếu người."
    : "";
  const auditNote = `Đội ${team.name} không nộp đội hình trước hạn. Hệ thống đã tự động chọn đội hình lúc ${timeLabel}.${reuseNote}`;

  const lineup = normalizeLineup({
    matchupId,
    teamId,
    status: LINEUP_STATUS.LOCKED,
    selections: optimized.selections,
    lockedAt: lockTime,
    source: LINEUP_SOURCE.RANDOM,
    auditNote,
  });

  const key = lineupKey(matchupId, teamId);
  let nextTeamData = normalizeTeamData({
    ...teamData,
    lineups: {
      ...teamData.lineups,
      [key]: lineup,
    },
  });

  nextTeamData = attachV6CompetitionOptimizationAudit(nextTeamData, {
    operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
    context: {
      matchupId,
      teamId,
      tournamentId,
      clubId,
      operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
    },
    algorithmVersion: LINEUP_GLOBAL_ALGORITHM_VERSION,
    randomSeed: seed,
    scoreBreakdown: optimized.scoreBreakdown,
    diagnostics: {
      ...(optimized.diagnostics || {}),
      usedReuseFallback,
      baselineFeasible: optimized.baseline?.feasible === true,
    },
    previousSnapshot: snapshotLineupSelections(teamData.lineups?.[key] || null),
    resultSnapshot: snapshotLineupSelections(lineup),
    actorId,
    action: V6_OPTIMIZATION_ACTION.AUTO_DEADLINE_GENERATE,
    lockStatus: LINEUP_STATUS.LOCKED,
    revealStatus: null,
  });

  return {
    ok: true,
    teamData: nextTeamData,
    lineup,
    auditNote,
    randomSeed: seed,
    algorithmVersion: LINEUP_GLOBAL_ALGORITHM_VERSION,
    scoreBreakdown: optimized.scoreBreakdown,
    diagnostics: optimized.diagnostics,
    authorityScore: optimized.authorityScore,
  };
}

export function countPlayerAppearances(teamData, teamId) {
  const counts = new Map();

  Object.values(teamData.lineups || {}).forEach((lineup) => {
    if (lineup.teamId !== String(teamId)) {
      return;
    }

    Object.values(lineup.selections || {}).forEach((playerIds) => {
      playerIds.forEach((playerId) => {
        const key = String(playerId);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
  });

  return counts;
}
