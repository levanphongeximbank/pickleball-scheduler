/** Kích thước dashboard — khớp mockup Slate Enterprise (Direction C). */
export const DASHBOARD_LAYOUT = Object.freeze({
  gridSpacing: 2.5,
  sectionGap: 2.5,
  cardRadius: 1.5,
  cardPadding: 2.5,
  chartHeight: 300,
  analyticsMinHeight: 360,
  kpiIconSize: 36,
});

export const dashboardCardSx = {
  borderRadius: DASHBOARD_LAYOUT.cardRadius,
  height: "100%",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

export const dashboardCardContentSx = {
  p: DASHBOARD_LAYOUT.cardPadding,
  "&:last-child": { pb: DASHBOARD_LAYOUT.cardPadding },
};

export const dashboardSectionTitleSx = {
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.3,
};
