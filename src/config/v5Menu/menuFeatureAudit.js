import { FEATURE_STATUS } from "./menuBuilders.js";

/**
 * Duyệt cây menu và thu thập audit theo featureStatus.
 * @param {object[]} groups — MENU_GROUPS
 */
export function auditMenuFeatureCoverage(groups) {
  const rows = [];
  const summary = {
    live: 0,
    partial: 0,
    planned: 0,
    folder: 0,
    totalLeaves: 0,
  };

  function walk(groupLabel, items, pathLabels = []) {
    for (const item of items || []) {
      const trail = [...pathLabels, item.text].filter(Boolean);
      if (item.children?.length) {
        summary.folder += 1;
        walk(groupLabel, item.children, trail);
        continue;
      }

      const status = item.featureStatus || FEATURE_STATUS.LIVE;
      summary.totalLeaves += 1;
      if (status === FEATURE_STATUS.LIVE) summary.live += 1;
      else if (status === FEATURE_STATUS.PARTIAL) summary.partial += 1;
      else if (status === FEATURE_STATUS.PLANNED) summary.planned += 1;

      rows.push({
        group: groupLabel,
        trail: trail.join(" › "),
        key: item.key,
        text: item.text,
        path: item.path || "",
        featureStatus: status,
        featureNote: item.featureNote || "",
        navStatus: item.navStatus || "",
      });
    }
  }

  for (const group of groups || []) {
    walk(group.label || group.id, group.items);
  }

  const coveragePercent =
    summary.totalLeaves > 0
      ? Math.round(((summary.live + summary.partial * 0.5) / summary.totalLeaves) * 100)
      : 0;

  return {
    rows,
    summary: { ...summary, coveragePercent },
    plannedItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.PLANNED),
    partialItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.PARTIAL),
    liveItems: rows.filter((row) => row.featureStatus === FEATURE_STATUS.LIVE),
  };
}

export function formatMenuAuditReport(audit) {
  const lines = [
    `Tổng mục lá: ${audit.summary.totalLeaves}`,
    `Live: ${audit.summary.live} | Một phần: ${audit.summary.partial} | Chưa có: ${audit.summary.planned}`,
    `Độ phủ ước tính: ${audit.summary.coveragePercent}%`,
    "",
    "=== CHƯA CÓ TÍNH NĂNG (PLANNED) ===",
  ];

  for (const row of audit.plannedItems) {
    lines.push(`- [${row.group}] ${row.trail}${row.featureNote ? ` — ${row.featureNote}` : ""}`);
  }

  return lines.join("\n");
}
