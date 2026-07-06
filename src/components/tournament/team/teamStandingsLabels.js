import { FORMAT_PRESET } from "../../../features/team-tournament/constants.js";

export const TEAM_STANDINGS_COLUMNS = [
  { id: "rank", label: "#", align: "center", sticky: true },
  { id: "team", label: "Đội", align: "left", sticky: true },
  { id: "played", label: "Trận", align: "center" },
  { id: "record", label: "T–B", align: "center" },
  { id: "subRecord", label: "Tr.con", align: "center", title: "Trận con thắng–thua (gồm Dreambreaker)" },
  { id: "scored", label: "Ghi", align: "center" },
  { id: "conceded", label: "Bị", align: "center" },
  { id: "diff", label: "±", align: "center" },
  { id: "points", label: "Điểm", align: "right" },
];

export const TIEBREAK_LABELS = {
  wins: "Thắng",
  subMatchDiff: "HS trận con",
  pointsScored: "Điểm ghi",
  manual: "BTC quyết định",
};

export function formatFormatPresetLabel(formatPreset) {
  if (formatPreset === FORMAT_PRESET.MLP_4) {
    return "MLP 4 người";
  }
  if (formatPreset === FORMAT_PRESET.CUSTOM) {
    return "Tùy chỉnh";
  }
  return "";
}

export function buildTiebreakLegend(tiebreakOrder = []) {
  const labels = (tiebreakOrder || [])
    .map((key) => TIEBREAK_LABELS[key])
    .filter(Boolean);

  if (!labels.length) {
    return "";
  }

  return `Tie-break: ${labels.join(" → ")}`;
}

export function countMatchupsWithSubResults(matchups = []) {
  return matchups.filter((matchup) => {
    const result = matchup.result;
    if (!result) {
      return false;
    }
    return (Number(result.teamAWins) || 0) + (Number(result.teamBWins) || 0) > 0;
  }).length;
}

export function formatSubMatchDiff(value) {
  const diff = Number(value) || 0;
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

export function getSubMatchDiffClassName(value) {
  const diff = Number(value) || 0;
  if (diff > 0) {
    return "team-standings__diff--pos";
  }
  if (diff < 0) {
    return "team-standings__diff--neg";
  }
  return "";
}

export function getStandingsRowClassName(rank) {
  if (rank === 1) {
    return "team-standings__row--first";
  }
  if (rank === 2) {
    return "team-standings__row--second";
  }
  if (rank === 3) {
    return "team-standings__row--third";
  }
  return "";
}
