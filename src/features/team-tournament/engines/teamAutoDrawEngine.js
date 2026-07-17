import { getPlayerGenderKey, getPlayerRatingInternal } from "../../../models/player.js";
import { createId } from "../../../utils/id.js";
import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES } from "../../private-pairing-rules/constants/enums.js";
import {
  buildPrivatePairingRuntimeError,
  createSeededRng,
  evaluatePrivatePairingCandidate,
  filterRulesForGroupStage,
  filterRulesForTeamFormation,
  isPrivatePairingRuntimeEnabled,
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_OPERATION,
  resolveActivePrivatePairingRules,
  sortCandidatesByOptimizationRank,
  splitHardAndSoftRules,
  gateResolvedForStage,
} from "../../private-pairing-rules/runtime/index.js";
import { FORMAT_PRESET, TEAM_GROUP_SEEDING } from "../constants.js";
import {
  createTeamRecord,
  normalizeTeamData,
} from "../models/index.js";
import {
  buildSnakeGroupsFromSortedTeams,
  resolveGroupSeedingMode,
  shuffleTeamsForOpenDraw,
  sortTeamsForGroupSeeding,
} from "./teamGroupSeedEngine.js";
import {
  recommendGroupSizes,
} from "./teamRoundRobinScheduleEngine.js";
import { runGroupDrawGlobalOptimizer } from "../../competition-optimizer/group-draw/groupDrawGlobalOptimizer.js";
import { runMlpFourGlobalOptimizer } from "../../competition-optimizer/team-formation/mlpFourGlobalOptimizer.js";
import { MLP4_GLOBAL_ALGORITHM_VERSION } from "../../competition-optimizer/core/optimizationTypes.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

function formationQualityScore(teams = []) {
  const levels = teams.map((team) => Number(team.avgLevel) || 0);
  if (levels.length < 2) {
    return 100;
  }
  const spread = Math.max(...levels) - Math.min(...levels);
  return Math.max(0, Math.round(100 - spread * 100));
}

const MLP_MEMBERS_PER_TEAM = 4;
const MLP_MALES_PER_TEAM = 2;
const MLP_FEMALES_PER_TEAM = 2;
const TEAM_SPREAD_WARNING_THRESHOLD = 0.25;
const WITHIN_TEAM_MALE_GAP_SOFT_LIMIT = 0.5;
const WITHIN_TEAM_MALE_GAP_PENALTY_WEIGHT = 0.5;

function defaultTeamNames(count) {
  return Array.from({ length: count }, (_, index) => `Đội ${index + 1}`);
}

function resolveTeamNames(teamNames = [], teamCount) {
  const count = Math.max(1, Number(teamCount) || 1);
  const names = Array.isArray(teamNames) ? teamNames.map((name) => String(name || "").trim()) : [];
  const defaults = defaultTeamNames(count);

  return defaults.map((fallback, index) => names[index] || fallback);
}

function isMlpFormatPreset(formatPreset) {
  return formatPreset === FORMAT_PRESET.MLP_4;
}

function playerRating(player) {
  return getPlayerRatingInternal(player);
}

function sortByRatingDesc(players = []) {
  return [...players].sort((left, right) => playerRating(right) - playerRating(left));
}

function shuffleIndices(count, randomFn = createSeededRng(1)) {
  const indices = Array.from({ length: count }, (_, index) => index);

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = indices[index];
    indices[index] = indices[swapIndex];
    indices[swapIndex] = temp;
  }

  return indices;
}

