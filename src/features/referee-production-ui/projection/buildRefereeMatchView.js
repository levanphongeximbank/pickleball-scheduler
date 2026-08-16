/**
 * RefereeMatchView — projection only. Not a second authority.
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { REFEREE_ACTION } from "../../competition-engine/operations/referee/constants.js";
import { formatScoringPolicyLabel } from "./formatScoringPolicyLabel.js";
import { projectCanonicalCourtView } from "./projectCanonicalCourtView.js";
import { projectResultStatus } from "./resultStatus.js";
import {
  formatCompetitionDisplayName,
  formatCompetitionModeLabel,
  formatCourtLabel,
  formatMatchStatusLabel,
  formatParticipantDisplayName,
} from "./formatRefereeUiLabels.js";

function allowed(projection, action) {
  return (projection?.allowedActions || []).some((row) => row.action === action);
}

function readCompletedGames(scoreProjection) {
  const fromProjection = scoreProjection?.completedGames;
  const fromState = scoreProjection?.scoringState?.completedGames;
  const rows = Array.isArray(fromProjection)
    ? fromProjection
    : Array.isArray(fromState)
      ? fromState
      : [];
  return rows
    .map((game, index) => {
      const sideA = Number(game?.SIDE_A ?? game?.sideA ?? game?.a);
      const sideB = Number(game?.SIDE_B ?? game?.sideB ?? game?.b);
      if (!Number.isFinite(sideA) || !Number.isFinite(sideB)) return null;
      return Object.freeze({
        gameNumber: Number(game?.gameIndex ?? index) + 1,
        sideA,
        sideB,
        winnerSide: game?.winnerSide || null,
      });
    })
    .filter(Boolean);
}

function playerNamesForSide(side, names) {
  const ids = Array.isArray(side?.participantIds) ? side.participantIds : [];
  return ids
    .map((id) => {
      const row = names?.[id];
      if (row && typeof row === "object") {
        return formatParticipantDisplayName(row.displayName || row.name || null);
      }
      if (typeof row === "string") return formatParticipantDisplayName(row);
      return null;
    })
    .filter(Boolean);
}

/**
 * @param {{
 *   matchId: string,
 *   competitionMode: string,
 *   adapterSelected: string,
 *   competitionContext?: object|null,
 *   matchContext?: object|null,
 *   participants?: object|null,
 *   scoringRules?: object|null,
 *   lifecyclePolicy?: object|null,
 *   capabilities?: object|null,
 *   assignedMatch?: object|null,
 *   operationsProjection?: object|null,
 *   courtState?: object|null,
 *   modeState?: object|null,
 *   participantNames?: Record<string, string|object>,
 *   expectedVersion?: number,
 *   pendingCanonicalAction?: string|null,
 *   stale?: boolean,
 *   preStart?: object|null,
 * }} input
 */
