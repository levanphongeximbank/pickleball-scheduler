import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { getSubscriptionForVenue } from "../../domain/venueService.js";
import { SUBSCRIPTION_PLANS } from "../../models/subscription.js";
import { loadActiveVenueId } from "../../data/venueSession.js";
import { SHELL_COLORS } from "./shellTokens.js";

export default function SidebarSubscriptionCard() {
  const { user, can } = useAuth();
  const venueId = user?.venueId || loadActiveVenueId();
  const subscription = venueId ? getSubscriptionForVenue(venueId) : null;
  const planId = subscription?.planId || "trial";
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;
  const canViewBilling = can(PERMISSIONS.BILLING_VIEW);

  return (
    <Box
      sx={{
        mx: 1.5,
        mb: 2,
        p: 1.5,
        borderRadius: 2,
        bgcolor: "rgba(255,255,255,0.08)",
        border: `1px solid ${SHELL_COLORS.sidebarBorder}`,
      }}
    >
      <Typography variant="caption" sx={{ color: SHELL_COLORS.sidebarTextMuted, fontWeight: 700 }}>
        Gói thuê bao
      </Typography>
      <Typography variant="subtitle2" fontWeight={800} sx={{ color: SHELL_COLORS.sidebarText, mt: 0.25 }}>
        {plan.name}
      </Typography>
      <Typography variant="caption" sx={{ color: SHELL_COLORS.sidebarTextMuted, display: "block", mt: 0.25 }}>
        {subscription?.status === "active" ? "Đang hoạt động" : "Dùng thử / xem gói"}
      </Typography>
      {canViewBilling && (
        <Button
          component={RouterLink}
          to="/billing/current-plan"
          size="small"
          variant="outlined"
          fullWidth
          sx={{
            mt: 1.25,
            color: SHELL_COLORS.sidebarText,
            borderColor: "rgba(255,255,255,0.25)",
            fontWeight: 700,
            "&:hover": {
              borderColor: "rgba(255,255,255,0.45)",
              bgcolor: "rgba(255,255,255,0.06)",
            },
          }}
        >
          Quản lý gói
        </Button>
      )}
    </Box>
  );
}
