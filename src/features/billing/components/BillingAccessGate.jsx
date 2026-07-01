import { Alert, Box, Typography } from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../features/identity/constants/permissions.js";

export default function BillingAccessGate({ children, requiredPermission = PERMISSIONS.BILLING_VIEW }) {
  const { can, user } = useAuth();
  const scope = { tenantId: user?.tenant_id || user?.tenantId };
  const allowed = can(requiredPermission, scope);

  if (allowed) {
    return children;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="warning">
        <Typography variant="subtitle2">Bạn không có quyền xem phần billing này.</Typography>
      </Alert>
    </Box>
  );
}
