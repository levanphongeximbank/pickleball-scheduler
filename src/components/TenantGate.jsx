import { Box, Button, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { isTenantSelfServiceExemptPath } from "../features/billing/guards/operationalRoutePolicy.js";

export default function TenantGate({ children }) {
  const location = useLocation();
  const { tenantCheck, isSuperAdmin } = useTenant();
  const { rbacEnabled, isAuthenticated } = useAuth();

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  if (isTenantSelfServiceExemptPath(location.pathname)) {
    return children;
  }

  if (tenantCheck.ok) {
    return children;
  }

  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <BlockIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Không thể truy cập
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {tenantCheck.error || "Tenant hiện tại không khả dụng."}
      </Typography>
      {isSuperAdmin && (
        <Button component={RouterLink} to="/admin/tenants" variant="outlined">
          Quản lý cụm sân
        </Button>
      )}
    </Box>
  );
}
