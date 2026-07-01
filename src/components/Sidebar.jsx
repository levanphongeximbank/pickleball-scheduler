import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupsIcon from "@mui/icons-material/Groups";
import StadiumIcon from "@mui/icons-material/Stadium";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import GridViewIcon from "@mui/icons-material/GridView";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PersonIcon from "@mui/icons-material/Person";
import { SIDEBAR_MENU_GROUPS } from "../config/sidebarMenu.js";
import { filterMenuGroups, resolveMenuItemPath } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";

const drawerWidth = 228;

const ICONS = {
  dashboard: <DashboardIcon fontSize="small" />,
  "daily-play": <SportsTennisIcon fontSize="small" />,
  "live-courts": <StadiumIcon fontSize="small" />,
  players: <PeopleIcon fontSize="small" />,
  seasons: <CalendarMonthIcon fontSize="small" />,
  "tournament-create": <GridViewIcon fontSize="small" />,
  bracket: <AccountTreeIcon fontSize="small" />,
  statistics: <LeaderboardIcon fontSize="small" />,
  "player-profile": <PersonIcon fontSize="small" />,
  "club-settings": <GroupsIcon fontSize="small" />,
  settings: <SettingsIcon fontSize="small" />,
};

function isActivePath(currentPath, item) {
  const itemPath = resolveMenuItemPath(item) || item.path;

  if (item.match === "exact" || itemPath === "/") {
    return currentPath === "/";
  }

  if (item.match === "live-courts") {
    return (
      currentPath === "/court-management" ||
      (currentPath.startsWith("/court-management/") &&
        !currentPath.startsWith("/court-management/courts"))
    );
  }

  if (item.match === "club-settings") {
    return currentPath === "/club" || currentPath.startsWith("/club/");
  }

  if (item.match === "seasons-only") {
    return currentPath === "/club";
  }

  if (item.match === "bracket") {
    return currentPath.includes("/bracket");
  }

  if (item.match === "tournament-home") {
    return currentPath === "/tournament";
  }

  if (item.match === "daily-play") {
    return (
      currentPath === "/daily-play" || currentPath.startsWith("/tournament/daily/")
    );
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

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

  const visibleGroups = filterMenuGroups(SIDEBAR_MENU_GROUPS, auth, scope);

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

      <Box sx={{ px: 1, pb: 2 }}>
        <List dense disablePadding>
          {visibleGroups.map((group, groupIndex) => (
            <Box key={group.label || `group-${groupIndex}`} sx={{ mb: 0.5 }}>
              {group.label && (
                <ListSubheader
                  component="div"
                  sx={{
                    lineHeight: "32px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "text.secondary",
                    bgcolor: "transparent",
                    px: 1.5,
                    py: 0.5,
                  }}
                >
                  {group.label}
                </ListSubheader>
              )}

              {group.items.map((item) => {
                const path = resolveMenuItemPath(item, auth.user);
                const selected = isActivePath(location.pathname, { ...item, path });

                return (
                  <ListItemButton
                    component={Link}
                    to={path}
                    key={item.key || `${group.label}-${item.text}`}
                    selected={selected}
                    sx={{
                      borderRadius: 1.5,
                      mx: 0.5,
                      mb: 0.25,
                      py: 0.75,
                      "&.Mui-selected": {
                        bgcolor: "rgba(15, 118, 110, 0.12)",
                        color: "#0f766e",
                        fontWeight: 800,
                        "&:hover": { bgcolor: "rgba(15, 118, 110, 0.18)" },
                        "& .MuiListItemIcon-root": { color: "#0f766e" },
                      },
                      "&:hover": { bgcolor: "rgba(15, 23, 42, 0.04)" },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 36,
                        color: selected ? "#0f766e" : "text.secondary",
                      }}
                    >
                      {ICONS[item.key] || <DashboardIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: 13.5,
                        fontWeight: selected ? 800 : 600,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                );
              })}

              {groupIndex < visibleGroups.length - 1 && (
                <Divider sx={{ my: 1, mx: 1.5, borderColor: "rgba(15,23,42,0.06)" }} />
              )}
            </Box>
          ))}
        </List>

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 2, px: 1 }}
        >
          AI Director Platform
        </Typography>
      </Box>
    </Drawer>
  );
}
