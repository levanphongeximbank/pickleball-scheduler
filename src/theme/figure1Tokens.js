/**
 * Figure 1 design tokens — Canonical Navigation Phase 2 (FROZEN shell overlay).
 * Integrates with authenticated workspace theme via theme.canonicalNav / theme.figure1.
 * Wave 2B workspace primary aligns to Figure 1 blue (#3B82F6); this file remains the
 * shell-only token SSOT and must not be redesigned in Wave 2.
 */

export const FIGURE1_DESIGN_DIRECTION = "figure1-canonical-shell";

export const FIGURE1_PALETTE = Object.freeze({
  sidebarBg: "#0F1B2D",
  sidebarBgHover: "#162236",
  sidebarActive: "#1E3A5F",
  sidebarText: "#E8EDF4",
  sidebarTextMuted: "#8B9CB3",
  sidebarAccent: "#3B82F6",
  sidebarDisabled: "#4B5563",
  sidebarBorder: "rgba(255,255,255,0.06)",
  workspaceBg: "#FFFFFF",
  workspaceSurface: "#F8FAFC",
  topbarBg: "#FFFFFF",
  topbarBorder: "#E2E8F0",
  cardBg: "#FFFFFF",
  cardBorder: "#E2E8F0",
  cardShadow: "0 1px 3px rgba(15,27,45,0.08)",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  badgePartial: "#F59E0B",
  badgeSoon: "#6B7280",
  badgeLive: "#10B981",
  focusRing: "#3B82F6",
});

export const FIGURE1_LAYOUT = Object.freeze({
  sidebarWidthExpanded: 260,
  sidebarWidthCollapsed: 64,
  mobileDrawerWidth: 280,
  topbarHeight: 56,
  contentMaxWidth: 1440,
  contentPaddingDesktop: 24,
  contentPaddingMobile: 16,
  cardGap: 16,
  cardRadius: 12,
  cardPadding: 20,
  sidebarItemHeight: 40,
  iconSize: 20,
  iconSizeLg: 24,
  touchTargetMin: 44,
  zIndexSidebar: 1200,
});

export const FIGURE1_TYPOGRAPHY = Object.freeze({
  fontFamily: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
  groupLabelSize: 11,
  groupLabelWeight: 600,
  itemSize: 14,
  itemWeight: 500,
  itemActiveWeight: 600,
  topbarTitleSize: 16,
  topbarTitleWeight: 600,
  pageHeadingSize: 24,
  pageHeadingWeight: 700,
  breadcrumbSize: 13,
  breadcrumbWeight: 400,
});

export const FIGURE1_BREAKPOINTS = Object.freeze({
  mobileMax: 899,
  tabletMin: 900,
  tabletMax: 1199,
  desktopMin: 1200,
});

export const FIGURE1_ELEVATION = Object.freeze({
  none: "none",
  card: FIGURE1_PALETTE.cardShadow,
  cardHover: "0 8px 24px rgba(15,27,45,0.10)",
  topbar: "none",
});

export const FIGURE1_CSS_VARS = Object.freeze({
  "--nav-sidebar-bg": FIGURE1_PALETTE.sidebarBg,
  "--nav-sidebar-bg-hover": FIGURE1_PALETTE.sidebarBgHover,
  "--nav-sidebar-active": FIGURE1_PALETTE.sidebarActive,
  "--nav-sidebar-text": FIGURE1_PALETTE.sidebarText,
  "--nav-sidebar-text-muted": FIGURE1_PALETTE.sidebarTextMuted,
  "--nav-sidebar-accent": FIGURE1_PALETTE.sidebarAccent,
  "--nav-workspace-bg": FIGURE1_PALETTE.workspaceBg,
  "--nav-workspace-surface": FIGURE1_PALETTE.workspaceSurface,
  "--nav-topbar-bg": FIGURE1_PALETTE.topbarBg,
  "--nav-topbar-border": FIGURE1_PALETTE.topbarBorder,
  "--nav-card-bg": FIGURE1_PALETTE.cardBg,
  "--nav-card-border": FIGURE1_PALETTE.cardBorder,
  "--nav-card-shadow": FIGURE1_PALETTE.cardShadow,
  "--nav-badge-partial": FIGURE1_PALETTE.badgePartial,
  "--nav-badge-soon": FIGURE1_PALETTE.badgeSoon,
  "--nav-badge-live": FIGURE1_PALETTE.badgeLive,
  "--nav-sidebar-width": `${FIGURE1_LAYOUT.sidebarWidthExpanded}px`,
  "--nav-sidebar-width-collapsed": `${FIGURE1_LAYOUT.sidebarWidthCollapsed}px`,
  "--nav-topbar-height": `${FIGURE1_LAYOUT.topbarHeight}px`,
});

export const FIGURE1_TOKENS = Object.freeze({
  direction: FIGURE1_DESIGN_DIRECTION,
  palette: FIGURE1_PALETTE,
  layout: FIGURE1_LAYOUT,
  typography: FIGURE1_TYPOGRAPHY,
  breakpoints: FIGURE1_BREAKPOINTS,
  elevation: FIGURE1_ELEVATION,
  cssVars: FIGURE1_CSS_VARS,
});
