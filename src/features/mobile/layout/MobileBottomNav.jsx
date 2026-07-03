import { useMemo } from "react";

import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";

import { Link, useLocation } from "react-router-dom";

import { useIsMobile } from "../hooks/useIsMobile.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { filterMobileBottomNav } from "../services/mobileNavAccess.js";
import { resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { useMobileNav } from "../context/mobileNavContext.js";

function isNavActive(currentPath, item) {
  if (item.action) {
    return false;
  }

  const path = item.path;
  if (!path) return false;

  if (item.match === "exact" || path === "/") {
    return currentPath === "/";
  }

  if (item.match === "tournament-home") {
    return currentPath === "/tournament" || currentPath.startsWith("/tournament/");
  }

  if (item.match === "referee-hub") {
    return currentPath === "/referee" || currentPath.startsWith("/referee/");
  }

  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export default function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();
  const { openDrawer } = useMobileNav();

  const scope = useMemo(
    () =>
      resolveRouteAccessScope({
        user: auth.user,
        activeClubId,
        activeClub,
      }),
    [auth.user, activeClubId, activeClub]
  );

  const navItems = useMemo(
    () => filterMobileBottomNav(auth, scope),
    [auth, scope]
  );

  if (!isMobile) {
    return null;
  }

  const activeIndex = navItems.findIndex((item) => isNavActive(location.pathname, item));

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 2,
        borderTop: "1px solid",
        borderColor: "divider",
        pb: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <BottomNavigation
        value={activeIndex >= 0 ? activeIndex : false}
        showLabels
        sx={{ minHeight: 64 }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.action === "open-drawer") {
            return (
              <BottomNavigationAction
                key={item.key}
                label={item.label}
                icon={<Icon />}
                onClick={openDrawer}
                sx={{
                  minWidth: 0,
                  px: 0.5,
                  color: "text.secondary",
                  "& .MuiBottomNavigationAction-label": { fontSize: 10.5, fontWeight: 700 },
                }}
              />
            );
          }

          return (
            <BottomNavigationAction
              key={item.key}
              component={Link}
              to={item.path}
              label={item.label}
              icon={<Icon />}
              sx={{
                minWidth: 0,
                px: 0.5,
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                },
                "& .MuiBottomNavigationAction-label": { fontSize: 10.5, fontWeight: 700 },
              }}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
