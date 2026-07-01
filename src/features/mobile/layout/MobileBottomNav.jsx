import { useMemo } from "react";

import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";

import { Link, useLocation } from "react-router-dom";



import { useIsMobile } from "../hooks/useIsMobile.js";

import { useAuth } from "../../../context/AuthContext.jsx";

import { useClub } from "../../../context/ClubContext.jsx";

import { filterMobileBottomNav } from "../services/mobileNavAccess.js";



function isNavActive(currentPath, item) {

  const path = item.path;

  if (item.match === "exact" || path === "/") {

    return currentPath === "/";

  }

  if (item.match === "tournament-home") {

    return currentPath === "/tournament" || currentPath.startsWith("/tournament/");

  }

  return currentPath === path || currentPath.startsWith(`${path}/`);

}



export default function MobileBottomNav() {

  const isMobile = useIsMobile();

  const location = useLocation();

  const auth = useAuth();

  const { activeClubId, activeClub } = useClub();



  const scope = {

    clubId: activeClubId,

    venueId: activeClub?.venueId || auth.user?.venueId || null,

    tenantId: activeClub?.tenantId || activeClub?.venueId || auth.user?.tenantId || null,

    playerId: auth.user?.playerId || null,

  };



  const navItems = useMemo(

    () => filterMobileBottomNav(auth, scope),

    [auth, scope.clubId, scope.venueId, scope.tenantId, scope.playerId]

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

