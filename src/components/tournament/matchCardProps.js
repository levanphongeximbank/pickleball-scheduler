import { getLatestScoreLogEntry } from "../../models/tournament/scoreLog.js";
import { getCourtDisplayName } from "../../models/court.js";

function resolveCourtSubtitle(courtId, courts = []) {
  if (!courtId) {
    return "Chưa gán sân";
  }

  const court = courts.find((item) => String(item.id) === String(courtId));
  return court ? getCourtDisplayName(court) : `Sân ${courtId}`;
}

function isUsableLabel(value) {
  if (value == null) return false;
  const text = String(value).trim();
  if (!text) return false;
  if (text === "undefined" || text === "null") return false;
  return true;
}

function resolvePlayerName(playerId, playersById) {
  const key = String(playerId);
  const player = playersById?.get?.(key) || playersById?.[key];
  if (isUsableLabel(player?.name)) return String(player.name).trim();
  if (isUsableLabel(player?.displayName)) return String(player.displayName).trim();
  return key;
}

export function resolveDailyMatchTeamLabel(match, side = "A", players = []) {
  const explicit =
    side === "B"
      ? match?.teamBLabel ?? match?.entryBLabel
      : match?.teamALabel ?? match?.entryALabel;
  if (isUsableLabel(explicit)) {
    return String(explicit).trim();
  }

  const ids =
    side === "B"
      ? match?.teamBPlayerIds || match?.teamB || []
      : match?.teamAPlayerIds || match?.teamA || [];

  const playersById =
    players instanceof Map
      ? players
      : new Map((players || []).map((player) => [String(player.id), player]));

  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map((id) => resolvePlayerName(id, playersById)).join(" / ");
  }

  return "TBD";
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

export function buildDailyMatchCardProps(
  match,
  {
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    liveRow,
    courts = [],
    players = [],
  } = {}
) {
  const subtitle = buildMatchSubtitle(match, { liveRow, courts });
  const teamA = resolveDailyMatchTeamLabel(match, "A", players);
  const teamB = resolveDailyMatchTeamLabel(match, "B", players);

  return {
    title: `${teamA} vs ${teamB}`,
    subtitle,
    actionLabel,
    onAction: onAction ? () => onAction(match) : undefined,
    secondaryActionLabel,
    onSecondaryAction: onSecondaryAction
      ? () => onSecondaryAction(match)
      : undefined,
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
    players = [],
  } = {}
) {
  const subtitle = buildMatchSubtitle(match, { liveRow, courts });
  const teamA = resolveDailyMatchTeamLabel(match, "A", players);
  const teamB = resolveDailyMatchTeamLabel(match, "B", players);

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
