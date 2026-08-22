/**
 * Authenticated Web App — Layer 0 design tokens (Wave 2 Batch 2B).
 * Single source of truth for workspace foundations. Adapt in place — do not fork.
 *
 * Owner locks (2B):
 * - PRIMARY = #3B82F6 (Figure 1 blue) — actions / selected / links / active / focus
 * - SUCCESS = #10B981 (emerald) — success / healthy / complete (NOT primary)
 * - Font = Inter for authenticated workspace
 * - Do NOT promote Tournament #2563EB or Public lime #C5E831 as global primary
 *
 * Figure 1 shell tokens remain in figure1Tokens.js (FROZEN overlay).
 * Wave 1 breakpoints are referenced here but not redefined.
 */

import {
  FIGURE1_BREAKPOINTS,
  FIGURE1_LAYOUT,
  FIGURE1_PALETTE,
} from "./figure1Tokens.js";

/** Current authenticated workspace direction (Wave 2B). */
export const DESIGN_DIRECTION = "authenticated-workspace-v2";

/**
 * @deprecated Wave 2B — previous Direction C name. Kept for docs / string search compat.
 * Do not use as the active design direction.
 */
export const LEGACY_DESIGN_DIRECTION = "slate-enterprise";

// ---------------------------------------------------------------------------
// Color — semantic roles (authenticated workspace)
// ---------------------------------------------------------------------------

export const COLOR = Object.freeze({
  primary: {
    main: "#3B82F6",
    light: "#60A5FA",
    dark: "#2563EB",
    contrastText: "#FFFFFF",
    surface: "#EFF6FF",
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
    contrastText: "#FFFFFF",
  },
  warning: {
    main: "#D97706",
    light: "#FEF3C7",
    dark: "#B45309",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#DC2626",
    light: "#FEE2E2",
    dark: "#B91C1C",
    contrastText: "#FFFFFF",
  },
  info: {
    main: "#3B82F6",
    light: "#DBEAFE",
    dark: "#1D4ED8",
    contrastText: "#FFFFFF",
  },
  neutral: {
    main: "#64748B",
    light: "#F1F5F9",
    dark: "#334155",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#F8FAFC",
    paper: "#FFFFFF",
  },
  surface: {
    default: "#FFFFFF",
    elevated: "#FFFFFF",
    muted: "#F8FAFC",
    /** Subtle zebra / table even-row */
    subtle: "#FAFBFC",
  },
  border: {
    default: "#E2E8F0",
    strong: "#CBD5E1",
  },
  text: {
    primary: "#0F172A",
    secondary: "#64748B",
    disabled: "#94A3B8",
    inverse: "#FFFFFF",
  },
  disabled: {
    bg: "#F1F5F9",
    border: "#E2E8F0",
    text: "#94A3B8",
  },
  focus: {
    ring: "#3B82F6",
    ringOffset: "#FFFFFF",
  },
  selected: {
    bg: "rgba(59, 130, 246, 0.12)",
    hover: "rgba(59, 130, 246, 0.18)",
    border: "#93C5FD",
  },
  hover: {
    primary: "rgba(59, 130, 246, 0.08)",
    neutral: "rgba(15, 23, 42, 0.04)",
  },
});

/**
 * MUI-shaped palette (backward compatible export name).
 * primary ≠ success (Owner color lock).
 */
export const PALETTE = Object.freeze({
  primary: {
    main: COLOR.primary.main,
    light: COLOR.primary.light,
    dark: COLOR.primary.dark,
    contrastText: COLOR.primary.contrastText,
  },
  secondary: {
    main: COLOR.secondary.main,
    light: COLOR.secondary.light,
    dark: COLOR.secondary.dark,
    contrastText: COLOR.secondary.contrastText,
  },
  success: {
    main: COLOR.success.main,
    light: COLOR.success.light,
    dark: COLOR.success.dark,
    contrastText: COLOR.success.contrastText,
  },
  warning: {
    main: COLOR.warning.main,
    light: COLOR.warning.light,
    dark: COLOR.warning.dark,
  },
  error: {
    main: COLOR.error.main,
    light: COLOR.error.light,
    dark: COLOR.error.dark,
  },
  info: {
    main: COLOR.info.main,
    light: COLOR.info.light,
    dark: COLOR.info.dark,
    contrastText: COLOR.info.contrastText,
  },
  background: {
    default: COLOR.background.default,
    paper: COLOR.background.paper,
  },
  text: {
    primary: COLOR.text.primary,
    secondary: COLOR.text.secondary,
    disabled: COLOR.text.disabled,
  },
  divider: COLOR.border.default,
  action: {
    hover: COLOR.hover.neutral,
    selected: COLOR.selected.bg,
    disabled: COLOR.disabled.text,
    disabledBackground: COLOR.disabled.bg,
    focus: COLOR.focus.ring,
  },
});

/**
 * Legacy shell chrome tokens (MainLayout flag OFF path).
 * Accent aligned to workspace primary blue so legacy chrome does not fight Figure 1.
 * primaryGreen kept as SUCCESS emerald alias — do not treat as MUI primary.
 */
