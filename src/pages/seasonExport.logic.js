import { buildSeasonStandingsCsv } from "./statistics.season.logic.js";

function slugifySeasonName(name = "mua") {
  return String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .slice(0, 40);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildExportSummaryCsv(exportPackage) {
  const summary = exportPackage?.summary || {};
  const lines = [
    "Mua,Giá trị",
    `Tên mùa,${escapeCsvCell(exportPackage?.season?.name || "")}`,
    `Giải,${escapeCsvCell(summary.leagueCount || 0)}`,
    `Vòng,${escapeCsvCell(summary.roundCount || 0)}`,
    `Giải đấu,${escapeCsvCell(summary.tournamentCount || 0)}`,
    `Trận,${escapeCsvCell(summary.matchCount || 0)}`,
    `Hoàn tất,${escapeCsvCell(summary.completedMatchCount || 0)}`,
    `Đang diễn ra,${escapeCsvCell(summary.activeMatchCount || 0)}`,
    `Tiến độ,${escapeCsvCell(`${summary.progressPercent || 0}%`)}`,
    "",
  ];

  return lines.join("\n");
}

export function buildSeasonFullCsv(exportPackage) {
  if (!exportPackage) {
    return "";
  }

  const sections = (exportPackage.leagues || []).map((leagueSection) =>
    buildSeasonStandingsCsv(leagueSection.standings || [], {
      seasonName: exportPackage.season?.name,
      leagueName: leagueSection.league?.name,
    })
  );

  return [buildExportSummaryCsv(exportPackage), ...sections.filter(Boolean)].join("\n\n");
}

export function downloadTextFile({ content, mimeType, fileName }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildExportFileSuffix(exportPackage) {
  const slug = slugifySeasonName(exportPackage?.season?.name);
  const progress = exportPackage?.summary?.progressPercent ?? 0;
  return `${slug}-${progress}pct-${new Date().toISOString().slice(0, 10)}`;
}

export function downloadSeasonExportJson(exportPackage) {
  downloadTextFile({
    content: JSON.stringify(exportPackage, null, 2),
    mimeType: "application/json;charset=utf-8",
    fileName: `ket-qua-mua-${buildExportFileSuffix(exportPackage)}.json`,
  });
}

export function downloadSeasonExportCsv(exportPackage) {
  downloadTextFile({
    content: buildSeasonFullCsv(exportPackage),
    mimeType: "text/csv;charset=utf-8",
    fileName: `bxh-mua-${buildExportFileSuffix(exportPackage)}.csv`,
  });
}
