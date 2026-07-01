import { useState } from "react";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import RouteAccessGate from "../components/auth/RouteAccessGate.jsx";
import TenantGate from "../components/TenantGate.jsx";
import SubscriptionBanner from "../components/SubscriptionBanner.jsx";
import SubscriptionGate from "../components/SubscriptionGate.jsx";
import { TenantProvider } from "../context/TenantContext.jsx";
import { ClubProvider } from "../context/ClubContext.jsx";
import { SeasonProvider } from "../context/SeasonContext.jsx";
import OfflineBanner from "../features/mobile/components/OfflineBanner.jsx";
import PwaInstallPrompt from "../features/mobile/components/PwaInstallPrompt.jsx";
import MobileBottomNav from "../features/mobile/layout/MobileBottomNav.jsx";
import MobileDrawer from "../features/mobile/layout/MobileDrawer.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";

function MainLayoutContent() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Header onMenuClick={() => setDrawerOpen(true)} />
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          pb: { xs: 9, md: 3 },
          minWidth: 0,
        }}
      >
        <Toolbar />
        <RouteAccessGate>
          <TenantGate>
            <OfflineBanner />
            <PwaInstallPrompt />
            <SubscriptionBanner />
            <SubscriptionGate>
              <Outlet />
            </SubscriptionGate>
          </TenantGate>
        </RouteAccessGate>
      </Box>

      {isMobile && <MobileBottomNav />}
    </Box>
  );
}

export default function MainLayout() {
  return (
    <TenantProvider>
      <ClubProvider>
        <SeasonProvider>
          <MainLayoutContent />
        </SeasonProvider>
      </ClubProvider>
    </TenantProvider>
  );
}
