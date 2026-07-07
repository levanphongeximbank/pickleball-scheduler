import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
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
import { getRoleLabel } from "../../auth/roles.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import { SHELL_COLORS } from "./shellTokens.js";
import UserAvatar from "../identity/UserAvatar.jsx";

export default function AccountMenu() {
  const { authProductionEnabled, rbacEnabled, isAuthenticated, user, signOut, can } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  if (!(authProductionEnabled || rbacEnabled) || !isAuthenticated || !user) {
    return null;
  }

  const roleLabel = getRoleLabel(user.role);
  const displayName = user.displayName || roleLabel || "Người dùng";
  const subtitle = roleLabel || "Người dùng";
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
        <UserAvatar user={user} size={32} sx={{ mr: 1 }} />
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
            <UserAvatar user={user} size={36} />
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
        {(can(PERMISSIONS.USER_MANAGE) || can(PERMISSIONS.USER_VIEW)) && (
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
