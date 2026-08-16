/**
 * Normalize one Home assignment card from CORE-13 + Adapter B projection.
 */

import { resolveAssignmentAction } from "./resolveAssignmentAction.js";
import { projectResultStatus } from "./resultStatus.js";

function firstName(side, names) {
  const ids = Array.isArray(side?.participantIds) ? side.participantIds : [];
  const mapped = ids
    .map((id) => {
      const row = names?.[id];
      if (row && typeof row === "object") return row.displayName || row.name || id;
      if (typeof row === "string" && row.trim()) return row.trim();
      return id;
    })
    .filter(Boolean);
  if (side?.displayName) return String(side.displayName);
  if (side?.teamName) return String(side.teamName);
  if (mapped.length) return mapped.join(" / ");
  return side?.teamId || side?.entryId || "—";
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
 * }} input
 */
export function buildRefereeAssignmentCard(input) {
  const assignment = input.assignment || {};
  const competition = input.competitionContext || {};
  const matchContext = input.matchContext || {};
  const participants = input.participants || { sides: [] };
  const sides = Array.isArray(participants.sides) ? participants.sides : [];
  const names = input.participantNames || {};
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

  return Object.freeze({
    matchId: String(assignment.matchId || matchContext.matchId || "").trim(),
    competitionId: String(
      assignment.competitionId ||
        competition.competitionId ||
        matchContext.competitionId ||
        ""
    ).trim(),
    competitionMode: String(input.competitionMode || competition.competitionMode || "").trim(),
    competitionName:
      String(
        competition.competitionName ||
          assignment.competitionName ||
          competition.competitionId ||
          assignment.competitionId ||
          ""
      ).trim() || "Giải",
    roundName: matchContext.round != null ? String(matchContext.round) : assignment.roundName || null,
    stageName: matchContext.stage || assignment.stageName || null,
    courtId: assignment.courtId || matchContext.courtId || assigned.courtId || null,
    courtLabel:
      assignment.courtLabel ||
      (assignment.courtId || matchContext.courtId
        ? `Sân ${assignment.courtId || matchContext.courtId}`
        : "Sân ?"),
    scheduledTime:
      assignment.scheduledAt ||
      matchContext.scheduledAt ||
      assigned.scheduledAt ||
      null,
    participantA: firstName(sides[0], names),
    participantB: firstName(sides[1], names),
    assignmentStatus: assignment.status || "ASSIGNED",
    matchStatus,
    resultStatus: result.resultStatus,
    acceptedOfficialResult: result.acceptedOfficialResult,
    action: action.action,
    actionLabel: action.label,
    href: `/referee/match/${encodeURIComponent(String(assignment.matchId || matchContext.matchId || "").trim())}`,
  });
}
