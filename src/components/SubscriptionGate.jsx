import { Box, Button, Typography } from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import { Link as RouterLink } from "react-router-dom";

import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { SUBSCRIPTION_SETTINGS_PATH } from "../features/subscription/index.js";

export default function SubscriptionGate({ children }) {
  const { subscriptionCheck, isSuperAdmin } = useTenant();
  const { rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  if (subscriptionCheck.ok || isSuperAdmin) {
    return children;
  }

  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <LockClockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Gói thuê đã hết hạn
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {subscriptionCheck.error || "Tenant bị khóa do subscription hết hạn."}
      </Typography>
      <Button component={RouterLink} to={SUBSCRIPTION_SETTINGS_PATH} variant="contained">
        Gia hạn gói
      </Button>
    </Box>
  );
}
