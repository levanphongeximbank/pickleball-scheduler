/** Menu sidebar compact — tỷ lệ nhỏ như mockup (~240px). */
export const SIDEBAR_NAV = Object.freeze({
  listPx: 0.75,
  itemPy: 0.45,
  itemMb: 0.15,
  itemPl: 1,
  itemPr: 0.85,
  itemRadius: 10,
  iconMinWidth: 28,
  iconSize: 17,
  fontSize: 12.5,
  fontSizeNested: 11.5,
  fontWeight: 500,
  fontWeightActive: 600,
  depthStep: 0.7,
  badgeHeight: 15,
  badgeFontSize: 9,
});

export function sidebarNavItemSx({ isDark, pl }) {
  return {
    borderRadius: SIDEBAR_NAV.itemRadius,
    mb: SIDEBAR_NAV.itemMb,
    py: SIDEBAR_NAV.itemPy,
    pl: pl ?? SIDEBAR_NAV.itemPl,
    pr: SIDEBAR_NAV.itemPr,
    minHeight: 34,
    color: isDark ? "rgba(255,255,255,0.72)" : "text.primary",
    "&.Mui-selected": {
      bgcolor: isDark ? "#10B981" : "rgba(16, 185, 129, 0.12)",
      color: isDark ? "#FFFFFF" : "#10B981",
      "&:hover": {
        bgcolor: isDark ? "#0D9668" : "rgba(16, 185, 129, 0.18)",
      },
      "& .MuiListItemIcon-root": {
        color: isDark ? "#FFFFFF" : "#10B981",
      },
    },
    "&:hover": {
      bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(15, 23, 42, 0.04)",
    },
  };
}

export function sidebarFolderActiveSx({ isDark, childActive, depth }) {
  if (!childActive || depth !== 0 || !isDark) return {};
  return {
    bgcolor: "#10B981",
    color: "#FFFFFF",
    "& .MuiListItemIcon-root": { color: "#FFFFFF" },
    "&:hover": { bgcolor: "#0D9668" },
  };
}
