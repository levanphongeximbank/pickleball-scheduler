import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import {
  autoCompletePastBookings,
  autoStartDueBookings,
} from "../../domain/bookingService.js";
import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
} from "../../domain/courtManagementSettings.js";

export default function AutoCompleteBookingsPanel({ clubId, onSaved }) {
  const [autoCompleteOnOpen, setAutoCompleteOnOpen] = useState(false);
  const [autoStartPlaying, setAutoStartPlaying] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const settings = loadCourtManagementSettings(clubId);
    setAutoCompleteOnOpen(Boolean(settings.automationSettings?.autoCompleteOnOpen));
    setAutoStartPlaying(Boolean(settings.automationSettings?.autoStartPlaying));
  }, [clubId]);

  const handleSaveAutomation = () => {
    saveCourtManagementSettings(clubId, {
      automationSettings: { autoCompleteOnOpen, autoStartPlaying },
    });
    setMessage("Đã lưu cài đặt tự động.");
    onSaved?.();
  };

  const handleRunComplete = () => {
    const result = autoCompletePastBookings(clubId);

    if (!result.ok) {
      setError(result.message || "Không thể cập nhật booking.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(result.message);
    onSaved?.();
  };

  const handleRunStartPlaying = () => {
    const result = autoStartDueBookings(clubId);

    if (!result.ok) {
      setError(result.message || "Không thể cập nhật booking.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(result.message);
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Tự động hóa trạng thái booking</Typography>
            <Typography variant="body2" color="text.secondary">
              Tự cập nhật booking theo giờ thực tế khi vận hành sân.
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={autoCompleteOnOpen}
                onChange={(event) => setAutoCompleteOnOpen(event.target.checked)}
              />
            }
            label="Tự hoàn thành booking quá giờ khi mở Quản lý sân"
          />

          <FormControlLabel
            control={
              <Switch
                checked={autoStartPlaying}
                onChange={(event) => setAutoStartPlaying(event.target.checked)}
              />
            }
            label="Tự chuyển sang Đang chơi khi đến giờ bắt đầu"
          />

          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="outlined" onClick={handleRunStartPlaying}>
              Chạy Đang chơi
            </Button>
            <Button variant="contained" onClick={handleRunComplete}>
              Chạy Hoàn thành
            </Button>
            <Button variant="outlined" onClick={handleSaveAutomation}>
              Lưu tự động
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
