/** Trạng thái hiển thị menu — mirror navigationConfig (tránh circular import). */
const NAV_ITEM_STATUS = Object.freeze({
  COMING_SOON: "coming-soon",
});

function buildComingSoonPath(moduleKey) {
  const key = String(moduleKey || "module").trim() || "module";
  return `/coming-soon/${encodeURIComponent(key)}`;
}
export const FEATURE_STATUS = Object.freeze({
  LIVE: "live",
  PARTIAL: "partial",
  PLANNED: "planned",
});

/**
 * Sidebar: nhãn nhóm + mục lá phẳng (không folder lồng).
 * @see docs/v5/V5_SIDEBAR_NAV_IMPLEMENTATION.md
 */
export const SIDEBAR_MAX_FOLDER_DEPTH = 0;

function badgeForStatus(featureStatus) {
  if (featureStatus === FEATURE_STATUS.PLANNED) {
    return { navStatus: NAV_ITEM_STATUS.COMING_SOON, badge: "Sắp ra mắt" };
  }
  if (featureStatus === FEATURE_STATUS.PARTIAL) {
    return { badge: "Một phần" };
  }
  return {};
}

/**
 * Mục menu lá — có path (thật hoặc coming-soon).
 * @param {object} config
 */
export function menuLeaf({
  key,
  text,
  icon,
  path,
  match,
  permissions,
  featureStatus = FEATURE_STATUS.LIVE,
  featureNote = "",
  excludeRoles,
  roles,
  requiresFeature,
  resolvePath,
}) {
  const planned = featureStatus === FEATURE_STATUS.PLANNED;
  return {
    key,
    text,
    icon,
    path: planned ? buildComingSoonPath(key) : path,
    match,
    permissions,
    featureStatus,
    featureNote,
    excludeRoles,
    roles,
    requiresFeature,
    resolvePath,
    ...badgeForStatus(featureStatus),
  };
}

/** Nhánh menu (folder) — không có path, chỉ children. */
export function menuFolder({ key, text, icon, children, permissions }) {
  return {
    key,
    text,
    icon,
    children,
    permissions,
  };
}
