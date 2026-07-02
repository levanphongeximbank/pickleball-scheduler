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
  buildIntegrationProviderRows,
  canManageIntegrations,
  getIntegrationOverview,
  hydrateIntegrationSettings,
  isIntegrationOperational,
  isIntegrationsFeatureEnabled,
  toggleIntegrationProvider,
} from "../../features/integrations/index.js";
import { sendTestNotification } from "../../features/notifications/index.js";

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
  const tenantId = currentTenantId;
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const overview = useMemo(
    () => (tenantId ? getIntegrationOverview(tenantId) : null),
    [tenantId, refreshKey]
  );

  const rows = useMemo(() => buildIntegrationProviderRows(overview), [overview]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    void hydrateIntegrationSettings(tenantId).then((result) => {
      if (!cancelled && result?.ok) {
        setRefreshKey((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const access = canManageIntegrations();
  const permissionScope = useMemo(
    () => ({ venueId: tenantId, tenantId }),
    [tenantId]
  );

  const handleToggle = (provider, enabled) => {
    if (!tenantId) {
      setError("Chưa xác định tenant.");
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
    if (!tenantId) {
      setError("Chưa xác định tenant.");
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

  if (!tenantId) {
    return (
      <Alert severity="warning">
        Chưa xác định tenant. Kiểm tra profile <code>venue_id</code> hoặc chọn tenant.
      </Alert>
    );
  }

  return (
    <PermissionGate
      permissions={[PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW]}
      scope={permissionScope}
      fallback={
        <Alert severity="warning">
          Bạn không có quyền xem cấu hình tích hợp cho tenant này.
        </Alert>
      }
    >
      <Box>
        <Typography variant="h5" gutterBottom>
          Tích hợp bên ngoài
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cấu hình Zalo, thanh toán, email, SMS theo tenant. Mặc định chạy mock/sandbox.
        </Typography>

        {!isIntegrationsFeatureEnabled() && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Feature flag tích hợp chưa bật trên env. Danh sách vẫn hiển thị ở chế độ disabled.
            Set <code>VITE_MARKETPLACE_ENABLED=true</code> hoặc <code>VITE_API_ENABLED=true</code> để
            bật đầy đủ.
          </Alert>
        )}

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

        {rows.length === 0 ? (
          <Alert severity="warning">Không có provider tích hợp để hiển thị.</Alert>
        ) : (
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
                      <Chip
                        size="small"
                        label={row.status}
                        color={STATUS_COLOR[row.status] || "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {row.link && (
                          <Button size="small" component={RouterLink} to={row.link}>
                            Cấu hình
                          </Button>
                        )}
                        {access.ok &&
                          ["zalo", "email", "sms", "vnpay", "momo", "stripe", "mock"].includes(
                            row.key
                          ) && (
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
                        {row.key === "email" && access.ok && (
                          <Button size="small" onClick={() => handleTest("email")}>
                            Test
                          </Button>
                        )}
                        {row.key === "sms" && access.ok && (
                          <Button size="small" onClick={() => handleTest("sms")}>
                            Test
                          </Button>
                        )}
                        {row.key === "zalo" && access.ok && (
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
        )}
      </Box>
    </PermissionGate>
  );
}
