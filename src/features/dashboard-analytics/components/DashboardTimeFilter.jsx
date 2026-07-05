import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  DASHBOARD_TIME_FILTER_OPTIONS,
  TIME_RANGE_PRESETS,
} from "../constants/timeRangePresets.js";
import { DASHBOARD_LAYOUT } from "../constants/dashboardLayout.js";

export default function DashboardTimeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  isMock,
  onRefresh,
}) {
  return (
    <Box sx={{ mb: DASHBOARD_LAYOUT.sectionGap }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
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
              px: 1.75,
              py: 0.55,
              fontSize: 13,
              fontWeight: 600,
              color: "text.secondary",
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                borderColor: "divider",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
              },
            },
          }}
        >
          {DASHBOARD_TIME_FILTER_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1} alignItems="center">
          {isMock && <Chip size="small" label="Demo" color="warning" variant="outlined" />}
          <Button
            startIcon={<RefreshIcon />}
            variant="text"
            size="small"
            onClick={onRefresh}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
          >
            Làm mới
          </Button>
        </Stack>
      </Stack>

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
