import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
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
  getTenantIntegrationSettings,
  updateIntegrationSettings,
} from "../../features/integrations/index.js";
import { sendTestNotification, listNotificationLogs } from "../../features/notifications/index.js";

export default function ZaloIntegrationPage() {
  const { currentTenantId } = useTenant();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const settings = useMemo(
    () => getTenantIntegrationSettings(currentTenantId),
    [currentTenantId, refreshKey]
  );

  const logs = useMemo(
    () =>
      listNotificationLogs({ tenantId: currentTenantId }).filter((l) => l.channel === "zalo"),
    [currentTenantId, refreshKey]
  );

  const [form, setForm] = useState({
    zaloEnabled: settings.zaloEnabled || false,
    oaId: settings.zaloConfig?.oaId || "",
    appId: settings.zaloConfig?.appId || "",
  });

  const handleSave = () => {
    const result = updateIntegrationSettings(currentTenantId, {
      zaloEnabled: form.zaloEnabled,
      zaloConfig: {
        ...settings.zaloConfig,
        oaId: form.oaId,
        appId: form.appId,
        status: form.zaloEnabled ? "active" : "inactive",
        lastConnectedAt: form.zaloEnabled ? new Date().toISOString() : settings.zaloConfig?.lastConnectedAt,
      },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Đã lưu cấu hình Zalo OA.");
    setRefreshKey((v) => v + 1);
  };

  const handleTest = async () => {
    setError(null);
    const result = await sendTestNotification(currentTenantId, "zalo");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Đã gửi tin test Zalo (mock).");
    setRefreshKey((v) => v + 1);
  };

  return (
    <PermissionGate permissions={[PERMISSIONS.INTEGRATION_MANAGE]}>
      <Box>
        <Button component={RouterLink} to="/settings/integrations" sx={{ mb: 2 }}>
          ← Quay lại Tích hợp
        </Button>
        <Typography variant="h5" gutterBottom>
          Zalo OA
        </Typography>

        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.zaloEnabled}
                  onChange={(e) => setForm({ ...form, zaloEnabled: e.target.checked })}
                />
              }
              label="Bật gửi Zalo"
            />
            <TextField
              label="OA ID"
              value={form.oaId}
              onChange={(e) => setForm({ ...form, oaId: e.target.value })}
            />
            <TextField
              label="App ID (sandbox)"
              value={form.appId}
              onChange={(e) => setForm({ ...form, appId: e.target.value })}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSave}>
                Lưu
              </Button>
              <Button variant="outlined" onClick={handleTest}>
                Gửi test
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Typography variant="subtitle1" gutterBottom>
          Log gửi tin gần đây
        </Typography>
        {logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có log.
          </Typography>
        ) : (
          logs.slice(0, 10).map((log) => (
            <Typography key={log.id} variant="body2">
              {log.createdAt} — {log.status} — {log.templateKey}
            </Typography>
          ))
        )}
      </Box>
    </PermissionGate>
  );
}
