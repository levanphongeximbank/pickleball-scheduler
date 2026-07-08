import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import { isCourtClustersEnabled } from "../../../features/court-cluster/config/clusterFlags.js";
import { computeCalendarDayKpis } from "./calendarKpiUtils.js";
import { CALENDAR_SHELL } from "./courtCalendarTokens.js";

const VIEW_LABELS = Object.freeze({
  day: "Theo ngày",
  week: "Theo tuần",
  month: "Theo tháng",
});

export default function CourtCalendarToolbar({
  view,
  onViewChange,
  anchorDate,
  dateLabel,
  onPrev,
  onToday,
  onNext,
  courts = [],
  bookings = [],
  openHour = 6,
  closeHour = 22,
  clusters = [],
  activeClusterId = "all",
  onClusterChange,
  onCreateBooking,
  kpiDate,
}) {
  const clustersEnabled = isCourtClustersEnabled() && clusters.length > 0;
  const kpis = computeCalendarDayKpis({
    bookings,
    courts,
    date: kpiDate || anchorDate,
    openHour,
    closeHour,
  });

  const prevLabel = view === "month" ? "Tháng trước" : view === "week" ? "Tuần trước" : "Trước";
  const nextLabel = view === "month" ? "Tháng sau" : view === "week" ? "Tuần sau" : "Sau";
  const todayLabel = view === "month" ? "Tháng này" : view === "week" ? "Tuần này" : "Hôm nay";

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", lg: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button variant="outlined" size="small" startIcon={<ChevronLeftIcon />} onClick={onPrev}>
            {prevLabel}
          </Button>
          <Button variant="outlined" size="small" startIcon={<TodayIcon />} onClick={onToday}>
            {todayLabel}
          </Button>
          <Button variant="outlined" size="small" endIcon={<ChevronRightIcon />} onClick={onNext}>
            {nextLabel}
          </Button>
          <Typography variant="h6" fontWeight={700} sx={{ ml: { sm: 1 }, color: "text.primary" }}>
            {dateLabel}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {clustersEnabled && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="calendar-cluster-label">Cụm sân</InputLabel>
              <Select
                labelId="calendar-cluster-label"
                label="Cụm sân"
                value={activeClusterId}
                onChange={(event) => onClusterChange?.(event.target.value)}
              >
                <MenuItem value="all">Tất cả cụm</MenuItem>
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value) => value && onViewChange?.(value)}
            sx={{
              bgcolor: "background.paper",
              border: CALENDAR_SHELL.cardBorder,
              borderRadius: 2,
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 600,
                border: 0,
                px: 1.5,
              },
              "& .Mui-selected": {
                color: CALENDAR_SHELL.primary,
                bgcolor: "rgba(16, 185, 129, 0.1)",
              },
            }}
          >
            {Object.entries(VIEW_LABELS).map(([value, label]) => (
              <ToggleButton key={value} value={value}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateBooking}>
            Tạo booking
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        <Chip
          size="small"
          label={`${kpis.bookableCount}/${kpis.totalCourts} sân hoạt động`}
          sx={{ fontWeight: 600 }}
        />
        <Chip size="small" label={`${kpis.bookingCount} booking`} variant="outlined" />
        <Chip
          size="small"
          label={`${kpis.utilizationPercent}% lấp đầy`}
          color="primary"
          variant="outlined"
        />
        <Chip
          size="small"
          label={`${kpis.expectedRevenueLabel} dự kiến`}
          sx={{ fontWeight: 600, bgcolor: "rgba(16, 185, 129, 0.08)" }}
        />
      </Stack>
    </Box>
  );
}
