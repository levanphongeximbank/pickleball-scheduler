/**
 * Normalize one Home assignment card from CORE-13 + Adapter B projection.
 */

import { mapModeStatusToCore15 } from "../../competition-engine/integration/referee/adapters/shared/matchStatusMapper.js";
import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { resolveAssignmentAction } from "./resolveAssignmentAction.js";
import { projectResultStatus } from "./resultStatus.js";
import {
  formatAssignmentStatusLabel,
  formatCompetitionDisplayName,
  formatCompetitionModeLabel,
  formatCompactScheduledClock,
  formatCourtLabel,
  formatLocalScheduledTime,
  formatMatchStatusLabel,
  formatParticipantDisplayName,
} from "./formatRefereeUiLabels.js";
import { resolveAssignmentHomeBucket } from "./buildRefereeHomeSummary.js";
import { resolveRefereeSideDisplay } from "./resolveRefereeSideDisplay.js";
import {
  projectCompetitionMatchFormat,
  REFEREE_MATCH_FORMAT,
} from "./projectCompetitionMatchFormat.js";

const LIVE_MATCH_STATUSES = new Set([
  MATCH_STATUS.IN_PROGRESS,
  MATCH_STATUS.SUSPENDED,
  MATCH_STATUS.PAUSED,
]);

/**
 * Prefer an active lifecycle signal when sources disagree (Home vs Match).
 * @param {...unknown} candidates
 */
function pickMatchStatus(...candidates) {
  const normalized = [];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    normalized.push(mapModeStatusToCore15(raw));
  }
  if (!normalized.length) return null;
  const live = normalized.find((status) => LIVE_MATCH_STATUSES.has(status));
  return live || normalized[0];
}

function cardSideFields(side, names, matchFormat) {
  const resolved = resolveRefereeSideDisplay(side, names, { matchFormat });
  const memberLine = resolved.memberLine;
  const entryLabel = resolved.presentationEntryLabel;
  const primary =
    memberLine ||
    entryLabel ||
    formatParticipantDisplayName(side?.displayName || side?.teamName);
  return {
    primary,
    entryLabel,
    memberLine,
    members: resolved.members,
  };
}

/**
 * @param {{
 *   assignment: object,
 *   competitionContext?: object|null,
 *   matchContext?: object|null,
 *   participants?: object|null,
 *   live?: object|null,
 *   assignedMatch?: object|null,
 *   participantNames?: Record<string, string|object>,
 *   competitionMode: string,
 *   modeState?: object|null,
 * }} input
 */
