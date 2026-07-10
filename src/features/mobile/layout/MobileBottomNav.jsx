import { useMemo } from "react";

import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";

import { Link, useLocation } from "react-router-dom";

import { useIsMobile } from "../hooks/useIsMobile.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { filterMobileBottomNav } from "../services/mobileNavAccess.js";
import { resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { useMobileNav } from "../context/mobileNavContext.js";
import { isNavItemActive } from "../../../components/nav/navPathMatchers.js";

function isNavActive(currentPath, item) {
  if (item.action) {
    return false;
  }

  const path = item.path;
  if (!path) return false;

  return isNavItemActive(currentPath, item, path);
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
        bgcolor: "background.paper",
        boxShadow: "0 -2px 12px rgba(15, 23, 42, 0.06)",
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
          const active = isNavActive(location.pathname, item);

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
              aria-current={active ? "page" : undefined}
              sx={{
                minWidth: 0,
                px: 0.5,
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                  "& .MuiBottomNavigationAction-label": {
                    fontSize: 10.5,
                    fontWeight: 700,
                  },
                },
                "& .MuiBottomNavigationAction-label": { fontSize: 10.5, fontWeight: 600 },
              }}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
