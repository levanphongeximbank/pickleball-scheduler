import { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Chip,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useTenant } from "../../context/TenantContext.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  getIntegrationOverview,
  updateIntegrationSettings,
} from "../../features/integrations/index.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";

export default function IntegrationPaymentsPage() {
  const { currentTenantId } = useTenant();
  const runtime = usePlatformRuntime();
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  const overview = useMemo(
    () => getIntegrationOverview(currentTenantId),
    [currentTenantId, refreshKey]
  );

  useEffect(() => {
    try {
      const decision = runtime.accessService.authorize(
        {
          user_id: "demo-admin",
          tenant_id: currentTenantId || "payments-preview",
          role: "SUPER_ADMIN",
        },
        { tenant_id: currentTenantId || "payments-preview" },
        "payment.manage"
      );
      setAccessAllowed(Boolean(decision.allowed));
    } catch {
      setAccessAllowed(false);
    }
  }, [currentTenantId, runtime]);

  const [form, setForm] = useState({
    defaultPaymentProvider: overview?.settings?.defaultPaymentProvider || "mock",
    vnpayEnabled: overview?.settings?.vnpayEnabled || false,
    momoEnabled: overview?.settings?.momoEnabled || false,
    stripeEnabled: overview?.settings?.stripeEnabled || false,
    mockPaymentEnabled: overview?.settings?.mockPaymentEnabled !== false,
  });

  const handleSave = () => {
    if (!accessAllowed) {
      setMessage("Runtime platform chặn thao tác cấu hình thanh toán.");
      return;
    }

    const result = updateIntegrationSettings(currentTenantId, form);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Đã lưu cấu hình thanh toán.");
    setRefreshKey((v) => v + 1);
  };

  return (
    <PermissionGate permissions={[PERMISSIONS.INTEGRATION_MANAGE]}>
      <Box>
        <Button component={RouterLink} to="/settings/integrations" sx={{ mb: 2 }}>
          ← Quay lại Tích hợp
        </Button>
        <Typography variant="h5" gutterBottom>
          Cấu hình thanh toán
        </Typography>

        <Chip
          size="small"
          label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
          color={accessAllowed ? "success" : "warning"}
          sx={{ mb: 2 }}
        />

        {message && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              SelectProps={{ native: true }}
              label="Provider mặc định"
              value={form.defaultPaymentProvider}
              onChange={(e) => setForm({ ...form, defaultPaymentProvider: e.target.value })}
            >
              <option value="mock">Mock</option>
              <option value="vnpay">VNPay</option>
              <option value="momo">MoMo</option>
              <option value="stripe">Stripe</option>
            </TextField>

            <FormControlLabel
              control={
                <Switch
                  checked={form.mockPaymentEnabled}
                  onChange={(e) => setForm({ ...form, mockPaymentEnabled: e.target.checked })}
                />
              }
              label="Bật Mock Payment"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.vnpayEnabled}
                  onChange={(e) => setForm({ ...form, vnpayEnabled: e.target.checked })}
                />
              }
              label="Bật VNPay"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.momoEnabled}
                  onChange={(e) => setForm({ ...form, momoEnabled: e.target.checked })}
                />
              }
              label="Bật MoMo"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.stripeEnabled}
                  onChange={(e) => setForm({ ...form, stripeEnabled: e.target.checked })}
                />
              }
              label="Bật Stripe"
            />

            <Typography variant="subtitle2">Callback URLs (copy vào cổng thanh toán)</Typography>
            <TextField
              label="VNPay callback"
              value={overview?.callbackUrls?.vnpay || ""}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="MoMo callback"
              value={overview?.callbackUrls?.momo || ""}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="Stripe webhook"
              value={overview?.callbackUrls?.stripe || ""}
              InputProps={{ readOnly: true }}
              fullWidth
            />

            <Button variant="contained" onClick={handleSave}>
              Lưu
            </Button>
          </Stack>
        </Paper>
      </Box>
    </PermissionGate>
  );
}
