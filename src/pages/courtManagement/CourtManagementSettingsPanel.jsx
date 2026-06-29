import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
} from "../../domain/courtManagementSettings.js";

export default function CourtManagementSettingsPanel({ clubId, revision = 0, onSaved }) {
  const [openHour, setOpenHour] = useState("0");
  const [closeHour, setCloseHour] = useState("24");
  const [slotMinutes, setSlotMinutes] = useState("60");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const settings = loadCourtManagementSettings(clubId);
    setOpenHour(String(settings.openHour));
    setCloseHour(String(settings.closeHour));
    setSlotMinutes(String(settings.slotMinutes));
  }, [clubId, revision]);

  const handleSave = () => {
    saveCourtManagementSettings(clubId, {
      openHour: Number(openHour),
      closeHour: Number(closeHour),
      slotMinutes: Number(slotMinutes),
    });
    setMessage("Đã lưu cài đặt giờ mở cửa.");
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Cài đặt giờ mở cửa</Typography>
          <Typography variant="body2" color="text.secondary">
            Áp dụng cho lịch sân và form chọn giờ booking.
          </Typography>

          {message && <Alert severity="success">{message}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Giờ mở cửa"
                type="number"
                value={openHour}
                onChange={(e) => setOpenHour(e.target.value)}
                fullWidth
                inputProps={{ min: 0, max: 23 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Giờ đóng cửa"
                type="number"
                value={closeHour}
                onChange={(e) => setCloseHour(e.target.value)}
                fullWidth
                inputProps={{ min: 1, max: 24 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Khung giờ lịch (phút)"
                type="number"
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(e.target.value)}
                fullWidth
                inputProps={{ min: 15, max: 120, step: 15 }}
              />
            </Grid>
          </Grid>

          <Box>
            <Button variant="contained" onClick={handleSave}>
              Lưu cài đặt
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
