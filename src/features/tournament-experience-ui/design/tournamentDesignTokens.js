/**
 * Isolated Tournament Experience design tokens.
 * Does NOT mutate the global PICK_VN Slate Enterprise theme.
 *
 * PRIMARY_BLUE derived from Owner mockups (~#1A56DB CTA) aligned to
 * existing PICK_VN brand-adjacent blue already in-repo (#2563EB / #3B82F6).
 * One hue family only — do not add unrelated blues.
 */

export const TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE =
  "/ux-prototype/tournament-experience";

export const TOURNAMENT_COLOR = Object.freeze({
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#3B82F6",
  primaryContrast: "#FFFFFF",
  primarySurface: "#EFF6FF",
  primarySelected: "rgba(37, 99, 235, 0.14)",

  success: "#059669",
  successSurface: "#D1FAE5",
  warning: "#D97706",
  warningSurface: "#FEF3C7",
  danger: "#DC2626",
  dangerSurface: "#FEE2E2",
  live: "#DC2626",
  liveSurface: "#FEE2E2",
  purple: "#7C3AED",
  purpleSurface: "#EDE9FE",
  orange: "#EA580C",
  orangeSurface: "#FFEDD5",

  navy: "#0F1B2D",
  navyHover: "#162236",
  navyText: "#E8EDF4",
  navyTextMuted: "#8B9CB3",

  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  railBg: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  divider: "#E2E8F0",
  disabled: "#94A3B8",
  draft: "#94A3B8",
  focus: "#2563EB",
  hover: "rgba(15, 23, 42, 0.04)",

  drawBg: "#0B1015",
  drawSurface: "#141B24",
});

export const TOURNAMENT_SPACE = Object.freeze({
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pagePadDesktop: 16,
  pagePadTablet: 12,
  pagePadMobile: 12,
  cardPad: 12,
  cardGap: 12,
  sectionGap: 16,
  railGap: 10,
  railWidth: 300,
  tableRow: 40,
  formRowGap: 12,
});

export const TOURNAMENT_RADIUS = Object.freeze({
  control: 10,
  card: 12,
  pill: 999,
});

export const TOURNAMENT_ELEVATION = Object.freeze({
  none: "none",
  card: "0 1px 3px rgba(15, 27, 45, 0.08)",
  cardHover: "0 8px 24px rgba(15, 27, 45, 0.10)",
  header: "0 1px 3px rgba(15, 23, 42, 0.06)",
});

export const TOURNAMENT_TYPE = Object.freeze({
  fontFamily: '"DM Sans", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  pageTitle: { size: 22, weight: 800, lineHeight: 1.2 },
  pageSubtitle: { size: 13, weight: 400, lineHeight: 1.4 },
  tournamentTitle: { size: 28, weight: 800, lineHeight: 1.12 },
  eventTitle: { size: 14, weight: 700, lineHeight: 1.3 },
  sectionTitle: { size: 14, weight: 700, lineHeight: 1.3 },
  cardTitle: { size: 14, weight: 700, lineHeight: 1.3 },
  kpiValue: { size: 22, weight: 800, lineHeight: 1.05 },
  kpiLabel: { size: 11, weight: 600, lineHeight: 1.25 },
  tableHeader: { size: 12, weight: 600, lineHeight: 1.4 },
  tableBody: { size: 13, weight: 500, lineHeight: 1.4 },
  bodyPrimary: { size: 14, weight: 400, lineHeight: 1.5 },
  bodySecondary: { size: 13, weight: 400, lineHeight: 1.5 },
  statusLabel: { size: 12, weight: 600, lineHeight: 1.2 },
  helperText: { size: 12, weight: 400, lineHeight: 1.4 },
  buttonLabel: { size: 14, weight: 600, lineHeight: 1.2 },
});

export const TOURNAMENT_LAYOUT = Object.freeze({
  sidebarWidth: 236,
  headerHeight: 52,
  contentMax: 1920,
  breakpoints: {
    mobile360: 360,
    mobile390: 390,
    mobile430: 430,
    tablet768: 768,
    tablet1024: 1024,
    desktop1440: 1440,
    desktop1920: 1920,
  },
});

export const TOURNAMENT_STATUS = Object.freeze({
  success: { id: "success", color: TOURNAMENT_COLOR.success, surface: TOURNAMENT_COLOR.successSurface, label: "Hoàn thành" },
  live: { id: "live", color: TOURNAMENT_COLOR.live, surface: TOURNAMENT_COLOR.liveSurface, label: "ĐANG THI ĐẤU" },
  warning: { id: "warning", color: TOURNAMENT_COLOR.warning, surface: TOURNAMENT_COLOR.warningSurface, label: "Cần xử lý" },
  danger: { id: "danger", color: TOURNAMENT_COLOR.danger, surface: TOURNAMENT_COLOR.dangerSurface, label: "Lỗi" },
  info: { id: "info", color: TOURNAMENT_COLOR.primary, surface: TOURNAMENT_COLOR.primarySurface, label: "Thông tin" },
  draft: { id: "draft", color: TOURNAMENT_COLOR.draft, surface: "#F1F5F9", label: "Nháp" },
});

export const TOURNAMENT_ACTION = Object.freeze({
  SAVE: "secondary",
  LOCK: "lock",
  PUBLISH: "primary",
  COMPLETE: "complete",
  DELETE: "destructive",
});