export const SHELL = Object.freeze({
  sidebarBg: "#0F172A",
  sidebarBgHover: "#1E293B",
  sidebarBorder: "rgba(255,255,255,0.06)",
  sidebarText: "rgba(255,255,255,0.92)",
  sidebarTextMuted: "rgba(255,255,255,0.5)",
  sidebarAccent: COLOR.primary.main,
  sidebarSelectedBg: COLOR.selected.bg,
  sidebarSelectedHover: COLOR.selected.hover,
  sidebarAccentBar: COLOR.primary.main,
  /** Hub / presentation accent — PUBLIC_SHARED lime; do not use as auth primary */
  accentLime: "#84CC16",
  /**
   * @deprecated Wave 2B — name retained for SHELL_COLORS.primaryGreen consumers.
   * Value is SUCCESS emerald, not MUI primary.
   */
  primaryGreen: COLOR.success.main,
  /**
   * Legacy mint wash (Direction C). Kept for compatibility with KPI/chip consumers
   * that treated accentLight as success-tinted surface — not selection.
   * Prefer COLOR.primary.surface for primary/selected washes.
   */
  accentLight: "#ECFDF5",
  /** Success wash — success / healthy semantics */
  successLight: COLOR.success.light,
  /** Primary / selected wash (Figure 1 blue family) */
  primarySurface: COLOR.primary.surface,
  pageBg: COLOR.background.default,
  cardBg: COLOR.background.paper,
  border: COLOR.border.default,
  textPrimary: COLOR.text.primary,
  textSecondary: COLOR.text.secondary,
  headerShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  cardShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  cardShadowHover: "0 8px 24px rgba(15, 23, 42, 0.08)",
});

// ---------------------------------------------------------------------------
// Typography — Inter is canonical for authenticated workspace
// ---------------------------------------------------------------------------

export const TYPOGRAPHY = Object.freeze({
  fontFamily: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
  /** Public isolation stack — PublicLayout may pin this; not auth canonical */
  publicFontFamily: '"DM Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  fontWeightExtraBold: 800,
  pageTitle: { size: 24, weight: 700, lineHeight: 1.2 },
  sectionTitle: { size: 16, weight: 600, lineHeight: 1.3 },
  body: { size: 14, weight: 400, lineHeight: 1.5 },
  caption: { size: 12, weight: 400, lineHeight: 1.4 },
  label: { size: 13, weight: 500, lineHeight: 1.35 },
  button: { size: 14, weight: 600, lineHeight: 1.25 },
  tableHeader: { size: 12, weight: 700, lineHeight: 1.3 },
  tableBody: { size: 14, weight: 400, lineHeight: 1.4 },
});

// ---------------------------------------------------------------------------
// Spacing — MUI 8px grid remains the only spacing system
// ---------------------------------------------------------------------------

export const SPACING = Object.freeze({
  /** MUI theme.spacing unit (px). Do not introduce a second scale. */
  unit: 8,
});

export const LAYOUT = Object.freeze({
  sidebarWidth: 240,
  topbarHeight: 64,
  contextBarHeight: 40,
  contentPadding: 24,
  contentPaddingMobile: 16,
  dashboardGridSpacing: 20,
  cardPadding: 20,
  sectionGap: 16,
});

// ---------------------------------------------------------------------------
// Radius — semantic scale (not a single magic number)
// ---------------------------------------------------------------------------

export const RADIUS = Object.freeze({
  small: 8,
  medium: 10,
  large: 12,
  pill: 999,
});

/**
 * Legacy SHAPE aliases → RADIUS scale.
 * borderRadius = medium (controls); borderRadiusLg = large (cards, Figure 1 aligned).
 */
export const SHAPE = Object.freeze({
  borderRadius: RADIUS.medium,
  borderRadiusLg: RADIUS.large,
  borderRadiusSm: RADIUS.small,
  borderRadiusPill: RADIUS.pill,
});

// ---------------------------------------------------------------------------
// Elevation / shadows
// ---------------------------------------------------------------------------

export const ELEVATION = Object.freeze({
  flat: "none",
  raised: SHELL.cardShadow,
  raisedHover: SHELL.cardShadowHover,
  overlay: "0 8px 24px rgba(15, 23, 42, 0.12)",
  header: SHELL.headerShadow,
});

// ---------------------------------------------------------------------------
// Interaction — focus + touch (new primitives; shell sizes frozen separately)
// ---------------------------------------------------------------------------

export const INTERACTION = Object.freeze({
  focusRing: COLOR.focus.ring,
  focusRingWidth: 2,
  focusRingOffset: 2,
  /** Canonical minimum for NEW / tapped shared primitives (Wave 2+) */
  touchTargetMin: 44,
  /**
   * Frozen Wave 1 shell exception — do not resize CanonicalSidebar to force 44
   * without Owner GO + Wave 1 regression evidence.
   * @see FIGURE1_LAYOUT.sidebarItemHeight (40), legacy sidebarNavTokens (34)
   */
  frozenShellItemHeight: FIGURE1_LAYOUT.sidebarItemHeight,
  frozenShellTouchTargetMin: FIGURE1_LAYOUT.touchTargetMin,
});

// ---------------------------------------------------------------------------
// Breakpoints / z-index — Wave 1 freeze references (do not redefine values)
// ---------------------------------------------------------------------------

export const BREAKPOINTS = Object.freeze({
  mobileMax: FIGURE1_BREAKPOINTS.mobileMax,
  tabletMin: FIGURE1_BREAKPOINTS.tabletMin,
  tabletMax: FIGURE1_BREAKPOINTS.tabletMax,
  desktopMin: FIGURE1_BREAKPOINTS.desktopMin,
});

export const Z_INDEX = Object.freeze({
  sidebar: FIGURE1_LAYOUT.zIndexSidebar,
  /** Align with MUI modal default band; shell stays below modals */
  modal: 1300,
  tooltip: 1500,
});

/**
 * Explicit non-promotions — locked so tests / docs can assert isolation.
 * Tournament #2563EB and Public #C5E831 must NOT become workspace primary.
 */
export const COLOR_BOUNDARY = Object.freeze({
  authWorkspacePrimary: COLOR.primary.main,
  authSuccess: COLOR.success.main,
  tournamentPrimaryNotGlobal: "#2563EB",
  publicLimeNotGlobal: "#C5E831",
  figure1ShellAccent: FIGURE1_PALETTE.sidebarAccent,
});
