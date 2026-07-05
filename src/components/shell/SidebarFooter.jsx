import { Box, Button, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { Link as RouterLink } from "react-router-dom";

import VenueSwitcher from "../VenueSwitcher.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { SHELL_COLORS } from "./shellTokens.js";

export default function SidebarFooter() {
  const { can } = useAuth();
  const canSwitchVenue =
    can(PERMISSIONS.VENUE_UPDATE) || can(PERMISSIONS.ROLE_MANAGE) || can(PERMISSIONS.USER_MANAGE);

  return (
    <Box
      sx={{
        px: 1,
        pb: 1.1,
        pt: 0.75,
        borderTop: `1px solid ${SHELL_COLORS.sidebarBorder}`,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          p: 1,
          borderRadius: 1.25,
          bgcolor: "rgba(255,255,255,0.04)",
          border: `1px solid ${SHELL_COLORS.sidebarBorder}`,
          mb: 0.75,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: SHELL_COLORS.sidebarTextMuted,
            fontWeight: 600,
            display: "block",
            mb: 0.5,
            fontSize: 10,
          }}
        >
          Cơ sở hiện tại
        </Typography>
        <VenueSwitcher variant="dark" minWidth="100%" size="small" hideLabel />
        {canSwitchVenue && (
          <Button
            component={RouterLink}
            to="/admin/tenants"
            size="small"
            startIcon={<SwapHorizIcon sx={{ fontSize: 14 }} />}
            fullWidth
            sx={{
              mt: 0.75,
              justifyContent: "flex-start",
              color: SHELL_COLORS.sidebarTextMuted,
              fontWeight: 600,
              fontSize: 11,
              textTransform: "none",
              px: 0.25,
              py: 0.25,
              minHeight: 28,
              "&:hover": { bgcolor: "rgba(255,255,255,0.04)", color: SHELL_COLORS.sidebarText },
            }}
          >
            Switch cơ sở
          </Button>
        )}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          textAlign: "center",
          color: SHELL_COLORS.sidebarTextMuted,
          fontSize: 9,
          opacity: 0.7,
          lineHeight: 1.3,
        }}
      >
        © {new Date().getFullYear()} Pickleball Scheduler Pro V5.0
      </Typography>
    </Box>
  );
}
