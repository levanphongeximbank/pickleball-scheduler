import { Box, Drawer, Typography } from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { useLocation } from "react-router-dom";

import { MENU_GROUPS } from "../config/navigationConfig.js";
import { filterMenuGroups, resolveRouteAccessScope } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import NavMenuList from "./nav/NavMenuList.jsx";
import SidebarSubscriptionCard from "./shell/SidebarSubscriptionCard.jsx";
import { APP_PRODUCT_NAME, APP_VERSION_LABEL } from "../config/appVersion.js";
import { SHELL_COLORS, SHELL_LAYOUT } from "./shell/shellTokens.js";

export default function Sidebar() {
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const isMobile = useIsMobile();

  if (isMobile) {
    return null;
  }

  const scope = resolveRouteAccessScope({
    user: auth.user,
    activeClubId,
    activeClub,
  });

  const visibleGroups = filterMenuGroups(MENU_GROUPS, auth, scope);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SHELL_LAYOUT.sidebarWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: SHELL_LAYOUT.sidebarWidth,
          boxSizing: "border-box",
          borderRight: `1px solid ${SHELL_COLORS.sidebarBorder}`,
          bgcolor: SHELL_COLORS.sidebarBg,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 2.5,
          pb: 2,
          borderBottom: `1px solid ${SHELL_COLORS.sidebarBorder}`,
          flexShrink: 0,
        }}
      >
        <StackBrand />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, px: 1, py: 1.5, overflowY: "auto" }}>
        <NavMenuList
          groups={visibleGroups}
          user={auth.user}
          currentPath={location.pathname}
          variant="dark"
        />
      </Box>

      <SidebarSubscriptionCard />
    </Drawer>
  );
}

function StackBrand() {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.12)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <SportsTennisIcon sx={{ color: "#6EE7B7", fontSize: 22 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: SHELL_COLORS.sidebarText,
              fontWeight: 900,
              lineHeight: 1.2,
              fontSize: 13,
            }}
          >
            {APP_PRODUCT_NAME}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: SHELL_COLORS.sidebarTextMuted, fontWeight: 700, letterSpacing: 0.4 }}
          >
            {APP_VERSION_LABEL.replace(" Preview", "")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
