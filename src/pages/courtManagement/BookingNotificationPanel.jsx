import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { requestBrowserNotificationPermission } from "../../domain/bookingReminderService.js";
import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
} from "../../domain/courtManagementSettings.js";

export default function BookingNotificationPanel({ clubId, revision = 0, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [minutesBefore, setMinutesBefore] = useState("30");
  const [browserNotify, setBrowserNotify] = useState(true);
  const [inAppNotify, setInAppNotify] = useState(true);
  const [message, setMessage] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("default");

  useEffect(() => {
    const settings = loadCourtManagementSettings(clubId);
    const notificationSettings = settings.notificationSettings || {};

    setEnabled(Boolean(notificationSettings.enabled));
    setMinutesBefore(String(notificationSettings.minutesBefore ?? 30));
    setBrowserNotify(notificationSettings.browserNotify !== false);
    setInAppNotify(notificationSettings.inAppNotify !== false);

    if (typeof Notification !== "undefined") {
      setPermissionStatus(Notification.permission);
    }
  }, [clubId, revision]);

  const handleRequestPermission = async () => {
    const result = await requestBrowserNotificationPermission();
    setPermissionStatus(result);
  };

  const handleSave = () => {
    saveCourtManagementSettings(clubId, {
      notificationSettings: {
        enabled,
        minutesBefore: Number(minutesBefore),
        browserNotify,
        inAppNotify,
      },
    });
    setMessage("Đã lưu cài đặt nhắc booking.");
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Nhắc booking sắp tới</Typography>
          <Typography variant="body2" color="text.secondary">
            Hệ thống kiểm tra mỗi phút và nhắc các booking sắp bắt đầu trong khoảng thời gian cấu
            hình.
          </Typography>

          {message && <Alert severity="success">{message}</Alert>}

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Bật nhắc booking"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Nhắc trước (phút)"
                type="number"
                value={minutesBefore}
                onChange={(e) => setMinutesBefore(e.target.value)}
                fullWidth
                disabled={!enabled}
                inputProps={{ min: 5, max: 180, step: 5 }}
              />
            </Grid>
          </Grid>

          <FormControlLabel
            control={
              <Switch
                checked={inAppNotify}
                onChange={(e) => setInAppNotify(e.target.checked)}
                disabled={!enabled}
              />
            }
            label="Hiện thông báo trong app"
          />

          <FormControlLabel
            control={
              <Switch
                checked={browserNotify}
                onChange={(e) => setBrowserNotify(e.target.checked)}
                disabled={!enabled}
              />
            }
            label="Thông báo trình duyệt"
          />

          {browserNotify && enabled && permissionStatus !== "granted" && (
            <Alert severity="info">
              Cần cấp quyền thông báo trình duyệt để nhận nhắc ngoài tab.
              <Box sx={{ mt: 1 }}>
                <Button size="small" variant="outlined" onClick={handleRequestPermission}>
                  Cấp quyền thông báo
                </Button>
              </Box>
            </Alert>
          )}

          <Box>
            <Button variant="contained" onClick={handleSave}>
              Lưu nhắc booking
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
