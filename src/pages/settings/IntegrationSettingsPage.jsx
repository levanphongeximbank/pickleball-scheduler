import { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useTenant } from "../../context/TenantContext.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  canManageIntegrations,
  getIntegrationOverview,
  isIntegrationOperational,
  toggleIntegrationProvider,
} from "../../features/integrations/index.js";
import { sendTestNotification } from "../../features/notifications/index.js";
import { isMarketplaceEnabled } from "../../features/integrations/config/integrationFlags.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";

const STATUS_COLOR = {
  disabled: "default",
  configured: "success",
  mock_only: "info",
  error: "error",
  active: "success",
  not_configured: "default",
  inactive: "warning",
};

export default function IntegrationSettingsPage() {
  const { currentTenantId } = useTenant();
  const runtime = usePlatformRuntime();
  const tenantId = currentTenantId;
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accessAllowed, setAccessAllowed] = useState(true);

  const overview = useMemo(
    () => (tenantId ? getIntegrationOverview(tenantId) : null),
    [tenantId, refreshKey]
  );

  useEffect(() => {
    try {
      const decision = runtime.accessService.authorize(
        {
          user_id: "demo-admin",
          tenant_id: tenantId || "integration-settings-preview",
          role: "SUPER_ADMIN",
        },
        { tenant_id: tenantId || "integration-settings-preview" },
        "integration.manage"
      );
      setAccessAllowed(Boolean(decision.allowed));
    } catch {
      setAccessAllowed(false);
    }
  }, [runtime, tenantId]);

  const access = canManageIntegrations();

  const handleToggle = (provider, enabled) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác tích hợp.");
      return;
    }
    setError(null);
    const result = toggleIntegrationProvider(tenantId, provider, enabled);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Đã ${enabled ? "bật" : "tắt"} ${provider}.`);
    setRefreshKey((v) => v + 1);
  };

  const handleTest = async (channel) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác tích hợp.");
      return;
    }

    setError(null);
    const result = await sendTestNotification(tenantId, channel);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Gửi test ${channel} thành công (mock).`);
  };

  if (!isMarketplaceEnabled() && !access.ok) {
    return (
      <Alert severity="info">
        Tích hợp Sprint 10 chưa bật. Set <code>VITE_MARKETPLACE_ENABLED=true</code> hoặc{" "}
        <code>VITE_API_ENABLED=true</code> trong .env.
      </Alert>
    );
  }

  const rows = overview
    ? [
        { key: "zalo", label: "Zalo OA", ...overview.providers.zalo, link: "/settings/integrations/zalo-oa" },
        { key: "vnpay", label: "VNPay", ...overview.providers.vnpay, link: "/settings/integrations/payments" },
        { key: "momo", label: "MoMo", ...overview.providers.momo, link: "/settings/integrations/payments" },
        { key: "stripe", label: "Stripe", ...overview.providers.stripe, link: "/settings/integrations/payments" },
        { key: "email", label: "Email", ...overview.providers.email, link: null },
        { key: "sms", label: "SMS", ...overview.providers.sms, link: null },
        { key: "mockPayment", label: "Mock Payment", ...overview.providers.mockPayment, link: "/settings/integrations/payments" },
      ]
    : [];

  return (
    <PermissionGate permissions={[PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW]}>
      <Box>
        <Typography variant="h5" gutterBottom>
          Tích hợp bên ngoài
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cấu hình Zalo, thanh toán, email, SMS theo tenant. Mặc định chạy mock/sandbox.
        </Typography>

        <Chip
          size="small"
          label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
          color={accessAllowed ? "success" : "warning"}
          sx={{ mb: 2 }}
        />

        {message && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tích hợp</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status} color={STATUS_COLOR[row.status] || "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {row.link && (
                        <Button size="small" component={RouterLink} to={row.link}>
                          Cấu hình
                        </Button>
                      )}
                      {access.ok && ["zalo", "email", "sms", "vnpay", "momo", "stripe", "mock"].includes(row.key) && (
                        <Button
                          size="small"
                          onClick={() =>
                            handleToggle(
                              row.key === "mockPayment" ? "mock" : row.key,
                              !isIntegrationOperational(row.status)
                            )
                          }
                        >
                          {isIntegrationOperational(row.status) ? "Tắt" : "Bật"}
                        </Button>
                      )}
                      {row.key === "email" && (
                        <Button size="small" onClick={() => handleTest("email")}>
                          Test
                        </Button>
                      )}
                      {row.key === "sms" && (
                        <Button size="small" onClick={() => handleTest("sms")}>
                          Test
                        </Button>
                      )}
                      {row.key === "zalo" && (
                        <Button size="small" onClick={() => handleTest("zalo")}>
                          Test
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PermissionGate>
  );
}
