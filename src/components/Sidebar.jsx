import { Box, Drawer, Toolbar, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

import { MENU_GROUPS } from "../config/navigationConfig.js";
import { filterMenuGroups } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import NavMenuList from "./nav/NavMenuList.jsx";

const drawerWidth = 260;

export default function Sidebar() {
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const isMobile = useIsMobile();

  if (isMobile) {
    return null;
  }

  const scope = {
    clubId: activeClubId,
    venueId: activeClub?.venueId || auth.user?.venueId || null,
    playerId: auth.user?.playerId || null,
  };

  const visibleGroups = filterMenuGroups(MENU_GROUPS, auth, scope);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid rgba(15, 23, 42, 0.08)",
          bgcolor: "#fafbfc",
        },
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />

      <Box sx={{ px: 1, pb: 2, overflowY: "auto" }}>
        <NavMenuList
          groups={visibleGroups}
          user={auth.user}
          currentPath={location.pathname}
        />

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 2, px: 1 }}
        >
          Pickleball Scheduler Pro v5
        </Typography>
      </Box>
    </Drawer>
  );
}
