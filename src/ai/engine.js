/*
==========================================================
Pickleball AI Core V2
Engine - Stable Base
==========================================================
*/

import { loadAIData } from "./storage.js";
import { runWaitingEngine } from "./waiting.js";
import { runBalanceEngine } from "./balance.js";
import { runPairingEngine } from "./pairing.js";
import { runHistoryEngine } from "./history.js";
import { calculateAIScore } from "./scoring.js";
import { commitScheduleResult } from "./persist.js";
import { normalizeScheduleInput, validateScheduleInput } from "./normalize.js";
import { buildCourtExplanation } from "./explain.js";
import { DEFAULT_COMPETITION_TYPE, getCompetitionTypeConfig } from "./competition.js";
import { getCourtDisplayName } from "../models/court.js";
import { appendDebugTrace, createDebugTrace } from "./debug.js";

function buildSessionMeta(options, competitionType) {
  return {
    ...(options.tournamentMeta || {}),
    competitionType,
    templateId: options.templateId || null,
    schedulingMode: options.schedulingMode || null,
  };
}

function maybePersistScheduleResult(result, options, competitionType, trace) {
  if (options.persist !== true) {
    return trace;
  }

  commitScheduleResult(result, buildSessionMeta(options, competitionType));

  return appendDebugTrace(
    trace,
    createDebugTrace("persist.commit", {
      courtCount: result.courts?.length || 0,
      waitingCount: result.waiting?.length || 0,
    })
  );
}

function summarizeCandidate(candidate) {
  const options = candidate?.options || [];
  const diffs = options.map((item) => Number(item.diff || 0));
  const avgDiff = diffs.length
    ? diffs.reduce((sum, value) => sum + value, 0) / diffs.length
    : 0;

  return {
    avgDiff,
    maxDiff: diffs.length ? Math.max(...diffs) : 0,
    minDiff: diffs.length ? Math.min(...diffs) : 0,
  };
}

function mapCandidateCourtsWithNames(candidate, normalizedCourts, context) {
  return (candidate?.options || []).map((pc) => ({
    ...pc,
    courtName:
      pc.courtName ||
      pc.name ||
      (normalizedCourts.find((c) => c.id === pc.court)?.name) ||
      "Sân",
    explanation: buildCourtExplanation(
      {
        diff: pc.diff || 0,
        score: pc.score || 0,
        detailScore: pc.detailScore,
      },
      context
    ),
  }));
}

function finalizeResult(baseResult, trace) {
  return {
    ...baseResult,
    debugTrace: trace,
  };
}