function spreadOf(values = []) {
  if (!values.length) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function rosterAvg(roster = []) {
  if (!roster.length) {
    return 0;
  }
  const total = roster.reduce((sum, player) => sum + playerRating(player), 0);
  return Math.round((total / roster.length) * 100) / 100;
}

function malesInRoster(roster = []) {
  return roster.filter((player) => getPlayerGenderKey(player.gender) === "male");
}

function malePairAvg(roster = []) {
  const males = malesInRoster(roster);
  if (!males.length) {
    return 0;
  }
  const total = males.reduce((sum, player) => sum + playerRating(player), 0);
  return Math.round((total / males.length) * 100) / 100;
}

function cloneBuckets(buckets) {
  return buckets.map((roster) => [...roster]);
}

function pickBestTeamIndex(candidates = []) {
  let bestIndex = candidates[0]?.teamIndex ?? 0;
  let bestScore = candidates[0]?.score ?? Infinity;
  let bestTieBreak = candidates[0]?.tieBreak ?? Infinity;

  for (const candidate of candidates.slice(1)) {
    if (
      candidate.score < bestScore ||
      (candidate.score === bestScore && candidate.tieBreak < bestTieBreak)
    ) {
      bestIndex = candidate.teamIndex;
      bestScore = candidate.score;
      bestTieBreak = candidate.tieBreak;
    }
  }

  return bestIndex;
}

function scoreStep2Assignment(buckets, teamIndex, male) {
  const trial = cloneBuckets(buckets);
  trial[teamIndex] = [...trial[teamIndex], male];

  const maleAvgs = trial.map((roster) => malePairAvg(roster));
  const spread = spreadOf(maleAvgs);

  const teamMales = malesInRoster(trial[teamIndex]);
  let withinGapPenalty = 0;
  if (teamMales.length === 2) {
    const gap = Math.abs(playerRating(teamMales[0]) - playerRating(teamMales[1]));
    if (gap > WITHIN_TEAM_MALE_GAP_SOFT_LIMIT) {
      withinGapPenalty =
        WITHIN_TEAM_MALE_GAP_PENALTY_WEIGHT * (gap - WITHIN_TEAM_MALE_GAP_SOFT_LIMIT);
    }
  }

  return {
    teamIndex,
    score: spread + withinGapPenalty,
    tieBreak: rosterAvg(trial[teamIndex]),
  };
}

function scoreRosterSpreadAssignment(buckets, teamIndex, player) {
  const trial = cloneBuckets(buckets);
  trial[teamIndex] = [...trial[teamIndex], player];

  const avgs = trial.map((roster) => rosterAvg(roster));

  return {
    teamIndex,
    score: spreadOf(avgs),
    tieBreak: rosterAvg(trial[teamIndex]),
  };
}

function assignGreedy(buckets, player, eligibleTeamIndexes, scoreFn) {
  const candidates = eligibleTeamIndexes.map((teamIndex) =>
    scoreFn(buckets, teamIndex, player)
  );
  const bestTeamIndex = pickBestTeamIndex(candidates);
  buckets[bestTeamIndex].push(player);
}

/**
 * MLP four-step pairing:
 * 1) Top male per team (shuffled)
 * 2) Second male per team (balanced male pair averages)
 * 3) First female per team (balanced roster average)
 * 4) Second female per team (balanced roster average)
 */
/**
 * Baseline MLP 4-step heuristic (kept as generator / budget-zero fallback).
 * Global optimizer imports this — do not delete while mlp4-global-optimizer-v1 is active.
 */
export function buildMlpTeamsFourStep({
  males = [],
  females = [],
  teamCount = 0,
  randomFn = createSeededRng(1),
}) {
  const buckets = Array.from({ length: teamCount }, () => []);

  const topMales = males.slice(0, teamCount);
  const shuffledOrder = shuffleIndices(teamCount, randomFn);
  topMales.forEach((male, index) => {
    buckets[shuffledOrder[index]].push(male);
  });

  const secondMales = sortByRatingDesc(males.slice(teamCount, teamCount * 2));
  secondMales.forEach((male) => {
    const eligibleTeamIndexes = buckets
      .map((roster, teamIndex) => ({ roster, teamIndex }))
      .filter(({ roster }) => malesInRoster(roster).length < MLP_MALES_PER_TEAM)
      .map(({ teamIndex }) => teamIndex);

    assignGreedy(buckets, male, eligibleTeamIndexes, scoreStep2Assignment);
  });

  const firstFemales = sortByRatingDesc(females.slice(0, teamCount));
  firstFemales.forEach((female) => {
    const eligibleTeamIndexes = buckets
      .map((roster, teamIndex) => ({ roster, teamIndex }))
      .filter(
        ({ roster }) =>
          malesInRoster(roster).length === MLP_MALES_PER_TEAM &&
          roster.length - malesInRoster(roster).length < 1
      )
      .map(({ teamIndex }) => teamIndex);

    assignGreedy(buckets, female, eligibleTeamIndexes, scoreRosterSpreadAssignment);
  });

  const secondFemales = sortByRatingDesc(females.slice(teamCount, teamCount * 2));
  secondFemales.forEach((female) => {
    const eligibleTeamIndexes = buckets
      .map((roster, teamIndex) => ({ roster, teamIndex }))
      .filter(({ roster }) => roster.length < MLP_MEMBERS_PER_TEAM)
      .map(({ teamIndex }) => teamIndex);

    assignGreedy(buckets, female, eligibleTeamIndexes, scoreRosterSpreadAssignment);
  });

  return buckets;
}

function buildTeamRecordsFromBuckets(buckets, teamNames = [], options = {}) {
  const { assignCaptain = false } = options;

  return buckets.map((roster, index) => {
    const avgLevel = computeTeamAvgLevel(roster);

    return createTeamRecord({
      id: createId("team"),
      name: teamNames[index] || `Đội ${index + 1}`,
      playerIds: roster.map((player) => player.id),
      captainPlayerId: assignCaptain ? pickCaptainPlayerId(roster) : "",
      seed: index + 1,
      avgLevel,
    });
  });
}

function assignSeedsByAvgLevel(teams = []) {
  teams.sort((left, right) => (right.avgLevel || 0) - (left.avgLevel || 0));
  teams.forEach((team, index) => {
    team.seed = index + 1;
  });
  return teams;
}

function buildTeamSpreadWarning(teams = []) {
  const levels = teams.map((team) => team.avgLevel || 0);
  const spread = levels.length ? spreadOf(levels) : 0;
  if (spread > TEAM_SPREAD_WARNING_THRESHOLD) {
    return `Chênh lệch trình độ đội: ${spread.toFixed(2)} (đã cân bằng 4 bước).`;
  }
  return null;
}

function computeTeamAvgLevel(players = []) {
  if (!players.length) {
    return 0;
  }
  const total = players.reduce((sum, player) => sum + playerRating(player), 0);
  return Math.round((total / players.length) * 100) / 100;
}

function pickCaptainPlayerId(players = []) {
  if (!players.length) {
    return "";
  }
  const sorted = sortByRatingDesc(players);
  return String(sorted[0].id);
}

/**
 * Suggest balanced MLP teams (2 male + 2 female) from a player pool.
 */
export function suggestMlpTeamsFromPlayers(players = [], options = {}) {
  const pool = Array.isArray(players) ? players : [];
  const males = sortByRatingDesc(
    pool.filter((player) => getPlayerGenderKey(player.gender) === "male")
  );
  const females = sortByRatingDesc(
    pool.filter((player) => getPlayerGenderKey(player.gender) === "female")
  );

  const teamCount = Math.min(Math.floor(males.length / 2), Math.floor(females.length / 2));
  const warnings = [];

  if (teamCount < 1) {
    return {
      teams: [],
      warnings: ["Cần ít nhất 2 nam và 2 nữ để ghép 1 đội MLP."],
      leftover: {
        males: males.map((player) => player.id),
        females: females.map((player) => player.id),
      },
    };
  }

  const prefix = options.teamNamePrefix || "Đội";
  const teamNames = Array.from({ length: teamCount }, (_, index) => `${prefix} ${index + 1}`);

  const buckets = buildMlpTeamsFourStep({
    males,
    females,
    teamCount,
    randomFn:
      typeof options.randomFn === "function"
        ? options.randomFn
        : createSeededRng(options.seed ?? 1),
  });

  let teams = buildTeamRecordsFromBuckets(buckets, teamNames, { assignCaptain: true });
  teams = assignSeedsByAvgLevel(teams);

  const usedMaleIds = new Set(teams.flatMap((team) => team.playerIds).filter((id) =>
    males.some((player) => player.id === id)
  ));
  const usedFemaleIds = new Set(teams.flatMap((team) => team.playerIds).filter((id) =>
    females.some((player) => player.id === id)
  ));

  const leftoverMales = males.filter((player) => !usedMaleIds.has(player.id));
  const leftoverFemales = females.filter((player) => !usedFemaleIds.has(player.id));

  if (leftoverMales.length || leftoverFemales.length) {
    warnings.push(
      `${leftoverMales.length} nam và ${leftoverFemales.length} nữ không được xếp vào đội (thiếu cặp 2M+2F).`
    );
  }

  const spreadWarning = buildTeamSpreadWarning(teams);
  if (spreadWarning) {
    warnings.push(spreadWarning);
  }

  return {
    teams,
    warnings,
    leftover: {
      males: leftoverMales.map((player) => player.id),
      females: leftoverFemales.map((player) => player.id),
    },
  };
}

export function summarizeSeededGroupBalance(groups = [], teams = [], options = {}) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const useTopPlayer = options.seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL;

  const groupStats = groups.map((group) => {
    const groupTeams = (group.teamIds || [])
      .map((teamId) => teamById.get(teamId))
      .filter(Boolean);
    const levels = groupTeams.map((team) => team.avgLevel || 0);
    const avgLevel = levels.length
      ? Math.round((levels.reduce((sum, level) => sum + level, 0) / levels.length) * 100) / 100
      : 0;
    const topLevels = groupTeams.map((team) => team.topPlayerRating || team.avgLevel || 0);
    const topAvg = topLevels.length
      ? Math.round((topLevels.reduce((sum, level) => sum + level, 0) / topLevels.length) * 100) / 100
      : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      teamCount: groupTeams.length,
      avgLevel,
      topAvg,
      minLevel: levels.length ? Math.min(...levels) : 0,
      maxLevel: levels.length ? Math.max(...levels) : 0,
    };
  });

  const avgs = groupStats.map((stat) => (useTopPlayer ? stat.topAvg : stat.avgLevel));
  const spread = avgs.length ? Math.max(...avgs) - Math.min(...avgs) : 0;

  return {
    groups: groupStats,
    balanced: spread <= 0.35,
    spread: Math.round(spread * 100) / 100,
    seedingMode: options.seedingMode || null,
  };
}

