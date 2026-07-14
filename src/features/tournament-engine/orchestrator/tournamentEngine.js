import { getActiveClubId } from "../../../data/club.js";
import { ENGINE_TYPE } from "../constants/defaults.js";
import { generateSeed } from "../engines/seedEngine.js";
import { generateDraw } from "../engines/drawEngine.js";
import { generateSchedule } from "../engines/scheduleEngine.js";
import { assignCourts } from "../engines/courtAssignmentEngine.js";
import { predictTournamentTime } from "../engines/timePredictionEngine.js";
import { computeRankings, computeRankingsAfterMatch } from "../engines/rankingEngine.js";
import { appendEngineRun, listEngineRuns } from "../services/engineRunLog.js";

function wrapEngineRun(engineType, context, result, options = {}) {
  if (options.skipLog) {
    return result;
  }

  const clubId = options.clubId || getActiveClubId();
  appendEngineRun(clubId, context.tournamentId, {
    engineType,
    action: options.action || engineType,
    inputSummary: {
      participantCount: context.participants?.length ?? 0,
      groupCount: context.groupCount,
      courtCount: context.courts?.length ?? 0,
      matchCount: context.matches?.length ?? 0,
    },
    output: result.ok ? result.data : null,
    warnings: result.warnings || [],
    errors: result.errors || [],
    explain: result.explain || [],
    createdBy: options.createdBy || options.actor?.email || options.actor?.id || null,
    actor: options.actor || null,
    before: options.before ?? null,
    after: options.after ?? (result.ok ? result.data : null),
  });

  return result;
}

export function runSeedEngine(context, options = {}) {
  const result = generateSeed(context);
  return wrapEngineRun(ENGINE_TYPE.SEED, context, result, options);
}

export function runDrawEngine(context, options = {}) {
  const result = generateDraw(context);
  return wrapEngineRun(ENGINE_TYPE.DRAW, context, result, options);
}

export function runScheduleEngine(context, scheduleOptions = {}, logOptions = {}) {
  const result = generateSchedule(context, scheduleOptions);
  return wrapEngineRun(ENGINE_TYPE.SCHEDULE, context, result, logOptions);
}

export function runCourtAssignmentEngine(context, assignOptions = {}, logOptions = {}) {
  const result = assignCourts(context, assignOptions);
  return wrapEngineRun(ENGINE_TYPE.COURT, context, result, logOptions);
}

export function runTimePredictionEngine(context, options = {}) {
  const result = predictTournamentTime(context);
  return wrapEngineRun(ENGINE_TYPE.TIME, context, result, options);
}

export function runRankingEngine(context, options = {}) {
  const result = computeRankings(context);
  return wrapEngineRun(ENGINE_TYPE.RANKING, context, result, options);
}

export function runRankingAfterMatch(context, matchId) {
  return computeRankingsAfterMatch(context, matchId);
}

/**
 * Pipeline đầy đủ: Seed → Draw → Schedule → Courts → Time → Ranking
 */
export function runFullTournamentPlan(context, options = {}) {
  const warnings = [];
  const explain = [];

  const seedResult = runSeedEngine(context, { ...options, skipLog: true });
  if (!seedResult.ok) {
    return seedResult;
  }
  warnings.push(...(seedResult.warnings || []));
  explain.push(...(seedResult.explain || []));

  const drawContext = {
    ...context,
    participants: seedResult.data.participants,
  };
  const drawResult = runDrawEngine(drawContext, { ...options, skipLog: true });
  if (!drawResult.ok) {
    return drawResult;
  }
  warnings.push(...(drawResult.warnings || []));

  const scheduleContext = {
    ...drawContext,
    groups: drawResult.data.groups,
  };
  const scheduleResult = runScheduleEngine(scheduleContext, {}, { ...options, skipLog: true });
  if (!scheduleResult.ok) {
    return scheduleResult;
  }

  const courtContext = {
    ...scheduleContext,
    matches: scheduleResult.data.matches,
  };
  const courtResult = runCourtAssignmentEngine(courtContext, {}, { ...options, skipLog: true });

  const timeContext = {
    ...courtContext,
    matches: courtResult.data?.matches || scheduleResult.data.matches,
  };
  const timeResult = runTimePredictionEngine(timeContext, { ...options, skipLog: true });

  const rankingContext = {
    ...timeContext,
    matches: timeContext.matches,
  };
  const rankingResult = runRankingEngine(rankingContext, { ...options, skipLog: true });

  const finalResult = {
    ok: true,
    data: {
      seed: seedResult.data,
      draw: drawResult.data,
      schedule: scheduleResult.data,
      courts: courtResult.data,
      time: timeResult.data,
      ranking: rankingResult.data,
    },
    warnings: [
      ...warnings,
      ...(scheduleResult.warnings || []),
      ...(courtResult.warnings || []),
      ...(timeResult.warnings || []),
      ...(rankingResult.warnings || []),
    ],
    explain: [
      ...explain,
      ...(drawResult.explain || []),
      ...(scheduleResult.explain || []),
      ...(timeResult.explain || []),
    ],
  };

  wrapEngineRun(ENGINE_TYPE.FULL_PLAN, context, finalResult, options);
  return finalResult;
}

export function getEngineRunHistory(clubId, tournamentId) {
  return listEngineRuns(clubId, tournamentId);
}

export {
  generateSeed,
  generateDraw,
  generateSchedule,
  assignCourts,
  predictTournamentTime,
  computeRankings,
};
