import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation } from "react-router-dom";

import { MENU_GROUPS, MOBILE_DRAWER_WIDTH } from "../../../config/navigationConfig.js";
import { getNavIcon } from "../../../config/navIcons.js";
import { filterMenuGroups, resolveRouteAccessScope } from "../../../auth/menuAccess.js";
import { filterMobileQuickLinks } from "../services/mobileNavAccess.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import NavMenuList from "../../../components/nav/NavMenuList.jsx";
import { APP_VERSION_LABEL } from "../../../config/appVersion.js";

export default function MobileDrawer({ open, onClose }) {
  const location = useLocation();
  const auth = useAuth();
  const { activeClubId, activeClub } = useClub();

  const scope = resolveRouteAccessScope({
    user: auth.user,
    activeClubId,
    activeClub,
  });

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
          Menu V5
        </Typography>
        <IconButton onClick={onClose} edge="end" aria-label="Đóng menu">
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ px: 1, py: 1, overflowY: "auto" }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, mb: 0.75, display: "block" }}>
          Chuyển nhanh giữa các nhóm nghiệp vụ.
        </Typography>

        <NavMenuList
          groups={visibleGroups}
          user={auth.user}
          currentPath={location.pathname}
          onItemClick={onClose}
          compact
        />

        <Divider sx={{ my: 1 }} />
        <Typography
          variant="caption"
          fontWeight={800}
          sx={{ px: 1.5, py: 0.5, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}
        >
          Nhanh
        </Typography>
        <List dense disablePadding>
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
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 2, px: 1 }}
        >
          {APP_VERSION_LABEL}
        </Typography>
      </Box>
    </Drawer>
  );
}
