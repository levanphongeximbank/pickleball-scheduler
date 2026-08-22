import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  AppBar,
  Box,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import CanonicalBreadcrumbs from "./CanonicalBreadcrumbs.jsx";
import CanonicalGlobalSearchTrigger from "./CanonicalGlobalSearchTrigger.jsx";
import CanonicalHelpButton from "./CanonicalHelpButton.jsx";
import CanonicalNotificationButton from "./CanonicalNotificationButton.jsx";
import CanonicalTenantSwitcher from "./CanonicalTenantSwitcher.jsx";
import CanonicalUserMenu from "./CanonicalUserMenu.jsx";
import ClubSwitcher from "../../../components/ClubSwitcher.jsx";
import VenueSwitcher from "../../../components/VenueSwitcher.jsx";
import { buildCanonicalBreadcrumbs } from "../services/buildCanonicalBreadcrumbs.js";
import { buildCanonicalMenuTree } from "../config/canonicalMenuRegistry.js";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { useTenant } from "../../../context/TenantContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  collapseCanonicalBreadcrumbItems,
  resolveCanonicalTopbarZoneStyles,
} from "../layout/canonicalTopbarLayout.js";
import { APP_PRODUCT_NAME } from "../../../config/appVersion.js";

/**
 * Compact Figure 1 top navigation (56px).
 * Wave 4: zone-based flex layout — breadcrumbs / organization / search / actions
 * never share unconstrained width (closes OBSERVATION_CANONICAL_TOPBAR_01).
 * Batch 1D: mobile relocates Tenant/Venue/Club into CanonicalMobileDrawer;
 * topbar keeps menu + compact title + search + notification/help/account.
 */
export default function CanonicalTopBar() {
  const location = useLocation();
  const params = useParams();
  const auth = useAuth();
  const { palette, layout, isMobile, isTablet, openMobileDrawer, menuTriggerRef } =
    useCanonicalShell();
  const { isSuperAdmin, currentTenantId } = useTenant();
  const { clubs, activeClubReady } = useClub();

  const viewport = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
  const zones = useMemo(() => resolveCanonicalTopbarZoneStyles(viewport), [viewport]);
  const showClubSwitcher =
    Boolean(currentTenantId) && (clubs.length > 1 || !activeClubReady || clubs.length === 1);

  const registryTree = useMemo(() => buildCanonicalMenuTree(), []);
  const breadcrumbs = useMemo(() => {
    const full = buildCanonicalBreadcrumbs(location.pathname, {
      tree: registryTree,
      auth,
      params,
    });
    return collapseCanonicalBreadcrumbItems(full, zones.breadcrumb.maxItems);
  }, [location.pathname, registryTree, auth, params, zones.breadcrumb.maxItems]);

  const mobileTitle =
    breadcrumbs[breadcrumbs.length - 1]?.label || APP_PRODUCT_NAME;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      data-testid="canonical-topbar"
      data-viewport={viewport}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: palette.topbarBg,
        color: palette.textPrimary,
        borderBottom: `1px solid ${palette.topbarBorder}`,
        boxShadow: "none",
      }}
    >
      <Toolbar
        disableGutters
        data-testid="canonical-topbar-toolbar"
        sx={{
          px: { xs: 1.5, md: 2, lg: 2.5 },
          gap: `${zones.toolbar.gap}px`,
          minHeight: `${layout.topbarHeight}px !important`,
          height: layout.topbarHeight,
          overflowX: zones.toolbar.overflowX,
          overflowY: "hidden",
          alignItems: "center",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {isMobile && (
          <IconButton
            ref={menuTriggerRef}
            edge="start"
            onClick={openMobileDrawer}
            aria-label="Mở menu điều hướng"
            data-testid="canonical-mobile-menu-trigger"
            sx={{
              color: "inherit",
              flexShrink: 0,
              minWidth: layout.touchTargetMin,
              minHeight: layout.touchTargetMin,
              "&:focus-visible": {
                outline: `2px solid ${palette.focusRing}`,
                outlineOffset: 2,
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {isMobile ? (
          <Typography
            data-testid="canonical-topbar-mobile-title"
            noWrap
            sx={{
              flex: "1 1 auto",
              minWidth: 0,
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.3,
            }}
          >
            {mobileTitle}
          </Typography>
        ) : null}

        {zones.context.visible && (
          <Box
            data-testid="canonical-topbar-context-zone"
            sx={{
              flex: zones.context.flex,
              minWidth: zones.context.minWidth,
              maxWidth: zones.context.maxWidth,
              overflow: "hidden",
            }}
          >
            <CanonicalBreadcrumbs items={breadcrumbs} />
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          data-testid="canonical-topbar-center-zone"
          sx={{
            flex: isMobile ? "0 1 auto" : "1 1 auto",
            minWidth: 0,
            justifyContent: isMobile ? "flex-end" : "center",
            overflow: "hidden",
            maxWidth: isMobile ? zones.search.maxWidth : "100%",
          }}
        >
          {/* Batch 1D: selectors stay on tablet/desktop topbar; mobile → drawer context. */}
          {!isMobile && zones.organization.visible && isSuperAdmin ? (
            <Box
              data-testid="canonical-topbar-organization-zone"
              sx={{
                flex: zones.organization.flex,
                minWidth: zones.organization.widthMin,
                maxWidth: zones.organization.maxWidth,
                width: "100%",
                overflow: "hidden",
              }}
            >
              <CanonicalTenantSwitcher
                minWidth={zones.organization.widthMin}
                maxWidth={zones.organization.maxWidth}
              />
            </Box>
          ) : null}
          {!isMobile ? (
            <Box
              data-testid="canonical-topbar-venue-zone"
              sx={{ flexShrink: 0, minWidth: isTablet ? 140 : 160, maxWidth: 220 }}
            >
              <VenueSwitcher variant="light" minWidth={isTablet ? 140 : 160} />
            </Box>
          ) : null}
          {!isMobile && showClubSwitcher ? (
            <Box
              data-testid="canonical-topbar-club-zone"
              sx={{ flexShrink: 0, minWidth: isTablet ? 140 : 160, maxWidth: 220 }}
            >
              <ClubSwitcher variant="light" minWidth={isTablet ? 140 : 160} />
            </Box>
          ) : null}
          <Box
            data-testid="canonical-topbar-search-zone"
            sx={{
              flex: zones.search.flex,
              minWidth: zones.search.minWidth,
              maxWidth: zones.search.maxWidth,
              width: isMobile ? "100%" : "100%",
              overflow: "hidden",
            }}
          >
            <CanonicalGlobalSearchTrigger maxWidth={zones.search.maxWidth} />
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          data-testid="canonical-topbar-actions-zone"
          sx={{ flexShrink: 0 }}
        >
          {/* Batch 1C composition: notification → help (/support) → account */}
          <CanonicalNotificationButton />
          <CanonicalHelpButton />
          <CanonicalUserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
