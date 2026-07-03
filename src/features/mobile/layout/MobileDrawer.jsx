import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation } from "react-router-dom";

import { MENU_GROUPS, MOBILE_DRAWER_WIDTH } from "../../../config/navigationConfig.js";
import { getNavIcon } from "../../../config/navIcons.js";
import { filterMenuGroups, resolveMenuItemPath } from "../../../auth/menuAccess.js";
import { filterMobileQuickLinks } from "../services/mobileNavAccess.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";

function stripQuery(path = "") {
  return String(path).split("?")[0];
}

function isActivePath(currentPath, item, path) {
  const base = stripQuery(path);
  if (item.match === "exact" || base === "/") {
    return currentPath === "/";
  }
  return currentPath === base || currentPath.startsWith(`${base}/`);
}

export default function MobileDrawer({ open, onClose }) {
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();

  const scope = {
    clubId: activeClubId,
    venueId: activeClub?.venueId || auth.user?.venueId || null,
    playerId: auth.user?.playerId || null,
  };

  const visibleGroups = filterMenuGroups(MENU_GROUPS, auth, scope);
  const quickLinks = filterMobileQuickLinks(auth, scope);

  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: "block", md: "none" },
        "& .MuiDrawer-paper": {
          width: MOBILE_DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography fontWeight={900} fontSize={15}>
          Menu
        </Typography>
        <IconButton onClick={onClose} edge="end" aria-label="Đóng menu">
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ px: 1, py: 1, overflowY: "auto" }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, mb: 0.75, display: "block" }}>
          Chuyển nhanh giữa các mục chính của ứng dụng.
        </Typography>
        <List dense disablePadding>
          {visibleGroups.map((group, groupIndex) => (
            <Box key={group.id || group.label || `group-${groupIndex}`}>
              {group.label && (
                <ListSubheader
                  sx={{
                    lineHeight: "32px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    bgcolor: "transparent",
                  }}
                >
                  {group.label}
                </ListSubheader>
              )}
              {group.items.map((item) => {
                const path = resolveMenuItemPath(item, auth.user);
                const selected = isActivePath(location.pathname, item, path);
                return (
                  <ListItemButton
                    component={Link}
                    to={path}
                    key={item.key || item.text}
                    selected={selected}
                    onClick={onClose}
                    sx={{ borderRadius: 1.5, mx: 0.5, mb: 0.25, minHeight: 48 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getNavIcon(item.icon || item.key)}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 800 : 600 }}
                    />
                  </ListItemButton>
                );
              })}
              {groupIndex < visibleGroups.length - 1 && <Divider sx={{ my: 1 }} />}
            </Box>
          ))}
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" fontWeight={800} sx={{ px: 1.5, py: 0.5, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Nhanh
          </Typography>
          {quickLinks.map((item) => (
            <ListItemButton
              key={item.key}
              component={Link}
              to={item.path}
              onClick={onClose}
              sx={{ borderRadius: 1.5, mx: 0.5, minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {getNavIcon(item.iconKey)}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}
