import { useMemo, useState, useCallback, useRef } from "react";
import { useMediaQuery, useTheme } from "@mui/material";

import { FIGURE1_BREAKPOINTS, FIGURE1_LAYOUT, FIGURE1_PALETTE, FIGURE1_TOKENS } from "../../../theme/figure1Tokens.js";
import { CanonicalShellContext } from "./canonicalShellContext.js";

export default function CanonicalShellProvider({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("md", "lg"));
  /**
   * Batch 1D — sidebar collapse:
   * - null = viewport default (tablet → rail; desktop → expanded)
   * - boolean = session user override (no new persistence key)
   */
  const [sidebarCollapsedOverride, setSidebarCollapsedOverride] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedLevel1, setExpandedLevel1] = useState(() => new Set());
  const [expandedLevel2, setExpandedLevel2] = useState(() => new Set());
  const menuTriggerRef = useRef(null);

  const viewportDefaultCollapsed = Boolean(isTablet) && !isMobile;
  const sidebarCollapsed = isMobile
    ? false
    : sidebarCollapsedOverride === null
      ? viewportDefaultCollapsed
      : sidebarCollapsedOverride;

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedOverride((prev) => {
      const current = prev === null ? viewportDefaultCollapsed : prev;
      return !current;
    });
  }, [viewportDefaultCollapsed]);

  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  const toggleLevel1 = useCallback((id) => {
    setExpandedLevel1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLevel2 = useCallback((id) => {
    setExpandedLevel2((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      tokens: FIGURE1_TOKENS,
      palette: FIGURE1_PALETTE,
      layout: FIGURE1_LAYOUT,
      breakpoints: FIGURE1_BREAKPOINTS,
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileDrawerOpen,
      openMobileDrawer,
      closeMobileDrawer,
      menuTriggerRef,
      expandedLevel1,
      expandedLevel2,
      toggleLevel1,
      toggleLevel2,
      setExpandedLevel1,
      setExpandedLevel2,
    }),
    [
      isMobile,
      isTablet,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileDrawerOpen,
      openMobileDrawer,
      closeMobileDrawer,
      expandedLevel1,
      expandedLevel2,
      toggleLevel1,
      toggleLevel2,
    ]
  );

  return <CanonicalShellContext.Provider value={value}>{children}</CanonicalShellContext.Provider>;
}
