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
} from "./formatRefereeUiLabels.js";

function allowed(projection, action) {
  return (projection?.allowedActions || []).some((row) => row.action === action);
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
    participantNames: input.participantNames,
    lifecyclePolicy,
  });

  const canCorrect =
    capabilities.correction === true ||
    capabilities.correctResult === true ||
    allowed(projection, REFEREE_ACTION.RESULT_CORRECT);

  return Object.freeze({
    matchId: String(input.matchId || "").trim(),
    competitionId: String(
      competition.competitionId || matchContext.competitionId || ""
    ).trim(),
    competitionMode: String(input.competitionMode || "").trim(),
    competitionModeLabel: formatCompetitionModeLabel(input.competitionMode),
    competitionName: formatCompetitionDisplayName({
      competitionName:
        competition.competitionName ||
        input.modeState?.competitionName ||
        null,
      competitionId: competition.competitionId || matchContext.competitionId,
    }),
    adapterSelected: String(input.adapterSelected || input.competitionMode || "").trim(),
    stageName: matchContext.stage || null,
    roundName: matchContext.round != null ? String(matchContext.round) : null,
    courtId: matchContext.courtId || assigned.courtId || match.courtAssignmentRef || null,
    courtLabel: formatCourtLabel({
      courtLabel: matchContext.courtLabel || null,
      courtId: matchContext.courtId || assigned.courtId || match.courtAssignmentRef || null,
    }),
    participants: input.participants || { sides: [] },
    scoringRules,
    lifecyclePolicy,
    refereeCapabilities: Object.freeze({
      ...capabilities,
      correction: canCorrect,
      scoring: capabilities.scoring !== false,
      suspend: capabilities.suspend !== false,
      resume: capabilities.resume !== false,
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
    canComplete: Boolean(scoreProjection?.calculatedMatchComplete),
    canCorrect,
    usesAdapterB: true,
    silentLegacyFallback: false,
    productionFixtureFallback: false,
    locationStateRequired: false,
  });
}
