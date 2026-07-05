/** V5.0 — Slate Enterprise design tokens (Direction C). Single source of truth. */
export const DESIGN_DIRECTION = "slate-enterprise";

export const PALETTE = Object.freeze({
  primary: {
    main: "#10B981",
    light: "#34D399",
    dark: "#059669",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#64748B",
    light: "#94A3B8",
    dark: "#475569",
    contrastText: "#FFFFFF",
  },
  success: {
    main: "#10B981",
    light: "#D1FAE5",
    dark: "#059669",
  },
  warning: {
    main: "#D97706",
    light: "#FEF3C7",
  },
  error: {
    main: "#DC2626",
    light: "#FEE2E2",
  },
  background: {
    default: "#F1F5F9",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#0F172A",
    secondary: "#64748B",
  },
  divider: "#E2E8F0",
});

export const SHELL = Object.freeze({
  sidebarBg: "#0F172A",
  sidebarBgHover: "#1E293B",
  sidebarBorder: "rgba(255,255,255,0.06)",
  sidebarText: "rgba(255,255,255,0.92)",
  sidebarTextMuted: "rgba(255,255,255,0.5)",
  sidebarAccent: "#10B981",
  sidebarSelectedBg: "rgba(16, 185, 129, 0.12)",
  sidebarSelectedHover: "rgba(16, 185, 129, 0.18)",
  sidebarAccentBar: "#10B981",
  primaryGreen: PALETTE.primary.main,
  accentLight: "#ECFDF5",
  pageBg: PALETTE.background.default,
  cardBg: PALETTE.background.paper,
  border: PALETTE.divider,
  textPrimary: PALETTE.text.primary,
  textSecondary: PALETTE.text.secondary,
  headerShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  cardShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  cardShadowHover: "0 8px 24px rgba(15, 23, 42, 0.08)",
});

export const LAYOUT = Object.freeze({
  sidebarWidth: 260,
  topbarHeight: 72,
  contextBarHeight: 40,
});

export const TYPOGRAPHY = Object.freeze({
  fontFamily: '"DM Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontWeightBold: 700,
  fontWeightExtraBold: 800,
});

export const SHAPE = Object.freeze({
  borderRadius: 10,
  borderRadiusLg: 12,
});
