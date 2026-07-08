import { useState } from "react";
import Box from "@mui/material/Box";
import { Outlet } from "react-router-dom";

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
import OfflineBanner from "../features/mobile/components/OfflineBanner.jsx";
import PwaInstallPrompt from "../features/mobile/components/PwaInstallPrompt.jsx";
import MobileBottomNav from "../features/mobile/layout/MobileBottomNav.jsx";
import MobileDrawer from "../features/mobile/layout/MobileDrawer.jsx";
import { MobileNavProvider } from "../features/mobile/context/MobileNavProvider.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import { SHELL_COLORS } from "../components/shell/shellTokens.js";

function MainLayoutContent() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <MobileNavProvider openDrawer={() => setDrawerOpen(true)}>
      <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: SHELL_COLORS.pageBg }}>
        {!isMobile && <Sidebar />}

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: "100dvh",
          }}
        >
          <Header onMenuClick={() => setDrawerOpen(true)} />
          {isMobile && <AppContextBar />}
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: { xs: 1.5, sm: 2, md: "24px" },
              pb: { xs: 9, md: "24px" },
              minWidth: 0,
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

export default function MainLayout() {
  return (
    <TenantProvider>
      <ClusterProvider>
        <ClubProvider>
          <SeasonProvider>
            <MainLayoutContent />
          </SeasonProvider>
        </ClubProvider>
      </ClusterProvider>
    </TenantProvider>
  );
}
