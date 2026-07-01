import { Alert, Box, Typography } from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import { Link as RouterLink } from "react-router-dom";

import { useBilling } from "../hooks/useBilling.js";

export default function TenantOperationalGate({ children, action = "create_booking" }) {
  const { access, tenantAccessService, tenantId } = useBilling();
  const check = tenantAccessService.canPerformAction({ tenantId, action });

  if (access.allowed && check.allowed) {
    return children;
  }

  const isSuspended = access.lockLevel === "suspended" || access.reason === "subscription_suspended";

  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <LockClockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {isSuspended ? "Tenant đã bị tạm khóa" : "Gói thuê đã hết hạn"}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {access.reason || check.reason || "Không thể thực hiện thao tác này khi subscription không còn hiệu lực."}
      </Typography>
      <Alert severity="info" sx={{ maxWidth: 480, mx: "auto", mb: 2 }}>
        Bạn vẫn có thể xem billing, invoice và liên hệ hỗ trợ gia hạn.
      </Alert>
      <Typography component={RouterLink} to="/billing" color="primary" sx={{ textDecoration: "none" }}>
        Đi tới Billing →
      </Typography>
    </Box>
  );
}
