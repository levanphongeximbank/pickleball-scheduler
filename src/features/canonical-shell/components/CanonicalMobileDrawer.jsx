import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { renderNavIcon } from "../utils/resolveNavIcon.jsx";
import { isCanonicalRouteActive } from "../services/matchCanonicalRoute.js";
import {
  resolveCanonicalRouteHref,
  resolveCanonicalRouteHub,
  assertNoActivePlaceholder,
} from "../services/resolveCanonicalRouteParams.js";
import CanonicalMobileDrawerContext from "./CanonicalMobileDrawerContext.jsx";

/**
 * Mobile drawer with Level-1 → Level-2 → Level-3 drill-down + focus restore.
 */
export default function CanonicalMobileDrawer({ menuGroups = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const {
    palette,
    layout,
    mobileDrawerOpen,
    closeMobileDrawer,
    isMobile,
    menuTriggerRef,
  } = useCanonicalShell();
  const [stack, setStack] = useState([]);
  const closeButtonRef = useRef(null);
  const panelRef = useRef(null);

  const currentPath = `${location.pathname}${location.search}`;
  const showDrawerShell = isMobile;

  const currentNodes = useMemo(() => {
    if (stack.length === 0) return menuGroups;
    return stack[stack.length - 1].children || [];
  }, [menuGroups, stack]);

  const title = stack.length === 0 ? "Điều hướng" : stack[stack.length - 1].label;

  const restoreTriggerFocus = useCallback(() => {
    const trigger = menuTriggerRef?.current;
    if (trigger && typeof trigger.focus === "function") {
      window.setTimeout(() => trigger.focus(), 0);
    }
  }, [menuTriggerRef]);

  const handleClose = useCallback(() => {
    setStack([]);
    closeMobileDrawer();
    restoreTriggerFocus();
  }, [closeMobileDrawer, restoreTriggerFocus]);

  useEffect(() => {
    if (!mobileDrawerOpen || !showDrawerShell) return undefined;
    const id = window.setTimeout(() => {
      closeButtonRef.current?.focus?.();
    }, 0);
    return () => window.clearTimeout(id);
  }, [mobileDrawerOpen, showDrawerShell]);

  // If viewport leaves mobile while drawer is open, close safely.
  useEffect(() => {
    if (showDrawerShell) return undefined;
    if (!mobileDrawerOpen) return undefined;
    setStack([]);
    closeMobileDrawer();
    restoreTriggerFocus();
    return undefined;
  }, [showDrawerShell, mobileDrawerOpen, closeMobileDrawer, restoreTriggerFocus]);

  if (!showDrawerShell) return null;

  const handleBack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  const handleNode = (node) => {
    if (node.children?.length) {
      setStack((prev) => [...prev, node]);
      return;
    }
    if (!node.route) return;

    const resolved = resolveCanonicalRouteHref(node.route, {
      pathname: location.pathname,
      params,
    });
    const href =
      resolved.href ||
      resolveCanonicalRouteHub(node.route) ||
      (node.route.includes(":") ? null : node.route);

    if (!href || !assertNoActivePlaceholder(href)) {
      return;
    }
    navigate(href);
    handleClose();
  };

  return (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={handleClose}
      ModalProps={{
        keepMounted: true,
        // MUI Modal provides Escape-to-close + focus trap by default.
      }}
      SlideProps={{
        onExited: restoreTriggerFocus,
      }}
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
        ref={panelRef}
        tabIndex={-1}
        data-testid="canonical-mobile-drawer-panel"
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          outline: "none",
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
              ref={closeButtonRef}
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
              ref={closeButtonRef}
              aria-label="Đóng menu"
              onClick={handleClose}
              data-testid="canonical-mobile-drawer-close"
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

        {stack.length === 0 ? <CanonicalMobileDrawerContext /> : null}

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
      </Box>
    </Drawer>
  );
}
