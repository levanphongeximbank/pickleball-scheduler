import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { useAuth } from "../../context/AuthContext.jsx";
import { ROLE_LABELS } from "../../auth/roles.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import { SHELL_COLORS } from "./shellTokens.js";

const ROLE_SUBTITLES = Object.freeze({
  COURT_OWNER: "Quản trị sân",
  COURT_MANAGER: "Vận hành sân",
  CASHIER: "Thu ngân sân",
  ACCOUNTANT: "Kế toán sân",
  SUPER_ADMIN: "Quản trị hệ thống",
  REFEREE: "Trọng tài giải",
  CLUB_OWNER: "Quản lý CLB",
  PLAYER: "Vận động viên",
});

function getInitials(user) {
  const name = String(user?.displayName || ROLE_LABELS[user?.role] || "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getRoleSubtitle(role) {
  return ROLE_SUBTITLES[role] || "Người dùng sân";
}

export default function AccountMenu() {
  const { authProductionEnabled, rbacEnabled, isAuthenticated, user, signOut, can } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  if (!(authProductionEnabled || rbacEnabled) || !isAuthenticated || !user) {
    return null;
  }

  const displayName = user.displayName || ROLE_LABELS[user.role] || "Người dùng";
  const subtitle = getRoleSubtitle(user.role);
  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label="Menu tài khoản"
        sx={{
          textTransform: "none",
          color: SHELL_COLORS.textPrimary,
          px: 1,
          py: 0.5,
          borderRadius: 2,
          border: `1px solid ${SHELL_COLORS.border}`,
          minWidth: 0,
          maxWidth: { xs: 140, sm: 220 },
          "&:hover": { bgcolor: SHELL_COLORS.mintBg },
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 13,
            fontWeight: 800,
            bgcolor: SHELL_COLORS.primaryGreen,
            mr: 1,
          }}
        >
          {getInitials(user)}
        </Avatar>
        <Box sx={{ textAlign: "left", minWidth: 0, display: { xs: "none", sm: "block" } }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{ fontSize: 18, ml: 0.5, color: "text.secondary" }} />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: { mt: 1, minWidth: 220, borderRadius: 2 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 36, height: 36, bgcolor: SHELL_COLORS.primaryGreen, fontWeight: 800 }}>
              {getInitials(user)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />
        <MenuItem component={RouterLink} to="/profile" onClick={() => setAnchorEl(null)}>
          Hồ sơ
        </MenuItem>
        {can(PERMISSIONS.USER_MANAGE) && (
          <MenuItem component={RouterLink} to="/users" onClick={() => setAnchorEl(null)}>
            Người dùng
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            signOut();
          }}
        >
          Đăng xuất
        </MenuItem>
      </Menu>
    </>
  );
}
