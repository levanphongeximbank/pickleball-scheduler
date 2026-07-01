import { Alert, Box, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getPaymentReminder,
  SUBSCRIPTION_SETTINGS_PATH,
} from "../features/subscription/index.js";

export default function SubscriptionBanner() {
  const { currentTenantId, subscriptionCheck } = useTenant();
  const { rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated || !currentTenantId) {
    return null;
  }

  if (!subscriptionCheck.ok) {
    return null;
  }

  const reminder = getPaymentReminder(subscriptionCheck.subscription);

  if (!reminder.show) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={reminder.severity || "info"}
        action={
          <Button
            color="inherit"
            size="small"
            component={RouterLink}
            to={SUBSCRIPTION_SETTINGS_PATH}
          >
            Gia hạn
          </Button>
        }
      >
        {reminder.message}
      </Alert>
    </Box>
  );
}
