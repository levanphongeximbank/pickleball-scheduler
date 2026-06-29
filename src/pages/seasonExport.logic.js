import { buildSeasonStandingsCsv } from "./statistics.season.logic.js";

function slugifySeasonName(name = "mua") {
  return String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .slice(0, 40);
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

  return sections.filter(Boolean).join("\n\n");
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

export function downloadSeasonExportJson(exportPackage) {
  const slug = slugifySeasonName(exportPackage?.season?.name);
  downloadTextFile({
    content: JSON.stringify(exportPackage, null, 2),
    mimeType: "application/json;charset=utf-8",
    fileName: `ket-qua-mua-${slug}-${new Date().toISOString().slice(0, 10)}.json`,
  });
}

export function downloadSeasonExportCsv(exportPackage) {
  const slug = slugifySeasonName(exportPackage?.season?.name);
  downloadTextFile({
    content: buildSeasonFullCsv(exportPackage),
    mimeType: "text/csv;charset=utf-8",
    fileName: `bxh-mua-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
  });
}
