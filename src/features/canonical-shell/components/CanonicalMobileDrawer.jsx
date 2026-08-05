import { useMemo, useState } from "react";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useLocation, useNavigate } from "react-router-dom";

import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { renderNavIcon } from "../utils/resolveNavIcon.jsx";
import { isCanonicalRouteActive } from "../services/matchCanonicalRoute.js";

/**
 * Mobile/tablet drawer with Level-1 → Level-2 → Level-3 drill-down + back.
 */
export default function CanonicalMobileDrawer({ menuGroups = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { palette, layout, mobileDrawerOpen, closeMobileDrawer, isMobile } = useCanonicalShell();
  const [stack, setStack] = useState([]);

  const currentPath = `${location.pathname}${location.search}`;
  // Mobile uses drawer drill-down; tablet/desktop use persistent/collapsible sidebar.
  const showDrawerShell = isMobile;

  const currentNodes = useMemo(() => {
    if (stack.length === 0) return menuGroups;
    return stack[stack.length - 1].children || [];
  }, [menuGroups, stack]);

  const title = stack.length === 0 ? "Menu" : stack[stack.length - 1].label;

  if (!showDrawerShell) return null;

  const handleClose = () => {
    setStack([]);
    closeMobileDrawer();
  };

  const handleBack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  const handleNode = (node) => {
    if (node.children?.length) {
      setStack((prev) => [...prev, node]);
      return;
    }
    if (node.route) {
      navigate(node.route.replace(/:tournamentId/g, "active").replace(/:[^/]+/g, "active"));
      handleClose();
    }
  };

  return (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={handleClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: layout.mobileDrawerWidth,
          maxWidth: "100vw",
          bgcolor: palette.sidebarBg,
          color: palette.sidebarText,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          minHeight: layout.topbarHeight,
          borderBottom: `1px solid ${palette.sidebarBorder}`,
        }}
      >
        {stack.length > 0 ? (
          <IconButton
            aria-label="Quay lại"
            onClick={handleBack}
            sx={{
              color: palette.sidebarText,
              minWidth: layout.touchTargetMin,
              minHeight: layout.touchTargetMin,
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        ) : (
          <IconButton
            aria-label="Đóng menu"
            onClick={handleClose}
            sx={{
              color: palette.sidebarText,
              minWidth: layout.touchTargetMin,
              minHeight: layout.touchTargetMin,
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
        <Typography fontWeight={700} sx={{ flex: 1 }} noWrap>
          {title}
        </Typography>
      </Box>

      <List
        component="nav"
        aria-label="Điều hướng mobile"
        sx={{ flex: 1, overflowY: "auto", py: 1 }}
      >
        {currentNodes.map((node) => {
          const active = isCanonicalRouteActive(currentPath, node);
          const hasChildren = Boolean(node.children?.length);
          return (
            <ListItemButton
              key={node.id}
              onClick={() => handleNode(node)}
              selected={active}
              aria-current={active ? "page" : undefined}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1.5,
                minHeight: layout.touchTargetMin,
                color: palette.sidebarText,
                "&.Mui-selected": {
                  bgcolor: palette.sidebarActive,
                  color: "#FFFFFF",
                },
                "&:hover": { bgcolor: palette.sidebarBgHover },
                "&:focus-visible": {
                  outline: `2px solid ${palette.focusRing}`,
                  outlineOffset: 2,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                {renderNavIcon(node.icon, {
                  sx: { fontSize: layout.iconSizeLg },
                  "aria-hidden": true,
                })}
              </ListItemIcon>
              <ListItemText
                primary={node.label}
                primaryTypographyProps={{ fontWeight: active ? 600 : 500, fontSize: 14 }}
              />
              {hasChildren ? <ChevronRightIcon fontSize="small" /> : null}
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}