export function buildRefereeMatchView(input) {
  const assigned = input.assignedMatch || {};
  const match = assigned.match || {};
  const competition = input.competitionContext || {};
  const matchContext = input.matchContext || {};
  const scoringRules = input.scoringRules || assigned.scoreProjection?.format || null;
  const lifecyclePolicy = input.lifecyclePolicy || {};
  const capabilities = input.capabilities || {};
  const projection = input.operationsProjection || {};
  const scoreProjection = assigned.scoreProjection || null;
  const matchStatus = assigned.lifecycleState || match.status || matchContext.status || null;
  const result = projectResultStatus({
    matchStatus,
    validationStatus: assigned.validationStatus,
    scoreProjection,
  });
  const policy = formatScoringPolicyLabel({ scoringRules, lifecyclePolicy });
  const names = {
    ...(input.modeState?.participantNames || {}),
    ...(input.participantNames || {}),
  };
  const courtProjection = projectCanonicalCourtView({
    participants: input.participants,
    scoringRules,
    currentScore: scoreProjection
      ? {
          points: scoreProjection.points,
          serve: scoreProjection.serve,
          currentGameIndex: scoreProjection.currentGameIndex,
        }
      : null,
    matchContext,
    modeState: input.modeState,
    courtState: input.courtState || match.court || scoreProjection?.scoringState?.court || {},
    participantNames: names,
    lifecyclePolicy,
  });

  const canCorrect =
    capabilities.correction === true ||
    capabilities.correctResult === true ||
    allowed(projection, REFEREE_ACTION.RESULT_CORRECT);

  // Manual change-ends only when capability/policy explicitly allows it.
  // Policy-required change-ends is driven by courtProjection.sideChangeRequired.
  const canChangeEnds =
    capabilities.changeEnds === true ||
    capabilities.manualChangeEnds === true ||
    capabilities.change_ends === true;

  const canSwitchPositions =
    capabilities.switchPositions === true ||
    capabilities.switch_positions === true ||
    (matchStatus === MATCH_STATUS.IN_PROGRESS &&
      capabilities.switchPositions !== false &&
      capabilities.switch_positions !== false);

  const sides = Array.isArray(input.participants?.sides) ? input.participants.sides : [];
  const sideA = sides[0] || null;
  const sideB = sides[1] || null;
  const leftPlayers = (courtProjection.sides?.left?.activePlayers || []).map((p) => p.displayName);
  const rightPlayers = (courtProjection.sides?.right?.activePlayers || []).map((p) => p.displayName);
  const fallbackA = playerNamesForSide(sideA, names);
  const fallbackB = playerNamesForSide(sideB, names);
  const scoringSideAName =
    courtProjection.sides?.left?.scoringSide === "SIDE_A"
      ? courtProjection.sides?.left?.participant?.displayName
      : courtProjection.sides?.right?.participant?.displayName;
  const scoringSideBName =
    courtProjection.sides?.left?.scoringSide === "SIDE_B"
      ? courtProjection.sides?.left?.participant?.displayName
      : courtProjection.sides?.right?.participant?.displayName;
  const sideAName =
    scoringSideAName ||
    formatParticipantDisplayName(sideA?.displayName || sideA?.teamName);
  const sideBName =
    scoringSideBName ||
    formatParticipantDisplayName(sideB?.displayName || sideB?.teamName);

  const competitionName = formatCompetitionDisplayName({
    competitionName:
      competition.competitionName ||
      input.modeState?.competitionName ||
      null,
    competitionId: competition.competitionId || matchContext.competitionId,
  });
  const courtLabel = formatCourtLabel({
    courtLabel: matchContext.courtLabel || null,
    courtId: matchContext.courtId || assigned.courtId || match.courtAssignmentRef || null,
  });
  const stageName = matchContext.stage || null;
  const roundName = matchContext.round != null ? String(matchContext.round) : null;
  const stageRound = [stageName, roundName ? (stageName ? roundName : `Vòng ${roundName}`) : null]
    .filter(Boolean)
    .join(" · ");
  const contextRow = [courtLabel, competitionName, stageRound || null].filter(Boolean).join(" | ");

  const points = scoreProjection?.points || null;
  const previousGames = readCompletedGames(scoreProjection);
  const servingPlayer =
    courtProjection.serving?.serverPlayerId != null
      ? Object.values(courtProjection.court || {}).find(
          (slot) => slot && slot.playerId === courtProjection.serving.serverPlayerId
        ) || null
      : null;

  return Object.freeze({
    matchId: String(input.matchId || "").trim(),
    competitionId: String(
      competition.competitionId || matchContext.competitionId || ""
    ).trim(),
    competitionMode: String(input.competitionMode || "").trim(),
    competitionModeLabel: formatCompetitionModeLabel(input.competitionMode),
    competitionName,
    adapterSelected: String(input.adapterSelected || input.competitionMode || "").trim(),
    stageName,
    roundName,
    stageRoundLabel: stageRound || null,
    contextRow,
    courtId: matchContext.courtId || assigned.courtId || match.courtAssignmentRef || null,
    courtLabel,
    participants: input.participants || { sides: [] },
    participantDisplay: Object.freeze({
      sideA: Object.freeze({
        label: sideAName,
        playerNames: Object.freeze(
          courtProjection.sides?.left?.scoringSide === "SIDE_A"
            ? leftPlayers.length
              ? leftPlayers
              : fallbackA
            : rightPlayers.length
              ? rightPlayers
              : fallbackA
        ),
      }),
      sideB: Object.freeze({
        label: sideBName,
        playerNames: Object.freeze(
          courtProjection.sides?.left?.scoringSide === "SIDE_B"
            ? leftPlayers.length
              ? leftPlayers
              : fallbackB
            : rightPlayers.length
              ? rightPlayers
              : fallbackB
        ),
      }),
    }),
    scoringRules,
    lifecyclePolicy,
    rulesPanel: Object.freeze({
      title: "LUẬT TRẬN",
      rows: policy.rulesRows,
      scoringMethod: policy.scoringMethodLabel,
      targetScore: policy.pointsToWin,
      winBy: policy.winBy,
      cap: policy.cap,
      capLabel: policy.capLabel,
      changeEndAt: policy.changeEndAtLabel,
      bestOf: policy.bestOfGames,
    }),
    refereeCapabilities: Object.freeze({
      ...capabilities,
      correction: canCorrect,
      scoring: capabilities.scoring !== false,
      suspend: capabilities.suspend !== false,
      resume: capabilities.resume !== false,
      changeEnds: canChangeEnds,
      switchPositions: canSwitchPositions,
    }),
    currentScore: scoreProjection
      ? Object.freeze({
          points: scoreProjection.points || null,
          serve: scoreProjection.serve || null,
          gamesWon: scoreProjection.gamesWonInCurrentSet || null,
          setsWon: scoreProjection.setsWon || null,
          currentGameIndex: scoreProjection.currentGameIndex ?? 0,
        })
      : null,
    gameSummary: Object.freeze({
      currentGame: (scoreProjection?.currentGameIndex ?? 0) + 1,
      gamesWon: scoreProjection?.gamesWonInCurrentSet || null,
      bestOf: policy.bestOfGames,
      targetScore: policy.pointsToWin,
      winBy: policy.winBy,
      cap: policy.cap,
      changeEndPolicy: policy.changeEndPolicyLabel,
      scorePolicyLine: policy.scorePolicyLine,
      currentGamePoints: points
        ? Object.freeze({
            sideA: Number(points.SIDE_A || 0),
            sideB: Number(points.SIDE_B || 0),
          })
        : null,
      previousGames: Object.freeze(previousGames),
    }),
    matchStatus,
    matchStatusLabel: formatMatchStatusLabel(matchStatus),
    resultStatus: result.resultStatus,
    resultStatusLabel: result.label,
    officialWinner: result.officialWinner,
    calculatedWinnerSide: result.calculatedWinnerSide,
    acceptedOfficialResult: result.acceptedOfficialResult,
    expectedVersion: Number(input.expectedVersion ?? 0),
    courtProjection,
    servingState: courtProjection.serving,
    servingStatus: Object.freeze({
      servingTeamName:
        courtProjection.serving?.servingSide === "SIDE_B"
          ? sideBName
          : courtProjection.serving?.servingSide === "SIDE_A"
            ? sideAName
            : null,
      servingPlayerName: servingPlayer?.displayName || null,
      serviceTurn: courtProjection.serving?.serviceTurn ?? null,
      showServiceTurn: courtProjection.scoreLine?.showServiceTurn === true,
      gameLabel: policy.bestOfGames
        ? `Game ${(scoreProjection?.currentGameIndex ?? 0) + 1} / Best of ${policy.bestOfGames}`
        : `Game ${(scoreProjection?.currentGameIndex ?? 0) + 1}`,
    }),
    pendingCanonicalAction: input.pendingCanonicalAction || null,
    stale: input.stale === true,
    preStart: input.preStart || null,
    canStart:
      matchStatus === MATCH_STATUS.READY_TO_START ||
      matchStatus === MATCH_STATUS.SCHEDULED ||
      matchStatus === MATCH_STATUS.READY ||
      !matchStatus,
    canScore:
      matchStatus === MATCH_STATUS.IN_PROGRESS &&
      capabilities.scoring !== false &&
      assigned.scoreEntryReady !== false,
    canSuspend:
      matchStatus === MATCH_STATUS.IN_PROGRESS && capabilities.suspend !== false,
    canResume:
      (matchStatus === MATCH_STATUS.SUSPENDED || matchStatus === MATCH_STATUS.PAUSED) &&
      capabilities.resume !== false,
    canChangeEnds,
    canSwitchPositions,
    canComplete: Boolean(scoreProjection?.calculatedMatchComplete),
    canCorrect,
    usesAdapterB: true,
    silentLegacyFallback: false,
    productionFixtureFallback: false,
    locationStateRequired: false,
  });
}