function teamGroupsToPrivateCandidate(groups = [], teams = []) {
  const teamById = new Map((teams || []).map((team) => [String(team.id), team]));
  return (groups || []).map((group) => {
    const playerIds = [];
    (group.teamIds || []).forEach((teamId) => {
      const team = teamById.get(String(teamId));
      (team?.playerIds || []).forEach((id) => playerIds.push(String(id)));
      (team?.members || []).forEach((member) => {
        const id = typeof member === "object" ? String(member.id || "") : String(member);
        if (id) playerIds.push(id);
      });
    });
    return {
      id: group.id,
      label: group.name,
      playerIds: [...new Set(playerIds)],
    };
  });
}

/**
 * Assign existing teams to groups using configured seeding mode + snake distribution.
 * When private pairing runtime is ON, hard-filters / soft-ranks group plans with
 * group-stage rules only (never teammate/opponent rules).
 */
export function assignSeededTeamsToGroups(teamData, options = {}) {
  const teams = teamData?.teams || [];
  if (teams.length < 2) {
    return { teamData, balance: null, warnings: [], ok: true, privatePairingError: null };
  }

  const seedingMode = resolveGroupSeedingMode(
    options.seedingMode ?? teamData?.settings?.groupSeeding
  );
  const players = options.players ?? [];
  const randomFn =
    typeof options.randomFn === "function"
      ? options.randomFn
      : createSeededRng(options.seed ?? 1);
  const warnings = [];

  const buildLegacyPlan = (shuffleSalt = 0) => {
    let preparedTeams;
    if (seedingMode === TEAM_GROUP_SEEDING.OFF) {
      preparedTeams = shuffleTeamsForOpenDraw(teams, randomFn);
    } else if (shuffleSalt > 0) {
      const rng = createSeededRng(`${options.seed || 1}-${shuffleSalt}`);
      const baseSorted = sortTeamsForGroupSeeding(teams, players, seedingMode);
      // light rotation to explore alternate snake starts without Math.random fallback
      const offset = Math.floor(rng() * baseSorted.length);
      preparedTeams = [...baseSorted.slice(offset), ...baseSorted.slice(0, offset)];
    } else {
      preparedTeams = sortTeamsForGroupSeeding(teams, players, seedingMode);
      if (
        seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL &&
        players.length === 0
      ) {
        warnings.push(
          "Thiếu danh sách VĐV — xếp hạt giống fallback theo trung bình đội đã lưu."
        );
      }
    }

    const recommendedSizes = recommendGroupSizes(teams.length);
    const groupCount =
      Number(options.groupCount) ||
      (recommendedSizes ? recommendedSizes.length : Math.min(2, teams.length));

    const groups = buildSnakeGroupsFromSortedTeams(preparedTeams, groupCount);
    return { preparedTeams, groups, groupCount };
  };

  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    const { preparedTeams, groups } = buildLegacyPlan(0);
    const nextTeamData = normalizeTeamData({
      ...teamData,
      teams: preparedTeams,
      groups,
    });
    return {
      ok: true,
      teamData: nextTeamData,
      balance: summarizeSeededGroupBalance(groups, preparedTeams, { seedingMode }),
      warnings,
      privatePairingError: null,
    };
  }

  const competitionClass = options.competitionClass || COMPETITION_CLASS.INTERNAL;
  const resolved = resolveActivePrivatePairingRules({
    rules: options.privatePairingRules || [],
    legacyConstraints: options.pairingConstraints || [],
    context: {
      clubId: options.clubId || null,
      tournamentId: options.tournamentId || null,
      eventId: options.eventId || null,
      competitionClass,
      allowedByPublishedRules: options.allowedByPublishedRules === true,
      contextTime: options.contextTime,
      operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
    },
  });

  const gate = gateResolvedForStage(resolved, competitionClass);
  if (!gate.ok) {
    return {
      ok: false,
      teamData,
      balance: null,
      warnings,
      privatePairingError: gate.error,
    };
  }

  const stageRules = filterRulesForGroupStage(resolved.rules || []);
  const hard = filterRulesForGroupStage(
    resolved.hardRules || splitHardAndSoftRules(resolved.rules || []).hard
  );
  const soft = filterRulesForGroupStage(
    resolved.softRules || splitHardAndSoftRules(resolved.rules || []).soft
  );

  if (!hard.length && !soft.length) {
    const { preparedTeams, groups } = buildLegacyPlan(0);
    const nextTeamData = normalizeTeamData({
      ...teamData,
      teams: preparedTeams,
      groups,
    });
    return {
      ok: true,
      teamData: nextTeamData,
      balance: summarizeSeededGroupBalance(groups, preparedTeams, { seedingMode }),
      warnings,
      privatePairingError: null,
    };
  }

  if (options.useGlobalOptimizer !== false) {
    const baselinePlans = [];
    const maxCandidates = Math.max(4, Number(options.maxCandidates) || 12);
    for (let salt = 0; salt < maxCandidates; salt += 1) {
      baselinePlans.push(buildLegacyPlan(salt));
    }
    const optimized = runGroupDrawGlobalOptimizer({
      teams,
      groupCount: baselinePlans[0]?.groupCount,
      baselinePlans,
      formationResolved: { ...resolved, rules: stageRules, hardRules: hard, softRules: soft },
      context: {
        clubId: options.clubId || null,
        tournamentId: options.tournamentId || null,
        eventId: options.eventId || null,
        competitionClass,
        operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
      },
      seed: options.seed ?? 1,
      budget: options.optimizationBudget,
    });
    if (!optimized.ok || !optimized.bestCandidate) {
      return {
        ok: false, teamData, balance: null, warnings,
        privatePairingError: buildPrivatePairingRuntimeError({
          errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN,
        }),
      };
    }
    const best = optimized.bestCandidate;
    const nextTeamData = normalizeTeamData({ ...teamData, teams, groups: best.groups });
    return {
      ok: true, teamData: nextTeamData,
      balance: summarizeSeededGroupBalance(best.groups, teams, { seedingMode }),
      warnings, privatePairingError: null,
      constraintScore: best.constraintScore,
      scoreBreakdown: best.scoreBreakdown,
      optimizationRuleScore: best.scoreBreakdown,
      ruleResolution: resolved.ruleResolution,
      optimizer: optimized,
    };
  }

  const maxCandidates = Math.max(4, Number(options.maxCandidates) || 12);
  const scored = [];
  for (let salt = 0; salt < maxCandidates; salt += 1) {
    const plan = buildLegacyPlan(salt);
    const candidateGroups = teamGroupsToPrivateCandidate(plan.groups, plan.preparedTeams);
    const evaluated = evaluatePrivatePairingCandidate(
      { id: `group-cand-${salt + 1}`, groups: candidateGroups },
      {
        resolved: { ...resolved, rules: stageRules, hardRules: hard, softRules: soft },
        context: {
          clubId: options.clubId || null,
          tournamentId: options.tournamentId || null,
          eventId: options.eventId || null,
          competitionClass,
          operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
        },
      }
    );
    if (!evaluated.feasible) {
      continue;
    }
    scored.push({
      ...plan,
      id: evaluated.id,
      feasible: true,
      constraintScore: evaluated.constraintScore,
      scoreBreakdown: evaluated.scoreBreakdown,
      optimizationRuleScore: evaluated.scoreBreakdown,
    });
  }

  if (!scored.length) {
    return {
      ok: false,
      teamData,
      balance: null,
      warnings,
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN,
      }),
    };
  }

  const best = sortCandidatesByOptimizationRank(scored)[0];
  const nextTeamData = normalizeTeamData({
    ...teamData,
    teams: best.preparedTeams,
    groups: best.groups,
  });

  return {
    ok: true,
    teamData: nextTeamData,
    balance: summarizeSeededGroupBalance(best.groups, best.preparedTeams, { seedingMode }),
    warnings,
    privatePairingError: null,
    constraintScore: best.constraintScore,
    scoreBreakdown: best.scoreBreakdown,
    optimizationRuleScore: best.scoreBreakdown,
    ruleResolution: resolved.ruleResolution,
  };
}