export function buildRefereeAssignmentCard(input) {
  const assignment = input.assignment || {};
  const competition = input.competitionContext || {};
  const matchContext = input.matchContext || {};
  const modeState = input.modeState || assignment.modeState || {};
  const participants = input.participants || { sides: [] };
  const sides = Array.isArray(participants.sides) ? participants.sides : [];
  const names = {
    ...(modeState.participantNames || {}),
    ...(input.participantNames || {}),
  };
  const assigned = input.assignedMatch || {};
  const live = input.live || {};
  const matchStatus = pickMatchStatus(
    assigned.lifecycleState,
    matchContext.status,
    live.status,
    assignment.matchStatus,
    assignment.lifecycleState
  );
  const validationStatus = assigned.validationStatus || null;
  const result = projectResultStatus({
    matchStatus,
    validationStatus,
    scoreProjection: assigned.scoreProjection || null,
  });
  const action = resolveAssignmentAction({
    assignmentStatus: assignment.status,
    matchStatus,
    resultStatus: result.resultStatus,
    validationStatus,
  });

  const competitionMode = String(
    input.competitionMode || competition.competitionMode || modeState.competitionMode || ""
  ).trim();
  const competitionName = formatCompetitionDisplayName({
    competitionName:
      competition.competitionName ||
      modeState.competitionName ||
      assignment.competitionName ||
      null,
    competitionId: assignment.competitionId || competition.competitionId,
  });
  const courtLabel = formatCourtLabel({
    courtLabel:
      assignment.courtLabel ||
      matchContext.courtLabel ||
      modeState.courtLabel ||
      null,
    courtId: assignment.courtId || matchContext.courtId || assigned.courtId || null,
  });
  const scheduledRaw =
    assignment.scheduledAt ||
    matchContext.scheduledAt ||
    assigned.scheduledAt ||
    null;
  const assignmentStatus = assignment.status || assignment.opsStatus || null;
  const homeBucket = resolveAssignmentHomeBucket({
    matchStatus,
    action: action.action,
    acceptedOfficialResult: result.acceptedOfficialResult,
  });
  const sideContent = projectCompetitionMatchFormat({
    competitionMode,
    eventType: matchContext.eventType,
    competitionContentCode:
      matchContext.competitionContentCode ||
      assigned.competitionContentCode ||
      null,
    competitionContentLabel:
      matchContext.competitionContentLabel ||
      assigned.competitionContentLabel ||
      null,
    matchFormat: matchContext.matchFormat || null,
    expectedPlayersPerSide: matchContext.expectedPlayersPerSide ?? null,
    isDreambreaker: matchContext.isDreambreaker === true,
    discipline: matchContext.discipline || null,
    disciplineName: matchContext.disciplineName || null,
    matchType: matchContext.matchType || null,
    sides,
  });
  const sideAFields = cardSideFields(sides[0], names, sideContent.matchFormat);
  const sideBFields = cardSideFields(sides[1], names, sideContent.matchFormat);
  const roundLabel =
    matchContext.round != null
      ? `Vòng ${matchContext.round}`
      : assignment.roundName || null;

  return Object.freeze({
    matchId: String(assignment.matchId || matchContext.matchId || "").trim(),
    competitionId: String(
      assignment.competitionId ||
        competition.competitionId ||
        matchContext.competitionId ||
        ""
    ).trim(),
    competitionMode,
    competitionModeLabel: formatCompetitionModeLabel(competitionMode),
    competitionName,
    competitionContentCode: sideContent.competitionContentCode,
    competitionContentLabel: sideContent.competitionContentLabel,
    matchFormat: sideContent.matchFormat,
    expectedPlayersPerSide: sideContent.expectedPlayersPerSide,
    isSingles: sideContent.matchFormat === REFEREE_MATCH_FORMAT.SINGLES,
    isDoubles: sideContent.matchFormat === REFEREE_MATCH_FORMAT.DOUBLES,
    isDreamBreaker: sideContent.matchFormat === REFEREE_MATCH_FORMAT.DREAMBREAKER,
    roundName: matchContext.round != null ? String(matchContext.round) : assignment.roundName || null,
    roundLabel,
    stageName: matchContext.stage || assignment.stageName || null,
    courtId: assignment.courtId || matchContext.courtId || assigned.courtId || null,
    courtLabel,
    scheduledTime: formatCompactScheduledClock(scheduledRaw) || formatLocalScheduledTime(scheduledRaw),
    scheduledTimeRaw: scheduledRaw,
    participantA: sideAFields.primary,
    participantB: sideBFields.primary,
    participantAEntryLabel: sideAFields.entryLabel,
    participantBEntryLabel: sideBFields.entryLabel,
    participantAMemberLine: sideAFields.memberLine,
    participantBMemberLine: sideBFields.memberLine,
    participantAMembers: Object.freeze(sideAFields.members || []),
    participantBMembers: Object.freeze(sideBFields.members || []),
    assignmentStatus,
    assignmentStatusLabel: formatAssignmentStatusLabel(assignmentStatus),
    matchStatus,
    matchStatusLabel: formatMatchStatusLabel(matchStatus),
    homeStatusBucket: homeBucket,
    homeStatusLabel:
      homeBucket === "LIVE"
        ? "Đang thi đấu"
        : homeBucket === "DONE"
          ? "Hoàn tất"
          : "Sắp diễn ra",
    resultStatus: result.resultStatus,
    acceptedOfficialResult: result.acceptedOfficialResult,
    action: action.action,
    actionLabel: action.label,
    href: (() => {
      const mid = String(
        assignment.matchId || matchContext.matchId || ""
      ).trim();
      const cid = String(
        assignment.competitionId ||
          competition.competitionId ||
          matchContext.competitionId ||
          ""
      ).trim();
      const base = `/referee/match/${encodeURIComponent(mid)}`;
      return cid ? `${base}?competitionId=${encodeURIComponent(cid)}` : base;
    })(),
    // Diagnostics only — not primary card content
    diagnostics: Object.freeze({
      matchId: String(assignment.matchId || matchContext.matchId || "").trim(),
      competitionId: String(assignment.competitionId || competition.competitionId || "").trim(),
    }),
  });
}
