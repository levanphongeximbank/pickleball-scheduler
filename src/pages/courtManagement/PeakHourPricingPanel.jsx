import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  loadCourtManagementSettings,
  saveCourtManagementSettings,
} from "../../domain/courtManagementSettings.js";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

export default function PeakHourPricingPanel({ clubId, revision = 0, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [startHour, setStartHour] = useState("17");
  const [endHour, setEndHour] = useState("22");
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const settings = loadCourtManagementSettings(clubId);
    setEnabled(Boolean(settings.peakHourRules?.enabled));
    setStartHour(String(settings.peakHourRules?.startHour ?? 17));
    setEndHour(String(settings.peakHourRules?.endHour ?? 22));
    setWeekdays(settings.peakHourRules?.weekdays || [0, 1, 2, 3, 4, 5, 6]);
  }, [clubId, revision]);

  const toggleWeekday = (day) => {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    );
  };

  const handleSave = () => {
    saveCourtManagementSettings(clubId, {
      peakHourRules: {
        enabled,
        startHour: Number(startHour),
        endHour: Number(endHour),
        weekdays: weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6],
      },
    });
    setMessage("Đã lưu quy tắc giờ cao điểm.");
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Giá giờ cao điểm</Typography>
          <Typography variant="body2" color="text.secondary">
            Trong khung giờ cao điểm, hệ thống dùng giá cao điểm của từng sân. Ngoài khung giờ dùng
            giá thường.
          </Typography>

          {message && <Alert severity="success">{message}</Alert>}

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Bật giá theo giờ cao điểm"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Giờ bắt đầu cao điểm"
                type="number"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                fullWidth
                disabled={!enabled}
                inputProps={{ min: 0, max: 23 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Giờ kết thúc cao điểm"
                type="number"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                fullWidth
                disabled={!enabled}
                inputProps={{ min: 1, max: 24 }}
              />
            </Grid>
          </Grid>

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Áp dụng các ngày
            </Typography>
            <Stack direction="row" spacing={0} flexWrap="wrap">
              {WEEKDAY_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={weekdays.includes(option.value)}
                      onChange={() => toggleWeekday(option.value)}
                      disabled={!enabled}
                    />
                  }
                  label={option.label}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Button variant="contained" onClick={handleSave}>
              Lưu giá cao điểm
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
