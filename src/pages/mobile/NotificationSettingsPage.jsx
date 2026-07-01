import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

import {
  getNotificationPermission,
  getNotificationPreferences,
  setNotificationPreference,
  subscribeToPush,
  unsubscribeFromPush,
} from "../../features/mobile/services/notificationService.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from "../../features/mobile/constants/notificationTypes.js";
import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";
import { useTenant } from "../../context/TenantContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function NotificationSettingsPage() {
  const { currentTenantId } = useTenant();
  const auth = useAuth();
  const [prefs, setPrefs] = useState(getNotificationPreferences());
  const [permission, setPermission] = useState(getNotificationPermission());
  const [message, setMessage] = useState("");

  const refreshPermissionState = () => {
    setPrefs(getNotificationPreferences());
    setPermission(getNotificationPermission());
  };

  useEffect(() => {
    refreshPermissionState();
  }, []);

  const handleToggle = (type) => (event) => {
    const enabled = event.target.checked;
    const result = setNotificationPreference(type, enabled);
    setPrefs(result.prefs);
  };

  const handleEnablePush = async () => {
    setMessage("");
    const result = await subscribeToPush({
      tenantId: currentTenantId,
      userId: auth.user?.id,
    });
    refreshPermissionState();
    if (result.ok) {
      setMessage("Đã bật thông báo đẩy.");
    } else {
      setMessage(result.error || "Không thể bật thông báo.");
    }
  };

  const handleDisablePush = async () => {
    await unsubscribeFromPush();
    refreshPermissionState();
    setMessage("Đã tắt thông báo đẩy.");
  };

  return (
    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 }, maxWidth: 560 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <NotificationsIcon color="primary" />
        <Typography variant="h5" fontWeight={900}>
          Thông báo
        </Typography>
      </Stack>

      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={800}>
          Trạng thái quyền thông báo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Quyền hiện tại: <strong>{permission}</strong>
        </Typography>
      </Box>

      {permission === "default" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Trình duyệt đang chờ bạn cho phép thông báo. Nhấn “Bật thông báo” để tiếp tục.
        </Alert>
      )}
      {typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Thông báo đẩy cần môi trường HTTPS hoặc localhost để hoạt động đầy đủ.
        </Alert>
      )}
      {permission === "denied" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Quyền thông báo đã bị chặn. Bạn có thể mở cài đặt trình duyệt để cho phép lại.
        </Alert>
      )}
      {permission === "granted" && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Thông báo đã được bật cho thiết bị này.
        </Alert>
      )}

      {message && (
        <Alert severity={message.includes("Không") ? "warning" : "success"} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={handleEnablePush} sx={{ minHeight: 48 }}>
          Bật thông báo
        </Button>
        <Button variant="outlined" onClick={handleDisablePush} sx={{ minHeight: 48 }}>
          Tắt thông báo
        </Button>
      </Stack>

      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
        Loại thông báo
      </Typography>

      <Stack spacing={0.5}>
        {Object.values(NOTIFICATION_TYPES).map((type) => (
          <FormControlLabel
            key={type}
            control={
              <Switch
                checked={prefs[type] !== false}
                onChange={handleToggle(type)}
              />
            }
            label={NOTIFICATION_TYPE_LABELS[type]}
            sx={{ minHeight: 48 }}
          />
        ))}
      </Stack>

      <Alert severity="info" sx={{ mt: 3 }}>
        Ứng dụng chỉ xin quyền khi bạn chủ động bật. Bạn có thể tắt từng loại thông báo riêng ở dưới.
      </Alert>
    </Box>
  );
}
