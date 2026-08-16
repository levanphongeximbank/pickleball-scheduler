import { useState } from "react";
import Box from "@mui/material/Box";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import AppContextBar from "../components/shell/AppContextBar.jsx";
import RouteAccessGate from "../components/auth/RouteAccessGate.jsx";
import TenantGate from "../components/TenantGate.jsx";
import SubscriptionBanner from "../components/SubscriptionBanner.jsx";
import OperationalRouteGate from "../features/billing/components/OperationalRouteGate.jsx";
import { TenantProvider } from "../context/TenantContext.jsx";
import { ClusterProvider } from "../context/ClusterContext.jsx";
import { ClubProvider } from "../context/ClubContext.jsx";
import { SeasonProvider } from "../context/SeasonContext.jsx";
import { NotificationRuntimeProvider } from "../features/notifications/runtime/NotificationRuntimeProvider.jsx";
import { CommunicationRuntimeProvider } from "../features/communication/runtime/CommunicationRuntimeProvider.jsx";
import { FinanceStagingRuntimeProvider } from "../features/finance/runtime/FinanceStagingRuntimeProvider.jsx";
import OfflineBanner from "../features/mobile/components/OfflineBanner.jsx";
import PwaInstallPrompt from "../features/mobile/components/PwaInstallPrompt.jsx";
import MobileBottomNav from "../features/mobile/layout/MobileBottomNav.jsx";
import MobileDrawer from "../features/mobile/layout/MobileDrawer.jsx";
import { MobileNavProvider } from "../features/mobile/context/MobileNavProvider.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import { SHELL_COLORS } from "../components/shell/shellTokens.js";
import {
  CanonicalAppShell,
  isCanonicalAppShellEnabled,
} from "../features/canonical-shell/index.js";
import { isRefereeWorkspaceRoute } from "../features/referee-production-ui/application/isRefereeWorkspaceRoute.js";
import RefereeCompactChrome from "../features/referee-production-ui/components/RefereeCompactChrome.jsx";
import "../features/referee-production-ui/styles/referee-production.css";

function LegacyMainLayoutContent() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const refereeWorkspace = isRefereeWorkspaceRoute(location.pathname);
  const matchScreen = String(location.pathname || "").startsWith("/referee/match/");

  return (
    <MobileNavProvider openDrawer={() => setDrawerOpen(true)}>
      <Box
        data-testid="legacy-app-shell"
        data-referee-workspace={refereeWorkspace ? "true" : "false"}
        sx={{ display: "flex", minHeight: "100dvh", bgcolor: SHELL_COLORS.pageBg }}
      >
        {!isMobile && !refereeWorkspace && <Sidebar />}

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: "100dvh",
          }}
        >
          {refereeWorkspace && !matchScreen ? (
            <RefereeCompactChrome title="Trọng tài của tôi" showBack={false} />
          ) : !refereeWorkspace ? (
            <Header onMenuClick={() => setDrawerOpen(true)} />
          ) : null}
          {isMobile && !refereeWorkspace && <AppContextBar />}
          {isMobile && !refereeWorkspace ? (
            <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          ) : null}

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: refereeWorkspace ? { xs: 0, sm: 0, md: "16px" } : { xs: 1.5, sm: 2, md: "24px" },
              pb: {
                xs: refereeWorkspace ? 2 : 9,
                md: refereeWorkspace ? "16px" : "24px",
              },
              minWidth: 0,
            }}
          >
            <RouteAccessGate>
              <TenantGate>
                <OfflineBanner />
                {!refereeWorkspace && <PwaInstallPrompt />}
                {!refereeWorkspace && <SubscriptionBanner />}
                <OperationalRouteGate>
                  <Outlet />
                </OperationalRouteGate>
              </TenantGate>
            </RouteAccessGate>
          </Box>

          {isMobile && !refereeWorkspace && <MobileBottomNav />}
        </Box>
      </Box>
    </MobileNavProvider>
  );
}

function MainLayoutContent() {
  // Feature-flagged Figure 1 shell — default OFF preserves legacy rollback path.
  // Never render both shells simultaneously.
  if (isCanonicalAppShellEnabled()) {
    return <CanonicalAppShell />;
  }
  return <LegacyMainLayoutContent />;
}

export default function MainLayout() {
  return (
    <TenantProvider>
      <ClusterProvider>
        <ClubProvider>
          <SeasonProvider>
            <NotificationRuntimeProvider>
              <CommunicationRuntimeProvider>
                <FinanceStagingRuntimeProvider>
                  <MainLayoutContent />
                </FinanceStagingRuntimeProvider>
              </CommunicationRuntimeProvider>
            </NotificationRuntimeProvider>
          </SeasonProvider>
        </ClubProvider>
      </ClusterProvider>
    </TenantProvider>
  );
}
