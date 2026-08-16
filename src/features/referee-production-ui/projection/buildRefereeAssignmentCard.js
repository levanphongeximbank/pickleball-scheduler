/**
 * Normalize one Home assignment card from CORE-13 + Adapter B projection.
 */

import { resolveAssignmentAction } from "./resolveAssignmentAction.js";
import { projectResultStatus } from "./resultStatus.js";
import {
  formatAssignmentStatusLabel,
  formatCompetitionDisplayName,
  formatCompetitionModeLabel,
  formatCourtLabel,
  formatLocalScheduledTime,
  formatMatchStatusLabel,
  formatParticipantDisplayName,
  isRawTechnicalId,
} from "./formatRefereeUiLabels.js";

function resolveNameToken(token, names) {
  if (token == null) return null;
  const id = String(token).trim();
  if (!id) return null;
  const row = names?.[id];
  if (row && typeof row === "object") {
    return row.displayName || row.name || null;
  }
  if (typeof row === "string" && row.trim()) return row.trim();
  return null;
}

function firstName(side, names) {
  if (!side) return "Chưa có tên";
  if (side.displayName) {
    return formatParticipantDisplayName(side.displayName);
  }
  if (side.teamName) {
    return formatParticipantDisplayName(side.teamName);
  }
  const ids = Array.isArray(side?.participantIds) ? side.participantIds : [];
  const mapped = ids
    .map((id) => resolveNameToken(id, names) || (isRawTechnicalId(id) ? null : id))
    .filter(Boolean);
  if (mapped.length) return mapped.join(" / ");
  const teamName = resolveNameToken(side.teamId, names);
  if (teamName) return formatParticipantDisplayName(teamName);
  const entryName = resolveNameToken(side.entryId, names);
  if (entryName) return formatParticipantDisplayName(entryName);
  return "Chưa có tên";
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
  const matchStatus =
    assigned.lifecycleState ||
    matchContext.status ||
    live.status ||
    assignment.matchStatus ||
    null;
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
  const assignmentStatus = assignment.status || "ASSIGNED";

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
    roundName: matchContext.round != null ? String(matchContext.round) : assignment.roundName || null,
    stageName: matchContext.stage || assignment.stageName || null,
    courtId: assignment.courtId || matchContext.courtId || assigned.courtId || null,
    courtLabel,
    scheduledTime: formatLocalScheduledTime(scheduledRaw),
    scheduledTimeRaw: scheduledRaw,
    participantA: firstName(sides[0], names),
    participantB: firstName(sides[1], names),
    assignmentStatus,
    assignmentStatusLabel: formatAssignmentStatusLabel(assignmentStatus),
    matchStatus,
    matchStatusLabel: formatMatchStatusLabel(matchStatus),
    resultStatus: result.resultStatus,
    acceptedOfficialResult: result.acceptedOfficialResult,
    action: action.action,
    actionLabel: action.label,
    href: `/referee/match/${encodeURIComponent(String(assignment.matchId || matchContext.matchId || "").trim())}`,
    // Diagnostics only — not primary card content
    diagnostics: Object.freeze({
      matchId: String(assignment.matchId || matchContext.matchId || "").trim(),
      competitionId: String(assignment.competitionId || competition.competitionId || "").trim(),
    }),
  });
}
