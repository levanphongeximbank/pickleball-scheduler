import { MENU_GROUPS } from "../navigationConfig.js";
import { auditMenuFeatureCoverage } from "./menuFeatureAudit.js";
import { TOURNAMENT_IN_PAGE_NAV } from "./tournamentInPageNav.js";
import { REPORTS_IN_PAGE_NAV } from "./reportsInPageNav.js";
import { AI_IN_PAGE_NAV } from "./aiInPageNav.js";
import { SUPPORT_IN_PAGE_NAV } from "./supportInPageNav.js";
import { FEATURE_STATUS } from "./menuBuilders.js";
import {
  APPROVED_PARTIAL_MENU_PATHS,
  normalizeMenuPathSet,
} from "./approvedPartialMenuPaths.js";

export { APPROVED_PARTIAL_MENU_PATHS } from "./approvedPartialMenuPaths.js";

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

const RECOGNIZED_FEATURE_STATUSES = Object.freeze([
  FEATURE_STATUS.LIVE,
  FEATURE_STATUS.PARTIAL,
  FEATURE_STATUS.PLANNED,
]);

/**
 * Full-menu readiness gate (fail-closed).
 *
 * Separates:
 * - classificationCoveragePercent: every leaf has a recognized status (must be 100)
 * - liveReadinessPercent: LIVE-only share (must NOT be faked to 100 when PARTIAL exists)
 *
 * PARTIAL is allowed only for the exact approved CRM path set.
 *
 * @param {ReturnType<typeof auditFullMenuCoverage>} audit
 * @param {{ approvedPartialPaths?: readonly string[] }} [options]
 */
export function evaluateFullMenuReadinessGate(audit, options = {}) {
  const approvedPartialPaths = normalizeMenuPathSet(
    options.approvedPartialPaths || APPROVED_PARTIAL_MENU_PATHS
  );
  const errors = [];

  if (!audit || !Array.isArray(audit.rows) || !audit.summary) {
    return {
      ok: false,
      errors: ["audit payload is required"],
      approvedPartialPaths,
      actualPartialPaths: [],
      unexpectedPartialPaths: [],
      missingApprovedPartialPaths: [],
      classificationCoveragePercent: 0,
      liveReadinessPercent: 0,
      weightedCoveragePercent: 0,
    };
  }

  const unrecognized = audit.rows.filter(
    (row) => !RECOGNIZED_FEATURE_STATUSES.includes(row.featureStatus)
  );
  if (unrecognized.length > 0) {
    errors.push(
      `unrecognized featureStatus on ${unrecognized.length} leaf(ves): ${unrecognized
        .slice(0, 5)
        .map((row) => `${row.text || row.key}=${row.featureStatus}`)
        .join(", ")}`
    );
  }

  const counted =
    Number(audit.summary.live || 0) +
    Number(audit.summary.partial || 0) +
    Number(audit.summary.planned || 0);
  if (counted !== audit.summary.totalLeaves) {
    errors.push(
      `menu accounting incomplete: live+partial+planned=${counted} !== totalLeaves=${audit.summary.totalLeaves}`
    );
  }

  if (Number(audit.summary.planned) !== 0) {
    errors.push(
      `planned must be 0 (found ${audit.summary.planned}): ${audit.plannedItems
        .map((item) => item.path || item.text)
        .join(", ")}`
    );
  }

  const actualPartialPaths = normalizeMenuPathSet(
    (audit.partialItems || []).map((item) => item.path)
  );
  const unexpectedPartialPaths = actualPartialPaths.filter(
    (path) => !approvedPartialPaths.includes(path)
  );
  const missingApprovedPartialPaths = approvedPartialPaths.filter(
    (path) => !actualPartialPaths.includes(path)
  );

  if (unexpectedPartialPaths.length > 0) {
    errors.push(`unapproved PARTIAL paths: ${unexpectedPartialPaths.join(", ")}`);
  }
  if (missingApprovedPartialPaths.length > 0) {
    errors.push(
      `missing approved CRM PARTIAL paths: ${missingApprovedPartialPaths.join(", ")}`
    );
  }

  // Exact set equality (path-based; not a bare numeric count).
  if (
    unexpectedPartialPaths.length === 0 &&
    missingApprovedPartialPaths.length === 0 &&
    actualPartialPaths.length !== approvedPartialPaths.length
  ) {
    errors.push(
      `PARTIAL path set size mismatch: actual=${actualPartialPaths.length} approved=${approvedPartialPaths.length}`
    );
  }

  // Approved CRM PARTIAL routes must not be misclassified as the PARTIAL set
  // while still being absent from partialItems (already covered by missing).
  // Additionally: each approved path that appears in the audit must include at
  // least one PARTIAL leaf — if only LIVE leaves remain for an approved path,
  // the missing check already fails.

  const totalLeaves = Number(audit.summary.totalLeaves) || 0;
  const liveCount = Number(audit.summary.live) || 0;
  const classificationCoveragePercent =
    totalLeaves > 0 && unrecognized.length === 0 && counted === totalLeaves ? 100 : 0;
  const liveReadinessPercent =
    totalLeaves > 0 ? Math.round((liveCount / totalLeaves) * 100) : 0;
  const weightedCoveragePercent = Number(audit.summary.coveragePercent) || 0;

  // Do not require weighted LIVE-centric coveragePercent === 100 when PARTIAL exists.
  if (classificationCoveragePercent !== 100) {
    errors.push("classification coverage must be 100% (every leaf has a valid status)");
  }

  return {
    ok: errors.length === 0,
    errors,
    approvedPartialPaths,
    actualPartialPaths,
    unexpectedPartialPaths,
    missingApprovedPartialPaths,
    classificationCoveragePercent,
    liveReadinessPercent,
    weightedCoveragePercent,
  };
}
