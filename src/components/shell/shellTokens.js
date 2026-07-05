/** V5.0 SaaS shell — re-export from design tokens (backward compat). */
import { LAYOUT, SHELL } from "../../theme/designTokens.js";

export const SHELL_COLORS = Object.freeze({
  sidebarBg: SHELL.sidebarBg,
  sidebarBgHover: SHELL.sidebarBgHover,
  sidebarBorder: SHELL.sidebarBorder,
  sidebarText: SHELL.sidebarText,
  sidebarTextMuted: SHELL.sidebarTextMuted,
  sidebarAccent: SHELL.sidebarAccent,
  sidebarAccentBar: SHELL.sidebarAccentBar,
  sidebarSelectedBg: SHELL.sidebarSelectedBg,
  sidebarSelectedHover: SHELL.sidebarSelectedHover,
  primaryGreen: SHELL.primaryGreen,
  mintBg: SHELL.accentLight,
  pageBg: SHELL.pageBg,
  cardBg: SHELL.cardBg,
  border: SHELL.border,
  textPrimary: SHELL.textPrimary,
  textSecondary: SHELL.textSecondary,
});

export const SHELL_LAYOUT = Object.freeze({
  sidebarWidth: LAYOUT.sidebarWidth,
  topbarHeight: LAYOUT.topbarHeight,
  contextBarHeight: LAYOUT.contextBarHeight,
});
