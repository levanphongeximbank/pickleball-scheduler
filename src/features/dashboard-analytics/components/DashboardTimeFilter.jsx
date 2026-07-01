import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RefreshIcon from "@mui/icons-material/Refresh";

import { TIME_RANGE_OPTIONS, TIME_RANGE_PRESETS } from "../constants/timeRangePresets.js";

export default function DashboardTimeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  timeRange,
  scopeLabel,
  isMock,
  onRefresh,
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        mb: 3,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <CalendarMonthIcon color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight="bold">
              Bộ lọc thời gian
            </Typography>
            {isMock && <Chip size="small" label="Demo" color="warning" variant="outlined" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {timeRange.from} → {timeRange.to} • {scopeLabel}
          </Typography>
        </Box>

        <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={onRefresh}>
          Làm mới
        </Button>
      </Stack>

      <ToggleButtonGroup
        exclusive
        value={preset}
        onChange={(_, value) => value && onPresetChange(value)}
        size="small"
        sx={{
          mt: 2,
          flexWrap: "wrap",
          gap: 1,
          "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px !important",
            mx: 0,
          },
        }}
      >
        {TIME_RANGE_OPTIONS.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {preset === TIME_RANGE_PRESETS.CUSTOM && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Từ ngày"
            type="date"
            size="small"
            value={customFrom}
            onChange={(event) => onCustomFromChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Đến ngày"
            type="date"
            size="small"
            value={customTo}
            onChange={(event) => onCustomToChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
      )}
    </Box>
  );
}
