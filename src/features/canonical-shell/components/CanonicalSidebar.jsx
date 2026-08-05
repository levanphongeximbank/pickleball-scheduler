import { useMemo } from "react";
import { Box, Chip, Drawer, IconButton, Typography } from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useLocation } from "react-router-dom";

import CanonicalSidebarSection from "./CanonicalSidebarSection.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { APP_PRODUCT_NAME } from "../../../config/appVersion.js";
import { buildCanonicalMenuTree } from "../config/canonicalMenuRegistry.js";

/**
 * Dark navy Figure 1 sidebar — Level-1 domains + Level-2/3 modules.
 */
export default function CanonicalSidebar({ menuGroups = [] }) {
  const location = useLocation();
  const {
    palette,
    layout,
    isMobile,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useCanonicalShell();
  const registryTree = useMemo(() => buildCanonicalMenuTree(), []);

  if (isMobile) return null;

  const width = sidebarCollapsed ? layout.sidebarWidthCollapsed : layout.sidebarWidthExpanded;
  const currentPath = `${location.pathname}${location.search}`;

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          borderRight: `1px solid ${palette.sidebarBorder}`,
          bgcolor: palette.sidebarBg,
          color: palette.sidebarText,
          display: "flex",
          flexDirection: "column",
          zIndex: layout.zIndexSidebar,
          overflowX: "hidden",
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        },
      }}
    >
      <Box
        sx={{
          px: sidebarCollapsed ? 1 : 1.5,
          pt: 1.5,
          pb: 1,
          borderBottom: `1px solid ${palette.sidebarBorder}`,
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: layout.topbarHeight,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: palette.sidebarAccent,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <SportsTennisIcon sx={{ color: "#FFFFFF", fontSize: 17 }} aria-hidden />
        </Box>
        {!sidebarCollapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: palette.sidebarText, fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}
            >
              {APP_PRODUCT_NAME}
            </Typography>
            <Chip
              label="Figure 1"
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: "rgba(59,130,246,0.18)",
                color: palette.sidebarText,
              }}
            />
          </Box>
        )}
        <IconButton
          size="small"
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          aria-expanded={!sidebarCollapsed}
          sx={{
            color: palette.sidebarTextMuted,
            "&:focus-visible": { outline: `2px solid ${palette.focusRing}`, outlineOffset: 2 },
          }}
        >
          {sidebarCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Box
        component="nav"
        aria-label="Điều hướng chính"
        sx={{ flex: 1, minHeight: 0, py: 0.75, overflowY: "auto", overflowX: "hidden" }}
      >
        {menuGroups.map((group) => (
          <CanonicalSidebarSection
            key={group.id}
            group={group}
            currentPath={currentPath}
            collapsed={sidebarCollapsed}
            registryGroup={registryTree.find((g) => g.id === group.id) || group}
          />
        ))}
      </Box>
    </Drawer>
  );
}
