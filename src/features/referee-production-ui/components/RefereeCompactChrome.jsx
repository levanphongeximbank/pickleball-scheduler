import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";

import { useAuth } from "../../../context/AuthContext.jsx";
import UserAvatar from "../../../components/identity/UserAvatar.jsx";

/**
 * Slim referee-only top chrome — workspace nav + account/logout.
 * Uses canonical Auth/session; no referee-specific auth authority.
 */
export default function RefereeCompactChrome({
  title = "Trọng tài của tôi",
  showBack = false,
  backTo = "/referee",
}) {
  const { user, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountEl, setAccountEl] = useState(null);

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.displayName || user.email || "Trọng tài";
  }, [user]);

  const email = user?.email || "";

  async function handleLogout() {
    setAccountEl(null);
    setDrawerOpen(false);
    try {
      if (typeof signOut === "function") await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <>
      <header className="rp-compact-chrome" data-testid="referee-compact-chrome">
        <div className="rp-compact-chrome-left">
          {showBack ? (
            <IconButton
              component={RouterLink}
              to={backTo}
              size="small"
              aria-label="Quay lại danh sách trận"
              data-testid="referee-chrome-back"
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          ) : null}
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu trọng tài"
            data-testid="referee-chrome-menu"
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        </div>
        <p className="rp-compact-chrome-title">{title}</p>
        <div className="rp-compact-chrome-right">
          {isAuthenticated && user ? (
            <IconButton
              size="small"
              onClick={(e) => setAccountEl(e.currentTarget)}
              aria-label="Menu tài khoản"
              data-testid="referee-account-menu-trigger"
            >
              <UserAvatar user={user} size={28} />
            </IconButton>
          ) : (
            <IconButton
              size="small"
              component={RouterLink}
              to="/login"
              aria-label="Đăng nhập"
              data-testid="referee-account-login"
            >
              <AccountCircleIcon fontSize="small" />
            </IconButton>
          )}
        </div>
      </header>

      <Menu
        anchorEl={accountEl}
        open={Boolean(accountEl)}
        onClose={() => setAccountEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{ paper: { sx: { minWidth: 200, mt: 0.5 } } }}
        data-testid="referee-account-menu"
      >
        <div className="rp-account-menu-header">
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            {displayName}
          </Typography>
          {email ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {email}
            </Typography>
          ) : null}
        </div>
        <Divider />
        <MenuItem
          component={RouterLink}
          to="/profile"
          onClick={() => setAccountEl(null)}
          data-testid="referee-account-profile"
        >
          Tài khoản
        </MenuItem>
        <MenuItem onClick={handleLogout} data-testid="referee-account-logout">
          Đăng xuất
        </MenuItem>
      </Menu>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ className: "rp-referee-nav-drawer" }}
      >
        <div className="rp-referee-nav-header" data-testid="referee-nav-drawer">
          <Typography fontWeight={800} fontSize={15}>
            Trọng tài của tôi
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <List dense disablePadding>
          <ListItemButton
            component={RouterLink}
            to="/referee"
            onClick={() => setDrawerOpen(false)}
            data-testid="referee-nav-dashboard"
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <HomeOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Dashboard / Trang chủ" />
          </ListItemButton>
          <ListItemButton
            component={RouterLink}
            to="/referee"
            onClick={() => setDrawerOpen(false)}
            data-testid="referee-nav-assignments"
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SportsTennisIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Trận được phân công" />
          </ListItemButton>
          <ListItemButton
            component={RouterLink}
            to="/profile"
            onClick={() => setDrawerOpen(false)}
            data-testid="referee-nav-account"
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Tài khoản" />
          </ListItemButton>
          <Divider sx={{ my: 0.5 }} />
          <ListItemButton onClick={handleLogout} data-testid="referee-nav-logout">
            <ListItemIcon sx={{ minWidth: 36 }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Đăng xuất" />
          </ListItemButton>
        </List>
      </Drawer>
    </>
  );
}
