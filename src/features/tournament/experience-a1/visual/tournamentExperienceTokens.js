/**
 * Tournament Experience visual tokens (PR #450 language).
 * Isolated from the global PICK_VN Slate theme. Do not mutate sidebar tokens.
 */
export const TOURNAMENT_COLOR = Object.freeze({
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#3B82F6",
  primaryContrast: "#FFFFFF",
  primarySurface: "#EFF6FF",
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
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  divider: "#E2E8F0",
  disabled: "#94A3B8",
  draft: "#94A3B8",
});

export const TOURNAMENT_SPACE = Object.freeze({
  cardPad: 12,
  cardGap: 12,
  sectionGap: 16,
  railWidth: 300,
});

export const TOURNAMENT_RADIUS = Object.freeze({
  control: 10,
  card: 12,
  pill: 999,
});

export const TOURNAMENT_ELEVATION = Object.freeze({
  card: "0 1px 3px rgba(15, 27, 45, 0.08)",
  cardHover: "0 8px 24px rgba(15, 27, 45, 0.10)",
  header: "0 1px 3px rgba(15, 23, 42, 0.06)",
});

export const TOURNAMENT_TYPE = Object.freeze({
  pageTitle: { size: 22, weight: 800, lineHeight: 1.2 },
  pageSubtitle: { size: 13, weight: 400, lineHeight: 1.4 },
  tournamentTitle: { size: 28, weight: 800, lineHeight: 1.12 },
  kpiValue: { size: 22, weight: 800, lineHeight: 1.05 },
  kpiLabel: { size: 11, weight: 600, lineHeight: 1.25 },
  sectionTitle: { size: 14, weight: 700, lineHeight: 1.3 },
});

export const TYPE_BANNER = Object.freeze({
  official_tournament: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.primary} 100%)`,
  internal_tournament: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.purple} 100%)`,
  team_tournament: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.orange} 100%)`,
  daily_play: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.success} 100%)`,
});

export const primaryActionSx = {
  bgcolor: TOURNAMENT_COLOR.primary,
  color: TOURNAMENT_COLOR.primaryContrast,
  fontWeight: 700,
  boxShadow: "none",
  "&:hover": { bgcolor: TOURNAMENT_COLOR.primaryDark, boxShadow: "none" },
};

export const outlinedActionSx = {
  borderColor: TOURNAMENT_COLOR.divider,
  color: TOURNAMENT_COLOR.text,
  fontWeight: 700,
  bgcolor: TOURNAMENT_COLOR.cardBg,
};
