import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  IconButton,
  Stack,
  Toolbar,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import CanonicalBreadcrumbs from "./CanonicalBreadcrumbs.jsx";
import CanonicalGlobalSearchTrigger from "./CanonicalGlobalSearchTrigger.jsx";
import CanonicalNotificationButton from "./CanonicalNotificationButton.jsx";
import CanonicalTenantSwitcher from "./CanonicalTenantSwitcher.jsx";
import CanonicalUserMenu from "./CanonicalUserMenu.jsx";
import { buildCanonicalBreadcrumbs } from "../services/buildCanonicalBreadcrumbs.js";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { useTenant } from "../../../context/TenantContext.jsx";

/**
 * Compact Figure 1 top navigation (56px).
 */
export default function CanonicalTopBar({ menuTree }) {
  const location = useLocation();
  const { palette, layout, isMobile, openMobileDrawer } = useCanonicalShell();
  const { isSuperAdmin } = useTenant();

  const breadcrumbs = useMemo(
    () => buildCanonicalBreadcrumbs(location.pathname, { tree: menuTree }),
    [location.pathname, menuTree]
  );

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: palette.topbarBg,
        color: palette.textPrimary,
        borderBottom: `1px solid ${palette.topbarBorder}`,
        boxShadow: "none",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: { xs: 1.5, md: 2.5 },
          gap: 1.5,
          minHeight: `${layout.topbarHeight}px !important`,
          height: layout.topbarHeight,
          overflow: "hidden",
        }}
      >
        {isMobile && (
          <IconButton
            edge="start"
            onClick={openMobileDrawer}
            aria-label="Mở menu điều hướng"
            sx={{
              color: "inherit",
              minWidth: layout.touchTargetMin,
              minHeight: layout.touchTargetMin,
              "&:focus-visible": {
                outline: `2px solid ${palette.focusRing}`,
                outlineOffset: 2,
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {!isMobile && (
          <Box sx={{ flexShrink: 1, minWidth: 0, maxWidth: 360 }}>
            <CanonicalBreadcrumbs items={breadcrumbs} />
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ flex: 1, minWidth: 0, justifyContent: "center" }}
        >
          {!isMobile && isSuperAdmin ? <CanonicalTenantSwitcher /> : null}
          <CanonicalGlobalSearchTrigger />
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <CanonicalNotificationButton />
          <CanonicalUserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
