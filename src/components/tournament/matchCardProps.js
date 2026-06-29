import { getLatestScoreLogEntry } from "../../models/tournament/scoreLog.js";

export function buildDailyMatchCardProps(match, { actionLabel, onAction, liveRow } = {}) {
  const latestLog = getLatestScoreLogEntry(match);
  const subtitle = [
    match.courtId ? `Sân ${match.courtId}` : "Chưa gán sân",
    match.scoreA != null && match.scoreB != null ? `${match.scoreA}-${match.scoreB}` : null,
    liveRow && (liveRow.scoreA > 0 || liveRow.scoreB > 0) ? `Live ${liveRow.scoreA}-${liveRow.scoreB}` : null,
    latestLog ? `Cuối: ${latestLog.scoreA}-${latestLog.scoreB}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

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
} = {}
) {
  const liveScore =
    liveRow && (liveRow.scoreA > 0 || liveRow.scoreB > 0)
      ? `Live ${liveRow.scoreA}-${liveRow.scoreB}`
      : null;
  const latestLog = getLatestScoreLogEntry(match);

  const subtitle = [
    match.courtId ? `Sân ${match.courtId}` : "Chưa gán sân",
    match.referee?.name ? `TT: ${match.referee.name}` : null,
    liveScore,
    !liveScore && match.scoreA != null && match.scoreB != null
      ? `${match.scoreA}-${match.scoreB}`
      : null,
    latestLog ? `Cuối: ${latestLog.scoreA}-${latestLog.scoreB}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    title: `${match.entryALabel || match.teamALabel} vs ${match.entryBLabel || match.teamBLabel}`,
    subtitle,
    badge: match.stageLabel || match.matchType || "Trận",
    statusChip: refereeStatus,
    actionLabel,
    onAction: onAction ? () => onAction(match) : undefined,
    secondaryActionLabel,
    onSecondaryAction: onSecondaryAction ? () => onSecondaryAction(match) : undefined,
    tertiaryActionLabel,
    onTertiaryAction: onTertiaryAction ? () => onTertiaryAction(match) : undefined,
  };
}
