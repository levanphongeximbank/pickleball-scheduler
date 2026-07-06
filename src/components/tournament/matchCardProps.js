import { getLatestScoreLogEntry } from "../../models/tournament/scoreLog.js";
import { getCourtDisplayName } from "../../models/court.js";

function resolveCourtSubtitle(courtId, courts = []) {
  if (!courtId) {
    return "Chưa gán sân";
  }

  const court = courts.find((item) => String(item.id) === String(courtId));
  return court ? getCourtDisplayName(court) : `Sân ${courtId}`;
}

function buildMatchSubtitle(match, { liveRow, courts = [] } = {}) {
  const liveScore =
    liveRow && (liveRow.scoreA > 0 || liveRow.scoreB > 0)
      ? `Live ${liveRow.scoreA}-${liveRow.scoreB}`
      : null;
  const latestLog = getLatestScoreLogEntry(match);

  return [
    resolveCourtSubtitle(match.courtId, courts),
    match.referee?.name ? `TT: ${match.referee.name}` : null,
    liveScore,
    !liveScore && match.scoreA != null && match.scoreB != null
      ? `${match.scoreA}-${match.scoreB}`
      : null,
    latestLog ? `Cuối: ${latestLog.scoreA}-${latestLog.scoreB}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

export function buildDailyMatchCardProps(match, { actionLabel, onAction, liveRow, courts = [] } = {}) {
  const subtitle = buildMatchSubtitle(match, { liveRow, courts });

  return {
    title: `${match.teamALabel} vs ${match.teamBLabel}`,
    subtitle,
    actionLabel,
    onAction: onAction ? () => onAction(match) : undefined,
  };
}

export function buildDirectorMatchCardProps(
  match,
  {
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    tertiaryActionLabel,
    onTertiaryAction,
    liveRow,
    refereeStatus,
    courts = [],
    showRefereeStatus = true,
  } = {}
) {
  const subtitle = buildMatchSubtitle(match, { liveRow, courts });
  const teamA = match.entryALabel || match.teamALabel || "Đội A";
  const teamB = match.entryBLabel || match.teamBLabel || "Đội B";

  return {
    title: `${teamA} vs ${teamB}`,
    subtitle,
    badge: match.stageLabel || match.matchType || "Trận",
    statusChip: showRefereeStatus ? refereeStatus : null,
    actionLabel,
    onAction: onAction ? () => onAction(match) : undefined,
    secondaryActionLabel,
    onSecondaryAction: onSecondaryAction ? () => onSecondaryAction(match) : undefined,
    tertiaryActionLabel,
    onTertiaryAction: onTertiaryAction ? () => onTertiaryAction(match) : undefined,
  };
}
