import { Box, Button, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { Link as RouterLink } from "react-router-dom";

import VenueSwitcher from "../VenueSwitcher.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { getSubscriptionForVenue } from "../../domain/venueService.js";
import { SUBSCRIPTION_PLANS } from "../../models/subscription.js";
import { loadActiveVenueId } from "../../data/venueSession.js";
import { SHELL_COLORS } from "./shellTokens.js";

export default function SidebarFooter() {
  const { user, can } = useAuth();
  const venueId = user?.venueId || loadActiveVenueId();
  const subscription = venueId ? getSubscriptionForVenue(venueId) : null;
  const planId = subscription?.planId || "trial";
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;
  const canViewBilling = can(PERMISSIONS.BILLING_VIEW);

  return (
    <Box
      sx={{
        px: 1.5,
        pb: 1.5,
        pt: 1,
        borderTop: `1px solid ${SHELL_COLORS.sidebarBorder}`,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: "rgba(255,255,255,0.04)",
          border: `1px solid ${SHELL_COLORS.sidebarBorder}`,
          mb: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: SHELL_COLORS.sidebarTextMuted, fontWeight: 600, display: "block", mb: 0.75 }}>
          Cơ sở hiện tại
        </Typography>
        <VenueSwitcher variant="dark" minWidth="100%" size="small" hideLabel />
        {canViewBilling && (
          <Button
            component={RouterLink}
            to="/billing/current-plan"
            size="small"
            startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
            fullWidth
            sx={{
              mt: 1,
              justifyContent: "flex-start",
              color: SHELL_COLORS.sidebarTextMuted,
              fontWeight: 600,
              fontSize: 12,
              textTransform: "none",
              px: 0.5,
              "&:hover": { bgcolor: "rgba(255,255,255,0.04)", color: SHELL_COLORS.sidebarText },
            }}
          >
            Gói {plan.name} — Quản lý
          </Button>
        )}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          textAlign: "center",
          color: SHELL_COLORS.sidebarTextMuted,
          fontSize: 10,
          opacity: 0.7,
        }}
      >
        © {new Date().getFullYear()} Pickleball Scheduler Pro V5.0
      </Typography>
    </Box>
  );
}
