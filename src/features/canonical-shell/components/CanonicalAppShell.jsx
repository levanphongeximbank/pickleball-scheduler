import { useMemo } from "react";
import Box from "@mui/material/Box";
import { Outlet } from "react-router-dom";

import CanonicalSidebar from "./CanonicalSidebar.jsx";
import CanonicalTopBar from "./CanonicalTopBar.jsx";
import CanonicalMobileDrawer from "./CanonicalMobileDrawer.jsx";
import CanonicalShellProvider from "../context/CanonicalShellProvider.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { filterCanonicalMenu } from "../services/filterCanonicalMenu.js";
import { FIGURE1_CSS_VARS } from "../../../theme/figure1Tokens.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import RouteAccessGate from "../../../components/auth/RouteAccessGate.jsx";
import TenantGate from "../../../components/TenantGate.jsx";
import SubscriptionBanner from "../../../components/SubscriptionBanner.jsx";
import OperationalRouteGate from "../../billing/components/OperationalRouteGate.jsx";
import OfflineBanner from "../../mobile/components/OfflineBanner.jsx";
import PwaInstallPrompt from "../../mobile/components/PwaInstallPrompt.jsx";
import MobileBottomNav from "../../mobile/layout/MobileBottomNav.jsx";
import { MobileNavProvider } from "../../mobile/context/MobileNavProvider.jsx";

function CanonicalAppShellInner() {
  const auth = useAuth();
  const { palette, layout, isMobile, isTablet, openMobileDrawer, sidebarCollapsed } = useCanonicalShell();

  const viewport = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
  const menuGroups = useMemo(
    () => filterCanonicalMenu(auth, { viewport }),
    [auth, viewport]
  );

  const contentOffset = !isMobile
    ? sidebarCollapsed
      ? layout.sidebarWidthCollapsed
      : layout.sidebarWidthExpanded
    : 0;

  return (
    <MobileNavProvider openDrawer={openMobileDrawer}>
        <Box
        data-testid="canonical-app-shell"
        data-canonical-shell="figure1"
        style={FIGURE1_CSS_VARS}
        sx={{
          display: "flex",
          minHeight: "100dvh",
          bgcolor: palette.workspaceSurface,
        }}
      >
        <CanonicalSidebar menuGroups={menuGroups} />
        <CanonicalMobileDrawer menuGroups={menuGroups} />

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: "100dvh",
            width: { md: `calc(100% - ${contentOffset}px)` },
          }}
        >
          <CanonicalTopBar menuTree={menuGroups} />

          <Box
            component="main"
            id="canonical-main"
            sx={{
              flexGrow: 1,
              p: {
                xs: `${layout.contentPaddingMobile / 16}rem`,
                md: `${layout.contentPaddingDesktop / 16}rem`,
              },
              pb: { xs: 9, md: `${layout.contentPaddingDesktop / 16}rem` },
              minWidth: 0,
              maxWidth: layout.contentMaxWidth,
              width: "100%",
              mx: "auto",
              bgcolor: palette.workspaceSurface,
            }}
          >
            <RouteAccessGate>
              <TenantGate>
                <OfflineBanner />
                <PwaInstallPrompt />
                <SubscriptionBanner />
                <OperationalRouteGate>
                  <Outlet />
                </OperationalRouteGate>
              </TenantGate>
            </RouteAccessGate>
          </Box>

          {isMobile && <MobileBottomNav />}
        </Box>
      </Box>
    </MobileNavProvider>
  );
}

/**
 * Figure 1 Canonical App Shell — activated only when VITE_CANONICAL_APP_SHELL_ENABLED=true.
 * Legacy MainLayout shell remains the default rollback path.
 */
export default function CanonicalAppShell() {
  return (
    <CanonicalShellProvider>
      <CanonicalAppShellInner />
    </CanonicalShellProvider>
  );
}