/**
 * Pair balanced teams from a selected player pool (wizard step 1).
 * MLP: fixed 4 VĐV/đội (2 nam + 2 nữ); does not assign group placement.
 *
 * When Private Pairing runtime flags are ON and teammate rules are present,
 * generates multiple seeded MLP candidates, hard-filters with canonical rules,
 * then ranks by soft constraint score + formation-quality (rating balance).
 */
export function pairTeamsFromSelectedPlayers({
  players = [],
  selectedPlayerIds = [],
  teamCount = 2,
  teamNames = [],
  formatPreset,
  randomFn,
  privatePairingRules = [],
  competitionClass = COMPETITION_CLASS.INTERNAL,
  clubId = null,
  tournamentId = null,
  eventId = null,
  envSource,
  seed = 1,
  maxCandidates = 24,
  pairingHistory = null,
  allowedByPublishedRules = false,
  contextTime,
  useGlobalOptimizer = true,
  optimizationBudget = undefined,
} = {}) {
  const selectedSet = new Set((selectedPlayerIds || []).map((id) => String(id)));
  const pool = (Array.isArray(players) ? players : []).filter((player) =>
    selectedSet.has(String(player.id))
  );
  const warnings = [];
  const requestedCount = Math.max(2, Number(teamCount) || 2);
  const names = resolveTeamNames(teamNames, requestedCount);
  const playersById = Object.fromEntries(
    pool.map((player) => [String(player.id), player])
  );

  if (!pool.length) {
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: [],
      warnings: ["Chọn ít nhất một VĐV để ghép đội."],
      privatePairingError: null,
    };
  }

  if (!isMlpFormatPreset(formatPreset)) {
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: ["AI ghép đội hiện chỉ hỗ trợ preset MLP 4 người."],
      privatePairingError: null,
    };
  }

  const unknownGender = pool.filter((player) => {
    const key = getPlayerGenderKey(player.gender);
    return key !== "male" && key !== "female";
  });
  if (unknownGender.length) {
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [
        `Có ${unknownGender.length} VĐV giới tính unknown/null/invalid — không thể ghép MLP 4.`,
      ],
      privatePairingError: null,
    };
  }

  const males = sortByRatingDesc(
    pool.filter((player) => getPlayerGenderKey(player.gender) === "male")
  );
  const females = sortByRatingDesc(
    pool.filter((player) => getPlayerGenderKey(player.gender) === "female")
  );

  const maxPossibleTeams = Math.min(
    Math.floor(males.length / MLP_MALES_PER_TEAM),
    Math.floor(females.length / MLP_FEMALES_PER_TEAM)
  );

  // Exact team count required — never silently shrink.
  if (maxPossibleTeams < requestedCount) {
    const codes = [];
    if (males.length < requestedCount * MLP_MALES_PER_TEAM) codes.push("INSUFFICIENT_MALES");
    if (females.length < requestedCount * MLP_FEMALES_PER_TEAM) codes.push("INSUFFICIENT_FEMALES");
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [
        `Không đủ nam/nữ để ghép đúng ${requestedCount} đội MLP (tối đa ${maxPossibleTeams}).`,
        ...codes,
      ],
      privatePairingError: null,
    };
  }

  const effectiveTeamCount = requestedCount;
  const requiredMales = effectiveTeamCount * MLP_MALES_PER_TEAM;
  const requiredFemales = effectiveTeamCount * MLP_FEMALES_PER_TEAM;
  const malePool = males.slice(0, requiredMales);
  const femalePool = females.slice(0, requiredFemales);

  const buildLegacyResult = (rng) => {
    const buckets = buildMlpTeamsFourStep({
      males: malePool,
      females: femalePool,
      teamCount: effectiveTeamCount,
      randomFn: rng,
    });

    let teams = buildTeamRecordsFromBuckets(buckets, names.slice(0, effectiveTeamCount));
    teams = assignSeedsByAvgLevel(teams);

    const usedIds = new Set(teams.flatMap((team) => team.playerIds));
    const waitingPlayerIds = pool
      .filter((player) => !usedIds.has(player.id))
      .map((player) => player.id);

    const nextWarnings = [...warnings];
    if (waitingPlayerIds.length) {
      nextWarnings.push(`${waitingPlayerIds.length} VĐV sẽ ở trạng thái chờ.`);
    }
    const spreadWarning = buildTeamSpreadWarning(teams);
    if (spreadWarning) {
      nextWarnings.push(spreadWarning);
    }

    return { teams, waitingPlayerIds, warnings: nextWarnings };
  };

  const runtimeEnabled = isPrivatePairingRuntimeEnabled(envSource);
  const formationRulesInput = filterRulesForTeamFormation(privatePairingRules || []);

  // Flags OFF or no teammate rules → legacy MLP path (unchanged behavior).
  if (!runtimeEnabled || formationRulesInput.length === 0) {
    const legacy = buildLegacyResult(
      typeof randomFn === "function" ? randomFn : createSeededRng(seed ?? 1)
    );
    return {
      ok: true,
      ...legacy,
      privatePairingError: null,
      privatePairingMeta: {
        runtimeEnabled,
        formationRulesApplied: 0,
        opponentOrGroupRulesIgnored: (privatePairingRules || []).length - formationRulesInput.length,
      },
    };
  }

  const context = {
    teamSize: MLP_MEMBERS_PER_TEAM,
    clubId,
    tournamentId,
    eventId,
    competitionClass,
    allowedByPublishedRules,
    contextTime,
    playersById,
    operation: PRIVATE_PAIRING_OPERATION.TEAM_FORMATION,
  };

  const resolved = resolveActivePrivatePairingRules({
    rules: privatePairingRules || [],
    legacyConstraints: [],
    context,
  });

  if (resolved.validationErrors?.length) {
    const error = buildPrivatePairingRuntimeError({
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED,
      meta: { validationErrors: resolved.validationErrors },
    });
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [error.message],
      privatePairingError: error,
      privatePairingMeta: { runtimeEnabled: true, formationRulesApplied: 0 },
    };
  }

  if (resolved.fatalConflicts?.length) {
    const error = buildPrivatePairingRuntimeError({
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
      meta: { fatalConflicts: resolved.fatalConflicts },
    });
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [error.message, error.code],
      privatePairingError: error,
      privatePairingMeta: { runtimeEnabled: true, formationRulesApplied: 0 },
    };
  }

  if (
    isRestrictedCompetitionClass(competitionClass) &&
    (resolved.blockedByPolicy || []).length > 0
  ) {
    const error = buildPrivatePairingRuntimeError({
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY,
      meta: {
        blockedByPolicy: resolved.blockedByPolicy,
        blockedByPolicyCount: resolved.blockedByPolicy.length,
      },
    });
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [error.message, error.code],
      privatePairingError: error,
      privatePairingMeta: { runtimeEnabled: true, formationRulesApplied: 0 },
    };
  }

  const formationResolved = {
    ...resolved,
    rules: filterRulesForTeamFormation(resolved.rules),
    hardRules: filterRulesForTeamFormation(resolved.hardRules || []),
    softRules: filterRulesForTeamFormation(resolved.softRules || []),
  };

  // Prefer Global Optimizer (default on). Budget-zero falls back to four-step baseline.
  if (useGlobalOptimizer !== false) {
    const optimized = runMlpFourGlobalOptimizer({
      players: [...malePool, ...femalePool],
      playersById,
      teamCount: effectiveTeamCount,
      teamNames: names.slice(0, effectiveTeamCount),
      randomSeed: seed,
      fourStepBuilder: buildMlpTeamsFourStep,
      formationResolved,
      context,
      pairingHistory,
      privatePairingEnabled: true,
      budget: optimizationBudget,
    });

    if (!optimized.ok || !optimized.bestCandidate?.feasible) {
      const error = buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING,
        meta: {
          errorCodes: optimized.errorCodes || [],
          diagnostics: optimized.diagnostics,
          rejectedCandidateCount:
            optimized.diagnostics?.rejectedHardViolationCount || 0,
        },
      });
      return {
        ok: false,
        teams: [],
        waitingPlayerIds: pool.map((player) => player.id),
        warnings: [error.message, error.code, ...(optimized.errorCodes || [])],
        privatePairingError: error,
        privatePairingMeta: {
          runtimeEnabled: true,
          formationRulesApplied: formationResolved.rules.length,
          algorithmVersion: MLP4_GLOBAL_ALGORITHM_VERSION,
          diagnostics: optimized.diagnostics,
          scoreBreakdown: optimized.scoreBreakdown,
          ruleResolution: formationResolved.ruleResolution,
        },
      };
    }

    const bestTeams = (optimized.bestCandidate.teams || []).map((team, index) =>
      createTeamRecord({
        id: createId("team"),
        name: names[index] || team.name || `Đội ${index + 1}`,
        playerIds: [...(team.playerIds || [])].map(String),
        captainPlayerId: "",
        seed: index + 1,
        avgLevel: team.avgLevel || computeTeamAvgLevel(
          (team.playerIds || []).map((id) => playersById[String(id)]).filter(Boolean)
        ),
      })
    );
    assignSeedsByAvgLevel(bestTeams);
    const usedIds = new Set(bestTeams.flatMap((team) => team.playerIds));
    const waitingPlayerIds = pool
      .filter((player) => !usedIds.has(String(player.id)))
      .map((player) => player.id);
    const nextWarnings = [...warnings];
    if (waitingPlayerIds.length) {
      nextWarnings.push(`${waitingPlayerIds.length} VĐV sẽ ở trạng thái chờ.`);
    }
    const spreadWarning = buildTeamSpreadWarning(bestTeams);
    if (spreadWarning) nextWarnings.push(spreadWarning);

    return {
      ok: true,
      teams: bestTeams,
      waitingPlayerIds,
      warnings: nextWarnings,
      privatePairingError: null,
      privatePairingMeta: {
        runtimeEnabled: true,
        formationRulesApplied: formationResolved.rules.length,
        algorithmVersion: optimized.algorithmVersion || MLP4_GLOBAL_ALGORITHM_VERSION,
        randomSeed: optimized.randomSeed,
        candidateCount: optimized.diagnostics?.evaluatedCandidateCount || 0,
        selectedCandidateId: optimized.bestCandidate.id,
        constraintScore: optimized.bestCandidate.constraintScore,
        formationQualityScore: optimized.bestCandidate.formationQuality,
        balanceScore: optimized.bestCandidate.balanceScore,
        softConstraintsSatisfied: optimized.bestCandidate.softConstraintsSatisfied,
        softConstraintsMissed: optimized.bestCandidate.softConstraintsMissed,
        scoreBreakdown: optimized.scoreBreakdown,
        optimizationRuleScore: optimized.scoreBreakdown,
        diagnostics: optimized.diagnostics,
        ruleResolution: formationResolved.ruleResolution,
        baselineSignature: optimized.baseline?.signature || null,
      },
    };
  }

  // Controlled non-optimizer path (explicit useGlobalOptimizer=false): seeded multi-start four-step.
  const rng =
    typeof randomFn === "function" ? randomFn : createSeededRng(seed ?? 1);
  const candidateLimit = Math.max(1, Math.min(64, Number(maxCandidates) || 24));
  const scored = [];

  for (let index = 0; index < candidateLimit; index += 1) {
    const draft = buildLegacyResult(rng);
    const candidateTeams = (draft.teams || []).map((team) => ({
      ...team,
      members: (team.playerIds || [])
        .map((id) => playersById[String(id)])
        .filter(Boolean),
    }));

    const evaluated = evaluatePrivatePairingCandidate(
      {
        id: `mlp-cand-${index + 1}`,
        teams: candidateTeams,
      },
      {
        resolved: formationResolved,
        context,
        history: pairingHistory || {},
      }
    );

    const quality = formationQualityScore(draft.teams);
    scored.push({
      id: evaluated.id,
      feasible: evaluated.feasible,
      rejectionCodes: evaluated.rejectionCodes,
      constraintScore: evaluated.constraintScore,
      balanceScore: evaluated.balanceScore,
      formationQuality: quality,
      scoreBreakdown: evaluated.scoreBreakdown,
      optimizationRuleScore: evaluated.scoreBreakdown,
      teams: draft.teams,
      waitingPlayerIds: draft.waitingPlayerIds,
      warnings: draft.warnings,
      softConstraintsSatisfied: evaluated.softConstraintsSatisfied,
      softConstraintsMissed: evaluated.softConstraintsMissed,
    });
  }

  const feasible = sortCandidatesByOptimizationRank(
    scored.filter((item) => item.feasible)
  );
  if (!feasible.length) {
    const error = buildPrivatePairingRuntimeError({
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING,
      meta: {
        rejectedCandidateCount: scored.length,
        rejectionSamples: scored.slice(0, 5).map((item) => ({
          id: item.id,
          codes: item.rejectionCodes,
        })),
      },
    });
    return {
      ok: false,
      teams: [],
      waitingPlayerIds: pool.map((player) => player.id),
      warnings: [error.message, error.code],
      privatePairingError: error,
      privatePairingMeta: {
        runtimeEnabled: true,
        formationRulesApplied: formationResolved.rules.length,
        candidateCount: scored.length,
        rejectedCandidateCount: scored.length,
      },
    };
  }

  const best = feasible[0];
  return {
    ok: true,
    teams: best.teams,
    waitingPlayerIds: best.waitingPlayerIds,
    warnings: best.warnings,
    privatePairingError: null,
    privatePairingMeta: {
      runtimeEnabled: true,
      formationRulesApplied: formationResolved.rules.length,
      candidateCount: scored.length,
      selectedCandidateId: best.id,
      constraintScore: best.constraintScore,
      formationQualityScore: best.formationQuality,
      balanceScore: best.balanceScore,
      softConstraintsSatisfied: best.softConstraintsSatisfied,
      softConstraintsMissed: best.softConstraintsMissed,
      scoreBreakdown: best.scoreBreakdown,
      optimizationRuleScore: best.scoreBreakdown,
      ruleResolution: formationResolved.ruleResolution,
    },
  };
}

