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
    <Box sx={{ mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">
            {timeRange.from} → {timeRange.to}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • {scopeLabel}
          </Typography>
          {isMock && <Chip size="small" label="Demo" color="warning" variant="outlined" />}
        </Stack>

        <Button startIcon={<RefreshIcon />} variant="text" size="small" onClick={onRefresh} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}>
          Làm mới
        </Button>
      </Stack>

      <ToggleButtonGroup
        exclusive
        value={preset}
        onChange={(_, value) => value && onPresetChange(value)}
        size="small"
        sx={{
          flexWrap: "wrap",
          gap: 0.75,
          "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px !important",
            mx: 0,
            px: 1.5,
            py: 0.5,
            fontSize: 13,
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1.5 }}>
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