export function runAI(players, options = {}) {
  const competitionType = options.competitionType || DEFAULT_COMPETITION_TYPE;
  const competition = getCompetitionTypeConfig(competitionType);
  const aiData = loadAIData();
  const persist = options.persist === true;

  let trace = [
    createDebugTrace("run.start", {
      playerCount: Array.isArray(players) ? players.length : 0,
      competitionType,
      persist,
    }),
  ];

  const normalizedInput = normalizeScheduleInput({
    players,
    courts: options.enabledCourts || [],
    selectedPlayerIds: players.map((player) => player.id),
    selectedCourtIds: (options.enabledCourts || []).map((court) => court.id || court),
    lockedCourts: options.lockedCourts || [],
    lockedPlayers: options.lockedPlayers || [],
    competitionType,
  });

  trace = appendDebugTrace(
    trace,
    createDebugTrace("input.normalize", {
      players: normalizedInput.players.length,
      courts: normalizedInput.courts.length,
    })
  );

  const validation = validateScheduleInput({
    players: normalizedInput.players,
    courts: normalizedInput.courts,
    selectedPlayerIds: normalizedInput.selectedPlayerIds,
    selectedCourtIds: normalizedInput.selectedCourtIds,
    competitionType,
  });

  if (!validation.isValid) {
    trace = appendDebugTrace(
      trace,
      createDebugTrace("input.validate", {
        ok: false,
        errorCount: validation.errors.length,
      })
    );

    return finalizeResult(
      {
        courts: [],
        waiting: [],
        aiScore: { total: 0, balance: 0, history: 0, waiting: 0, rules: 0 },
        errors: validation.errors,
      },
      trace
    );
  }

  trace = appendDebugTrace(
    trace,
    createDebugTrace("input.validate", {
      ok: true,
      errorCount: 0,
    })
  );

  const enabledCourtsRaw = normalizedInput.courts.length > 0
    ? normalizedInput.courts
    : (options.enabledCourts && options.enabledCourts.length > 0
      ? options.enabledCourts
      : [1, 2, 3, 4]);

  const normalizedCourts = enabledCourtsRaw.map((c, index) => {
    if (typeof c === "object" && c !== null) {
      return {
        id: c.id,
        number: c.number ?? null,
        name: getCourtDisplayName(c, index),
      };
    }

    return { id: c, name: `Sân ${index + 1}` };
  });

  const lockedCourtIds = Array.isArray(options.lockedCourts)
    ? options.lockedCourts
    : [];

  const currentResultCourts =
    (options.currentResult && Array.isArray(options.currentResult.courts) && options.currentResult.courts.length > 0)
      ? options.currentResult.courts
      : (aiData.sessions && aiData.sessions.length > 0
        ? aiData.sessions[aiData.sessions.length - 1].courts || []
        : []);

  const lockedCourts = lockedCourtIds.map((id) => {
    const rc = currentResultCourts.find((c) => c.court === id);
    if (rc) {
      return {
        court: rc.court,
        courtName: rc.courtName || rc.name || (normalizedCourts.find((c) => c.id === rc.court)?.name) || "Sân",
        teamA: rc.teamA || [],
        teamB: rc.teamB || [],
        teamATotal: rc.teamATotal || 0,
        teamBTotal: rc.teamBTotal || 0,
        diff: rc.diff || 0,
        score: rc.score || 0,
      };
    }

    const nc = normalizedCourts.find((c) => c.id === id);

    return {
      court: id,
      courtName: nc?.name || "Sân",
      teamA: [],
      teamB: [],
      teamATotal: 0,
      teamBTotal: 0,
      diff: 0,
      score: 0,
    };
  });

  const lockedPlayerIds = new Set(
    lockedCourts
      .flatMap((c) => [...(c.teamA || []), ...(c.teamB || [])])
      .map((p) => p.id)
  );

  const explicitLockedPlayerIds = new Set(
    Array.isArray(normalizedInput.lockedPlayers)
      ? normalizedInput.lockedPlayers
      : []
  );

  const lockedPlayers = normalizedInput.players.filter((player) =>
    explicitLockedPlayerIds.has(player.id)
  );

  const remainingPlayers = normalizedInput.players.filter(
    (p) => !lockedPlayerIds.has(p.id) && !explicitLockedPlayerIds.has(p.id)
  );

  const remainingCourts = normalizedCourts.filter(
    (c) => !lockedCourtIds.includes(c.id)
  );

  trace = appendDebugTrace(
    trace,
    createDebugTrace("director.lock", {
      lockedCourts: lockedCourtIds.length,
      lockedPlayers: lockedPlayers.length,
      remainingCourts: remainingCourts.length,
      remainingPlayers: remainingPlayers.length,
    })
  );

  if (remainingCourts.length === 0) {
    const fallbackWaiting = [...lockedPlayers, ...remainingPlayers];
    const aiScore = calculateAIScore(
      lockedCourts,
      fallbackWaiting.length,
      competition.playersPerCourt
    );

    trace = appendDebugTrace(
      trace,
      createDebugTrace("result.finalize", {
        courtCount: lockedCourts.length,
        waitingCount: fallbackWaiting.length,
        aiScore: aiScore.total,
        lockedOnly: true,
      })
    );

    trace = maybePersistScheduleResult(
      {
        courts: lockedCourts,
        waiting: fallbackWaiting,
        aiScore,
      },
      options,
      competitionType,
      trace
    );

    return finalizeResult(
      {
        courts: lockedCourts,
        waiting: fallbackWaiting,
        aiScore,
        persisted: persist,
      },
      trace
    );
  }

  const waitingResult = runWaitingEngine(remainingPlayers, {
    ...options,
    courtCount: remainingCourts.length,
    playersPerCourt: competition.playersPerCourt,
    dryRun: !persist,
  });

  trace = appendDebugTrace(
    trace,
    createDebugTrace("waiting.select", {
      playingCount: waitingResult.playingPlayers?.length || 0,
      waitingCount: waitingResult.waitingPlayers?.length || 0,
      dryRun: !persist,
    })
  );

  const context = {
    history: aiData.history || {},
    policies: aiData.policies || [],
    rules: aiData.rules || [],
    competition,
    waitingSnapshot: waitingResult.waitingSnapshot || {},
    waitingData: waitingResult.waitingSnapshot || {},
  };

  const balanceResult = runBalanceEngine(waitingResult.playingPlayers, {
    ...options,
    enabledCourts: remainingCourts,
    playersPerCourt: competition.playersPerCourt,
    waitingSnapshot: waitingResult.waitingSnapshot || {},
  });

  trace = appendDebugTrace(
    trace,
    createDebugTrace("balance.assign", {
      courtCount: balanceResult.courts?.length || 0,
      balanceWaitingCount: balanceResult.waitingPlayers?.length || 0,
    })
  );

  const pairingCandidates = runPairingEngine(balanceResult.courts, context, {
    topCandidates: options.topCandidates,
    playersPerCourt: competition.playersPerCourt,
    teamSize: competition.teamSize,
    requiresMixedPairs: competition.requiresMixedPairs,
  });
  const bestPairing = pairingCandidates[0] || { options: [] };

  trace = appendDebugTrace(
    trace,
    createDebugTrace("pairing.score", {
      candidateCount: pairingCandidates.length,
      bestScore: bestPairing.totalScore || 0,
    })
  );

  const historyResult = runHistoryEngine(bestPairing.options || [], { dryRun: !persist });

  trace = appendDebugTrace(
    trace,
    createDebugTrace("history.apply", {
      courtCount: historyResult?.length || 0,
      dryRun: !persist,
    })
  );

  const pairingWithNames = (historyResult || []).map((pc) => ({
    ...pc,
    courtName:
      pc.courtName || pc.name || (normalizedCourts.find((c) => c.id === pc.court)?.name) || "Sân",
    explanation: buildCourtExplanation(
      {
        diff: pc.diff || 0,
        score: pc.score || 0,
        detailScore: pc.detailScore,
      },
      context
    ),
  }));

  const finalCourts = [...lockedCourts, ...pairingWithNames];

  const finalWaiting = [
    ...lockedPlayers,
    ...(waitingResult.waitingPlayers || []),
    ...(balanceResult.waitingPlayers || []),
  ];

  const aiScore = calculateAIScore(
    finalCourts,
    finalWaiting.length,
    competition.playersPerCourt
  );

  const alternatives = pairingCandidates.map((candidate, index) => {
    const summary = summarizeCandidate(candidate);

    return {
      index,
      totalScore: candidate.totalScore || 0,
      comparison: {
        avgDiff: summary.avgDiff,
        maxDiff: summary.maxDiff,
        minDiff: summary.minDiff,
      },
      courts: mapCandidateCourtsWithNames(candidate, normalizedCourts, context),
    };
  });

  trace = appendDebugTrace(
    trace,
    createDebugTrace("result.finalize", {
      courtCount: finalCourts.length,
      waitingCount: finalWaiting.length,
      aiScore: aiScore.total,
      lockedOnly: false,
    })
  );

  trace = maybePersistScheduleResult(
    {
      courts: finalCourts,
      waiting: finalWaiting,
      aiScore,
    },
    options,
    competitionType,
    trace
  );

  return finalizeResult(
    {
      courts: finalCourts,
      waiting: finalWaiting,
      aiScore,
      explanation: pairingWithNames.map((court) => ({
        court: court.court,
        explanation: court.explanation,
      })),
      candidates: pairingCandidates,
      alternatives,
      selectedAlternativeIndex: 0,
      bestCandidateScore: bestPairing.totalScore || 0,
      competitionType,
      persisted: persist,
    },
    trace
  );
}