/**
 * Persist paired teams without auto group assignment.
 */
export function applyTeamPairing(teamData, { teams = [] } = {}) {
  if (!teams.length) {
    return {
      ok: false,
      error: "Không có đội để áp dụng.",
    };
  }

  const next = normalizeTeamData({
    ...teamData,
    teams,
    groups: [],
    matchups: [],
  });

  return {
    ok: true,
    teamData: next,
    teamCount: teams.length,
  };
}

/**
 * Full auto-draw: form MLP teams then seed into groups.
 */
export function applyMlpAutoDraw(teamData, players = [], options = {}) {
  const suggestion = suggestMlpTeamsFromPlayers(players, options);
  if (!suggestion.teams.length) {
    return {
      ok: false,
      error: suggestion.warnings[0] || "Không ghép được đội MLP.",
      warnings: suggestion.warnings,
    };
  }

  // Owner workflow: AI team creation must NOT auto-divide groups.
  // Groups are an explicit BTC step (preview → confirm → groups.replace).
  const skipGroups = options.assignGroups !== true;
  let next = normalizeTeamData({
    ...teamData,
    teams: suggestion.teams,
    groups: skipGroups ? [] : teamData.groups || [],
    matchups: [],
  });

  if (skipGroups) {
    return {
      ok: true,
      teamData: next,
      balance: null,
      warnings: [
        ...suggestion.warnings,
        "Đã tạo đội — chưa chia bảng. Hãy dùng bước Chia bảng đấu.",
      ],
      teamCount: suggestion.teams.length,
      privatePairingError: null,
    };
  }

  const groupResult = assignSeededTeamsToGroups(next, {
    ...options,
    players,
  });

  if (groupResult.ok === false || groupResult.privatePairingError) {
    return {
      ok: false,
      error:
        groupResult.privatePairingError?.message ||
        "Không chia được bảng theo quy tắc riêng.",
      warnings: [...suggestion.warnings, ...(groupResult.warnings || [])],
      privatePairingError: groupResult.privatePairingError || null,
    };
  }

  return {
    ok: true,
    teamData: groupResult.teamData,
    balance: groupResult.balance,
    warnings: [...suggestion.warnings, ...(groupResult.warnings || [])],
    teamCount: suggestion.teams.length,
    privatePairingError: null,
  };
}
