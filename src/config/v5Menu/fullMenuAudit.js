import { MENU_GROUPS } from "../navigationConfig.js";
import { auditMenuFeatureCoverage } from "./menuFeatureAudit.js";
import { TOURNAMENT_IN_PAGE_NAV } from "./tournamentInPageNav.js";
import { REPORTS_IN_PAGE_NAV } from "./reportsInPageNav.js";
import { AI_IN_PAGE_NAV } from "./aiInPageNav.js";
import { SUPPORT_IN_PAGE_NAV } from "./supportInPageNav.js";
import { FEATURE_STATUS } from "./menuBuilders.js";

function flattenInPageNav(registry) {
  const rows = [];
  const sources = Array.isArray(registry) ? registry : [registry];

  for (const hub of sources) {
    if (!hub?.sections) continue;
    for (const section of hub.sections) {
      for (const item of section.items || []) {
        rows.push({
          group: hub.title || "In-page",
          trail: `${hub.title} › ${section.label} › ${item.text}`,
          key: item.key,
          text: item.text,
          path: item.path || "",
          featureStatus: item.featureStatus || FEATURE_STATUS.LIVE,
          featureNote: item.featureNote || "",
        });
      }
    }
  }

  return rows;
}

function summarizeRows(rows) {
  const summary = { live: 0, partial: 0, planned: 0, totalLeaves: rows.length };
  for (const row of rows) {
    if (row.featureStatus === FEATURE_STATUS.LIVE) summary.live += 1;
    else if (row.featureStatus === FEATURE_STATUS.PARTIAL) summary.partial += 1;
    else if (row.featureStatus === FEATURE_STATUS.PLANNED) summary.planned += 1;
  }
  summary.coveragePercent =
    summary.totalLeaves > 0
      ? Math.round(((summary.live + summary.partial * 0.5) / summary.totalLeaves) * 100)
      : 0;
  return summary;
}

/** Audit sidebar + in-page nav (spec đầy đủ sau refactor 2 cấp). */
export function auditFullMenuCoverage(groups = MENU_GROUPS) {
  const sidebar = auditMenuFeatureCoverage(groups);
  const inPageRows = flattenInPageNav([
    ...Object.values(TOURNAMENT_IN_PAGE_NAV),
    REPORTS_IN_PAGE_NAV,
    AI_IN_PAGE_NAV,
    SUPPORT_IN_PAGE_NAV,
  ]);
  const rows = [...sidebar.rows, ...inPageRows];
  const summary = summarizeRows(rows);

  return {
    rows,
    summary,
    sidebar,
    inPageRows,
    plannedItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.PLANNED),
    partialItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.PARTIAL),
    liveItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.LIVE),
  };
}
