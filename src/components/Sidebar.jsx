import { Box, Chip, Drawer, Typography } from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { useLocation } from "react-router-dom";

import { MENU_GROUPS } from "../config/navigationConfig.js";
import { filterMenuGroups } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClubMenuScope } from "../features/club/navigation/useClubMenuScope.js";
import NavMenuShell from "./nav/NavMenuShell.jsx";
import SidebarFooter from "./shell/SidebarFooter.jsx";
import { APP_PRODUCT_NAME } from "../config/appVersion.js";
import { SHELL_COLORS, SHELL_LAYOUT } from "./shell/shellTokens.js";

export default function Sidebar() {
  const location = useLocation();
  const auth = useAuth();
  const scope = useClubMenuScope();
  const isMobile = useIsMobile();

  if (isMobile) {
    return null;
  }

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
          px: 1.25,
          pt: 1.5,
          pb: 1.1,
          borderBottom: `1px solid ${SHELL_COLORS.sidebarBorder}`,
          flexShrink: 0,
        }}
      >
        <StackBrand />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, py: 0.5, overflowY: "auto" }}>
        <NavMenuShell
          groups={visibleGroups}
          user={auth.user}
          currentPath={`${location.pathname}${location.search}`}
          variant="dark"
        />
      </Box>

      <SidebarFooter />
    </Drawer>
  );
}

function StackBrand() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          bgcolor: SHELL_COLORS.sidebarAccent,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <SportsTennisIcon sx={{ color: "#FFFFFF", fontSize: 17 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: SHELL_COLORS.sidebarText,
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: 11.5,
            }}
          >
            {APP_PRODUCT_NAME}
          </Typography>
          <Chip
            label="V5.0"
            size="small"
            sx={{
              height: 16,
              fontSize: 9,
              fontWeight: 700,
              bgcolor: "rgba(16, 185, 129, 0.2)",
              color: SHELL_COLORS.sidebarAccent,
              border: `1px solid rgba(16, 185, 129, 0.35)`,
              "& .MuiChip-label": { px: 0.5 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
