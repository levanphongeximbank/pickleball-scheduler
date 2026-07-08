import { Link as RouterLink, useLocation } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { useState } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
import UserAvatar from "../identity/UserAvatar.jsx";
import {
  PUBLIC_COLORS,
  gradientTextSx,
  publicCtaButtonSx,
  publicGhostButtonSx,
} from "./publicPortalStyles.js";

const NAV_ITEMS = [
  { label: "Trang chủ", path: "/home", match: ["/home", "/"] },
  { label: "Giải đấu", path: "/tournaments" },
  { label: "CLB", path: "/clubs" },
  { label: "Sân", path: "/courts" },
  { label: "BXH", path: "/rankings" },
  { label: "Tin tức", path: "/news" },
];

function isNavActive(pathname, item) {
  if (item.match) return item.match.includes(pathname);
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function isHomeRoute(pathname) {
  return pathname === "/" || pathname === "/home";
}

export default function PublicHeader() {
  const location = useLocation();
  const { isAuthenticated, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const onHome = isHomeRoute(location.pathname);

  const handleLogout = async () => {
    setAnchorEl(null);
    await signOut?.();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: onHome ? "transparent" : alpha(PUBLIC_COLORS.bgDeep, 0.92),
        backdropFilter: onHome ? "none" : "blur(20px)",
        borderBottom: onHome ? "none" : `1px solid ${PUBLIC_COLORS.border}`,
        backgroundImage: "none",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: "none" }, color: PUBLIC_COLORS.text }}
            aria-label="Mở menu"
          >
            <MenuIcon />
          </IconButton>

          <Box
            component={RouterLink}
            to="/home"
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "inherit",
              mr: { md: 2 },
            }}
          >
            <SportsTennisIcon sx={{ color: PUBLIC_COLORS.lime, fontSize: 26 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} letterSpacing={1} sx={gradientTextSx}>
                PICK_VN
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: PUBLIC_COLORS.textMuted, display: { xs: "none", sm: "block" }, lineHeight: 1 }}
              >
                Pickleball for everyone
              </Typography>
            </Box>
          </Box>

          <Stack
            direction="row"
            spacing={0}
            sx={{ display: { xs: "none", lg: "flex" }, flex: 1, justifyContent: "center" }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(location.pathname, item);
              return (
                <Button
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  sx={{
                    color: active ? PUBLIC_COLORS.text : PUBLIC_COLORS.textMuted,
                    textTransform: "none",
                    fontWeight: active ? 600 : 400,
                    fontSize: "0.875rem",
                    px: 1.25,
                    minWidth: 0,
                    borderBottom: active ? `2px solid ${PUBLIC_COLORS.lime}` : "2px solid transparent",
                    borderRadius: 0,
                    "&:hover": { color: PUBLIC_COLORS.lime, bgcolor: "transparent" },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: "auto" }}>
            {isAuthenticated ? (
              <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ ...publicGhostButtonSx, minWidth: 0, px: 1 }}
              >
                <UserAvatar user={user} size={30} />
              </Button>
            ) : (
              <Button
                component={RouterLink}
                to="/login"
                sx={{ ...publicGhostButtonSx, display: { xs: "none", sm: "inline-flex" } }}
              >
                Đăng nhập
              </Button>
            )}
            <Button
              component={RouterLink}
              to={isAuthenticated ? "/tournament/create" : "/login"}
              sx={publicCtaButtonSx}
            >
              {isAuthenticated ? "Tạo giải" : "Đăng ký miễn phí"}
            </Button>
          </Stack>
        </Toolbar>
      </Container>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem component={RouterLink} to="/profile" onClick={() => setAnchorEl(null)}>
          Hồ sơ của tôi
        </MenuItem>
        <MenuItem component={RouterLink} to="/dashboard" onClick={() => setAnchorEl(null)}>
          Dashboard
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>Đăng xuất</MenuItem>
      </Menu>

      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { bgcolor: PUBLIC_COLORS.bgElevated, color: PUBLIC_COLORS.text, width: 280 } }}
      >
        <Box sx={{ p: 2.5 }}>
          <Typography fontWeight={800} sx={gradientTextSx}>
            PICK_VN
          </Typography>
        </Box>
        <List>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={isNavActive(location.pathname, item)}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    </AppBar>
  );
}
