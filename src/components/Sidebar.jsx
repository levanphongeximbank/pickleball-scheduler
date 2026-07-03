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

import { MENU_GROUPS } from "../config/navigationConfig.js";
import { getNavIcon } from "../config/navIcons.js";
import { filterMenuGroups, resolveMenuItemPath } from "../auth/menuAccess.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";

const drawerWidth = 248;

function stripQuery(path = "") {
  return String(path).split("?")[0];
}

function isActivePath(currentPath, item) {
  const itemPath = stripQuery(resolveMenuItemPath(item) || item.path);

  if (item.match === "exact" || itemPath === "/") {
    return currentPath === "/";
  }

  if (item.match === "live-courts") {
    return (
      currentPath === "/court-management" ||
      (currentPath.startsWith("/court-management/") &&
        !currentPath.startsWith("/court-management/courts") &&
        !currentPath.startsWith("/court-management/calendar") &&
        !currentPath.startsWith("/court-management/bookings") &&
        !currentPath.startsWith("/court-management/revenue") &&
        !currentPath.startsWith("/court-management/customers"))
    );
  }

  if (item.match === "court-calendar") {
    return currentPath.startsWith("/court-management/calendar");
  }

  if (item.match === "court-bookings") {
    return currentPath.startsWith("/court-management/bookings");
  }

  if (item.match === "court-revenue" || item.match === "court-revenue-debt" || item.match === "court-revenue-peak") {
    return currentPath.startsWith("/court-management/revenue");
  }

  if (item.match === "court-customers" || item.match === "court-customers-groups") {
    return currentPath.startsWith("/court-management/customers");
  }

  if (item.match === "court-courts") {
    return currentPath.startsWith("/court-management/courts");
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

  if (item.match === "tournament-create" || item.match === "tournament-register") {
    return currentPath === "/tournament";
  }

  if (item.match === "tournament-schedule" || item.match === "court-engine") {
    return currentPath.startsWith("/court-engine");
  }

  if (item.match === "daily-play") {
    return (
      currentPath === "/daily-play" || currentPath.startsWith("/tournament/daily/")
    );
  }

  if (item.match === "clubs" || item.match === "clubs-create") {
    return currentPath === "/clubs" || currentPath.startsWith("/clubs/");
  }

  if (item.match === "club-members") {
    return currentPath === "/players" || currentPath.startsWith("/players/");
  }

  if (item.match === "statistics-skill" || item.match === "statistics-history") {
    return currentPath === "/statistics" || currentPath.startsWith("/statistics/");
  }

  if (item.match === "users-roles") {
    return currentPath === "/users";
  }

  if (item.match === "referee-hub") {
    return currentPath === "/referee" || currentPath.startsWith("/referee/");
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
        <List dense disablePadding>
          {visibleGroups.map((group, groupIndex) => (
            <Box key={group.id || group.label || `group-${groupIndex}`} sx={{ mb: 0.5 }}>
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
                      {getNavIcon(item.icon || item.key)}
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
          Pickleball Scheduler Pro v5
        </Typography>
      </Box>
    </Drawer>
  );
}
