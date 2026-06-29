import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { computeCourtUtilization } from "../../domain/courtBookingEngine.js";
import {
  buildUtilizationCsv,
  downloadTextFile,
  loadCourtManagementSettings,
} from "../../domain/courtManagementSettings.js";
import { todayIsoDate } from "./courtManagement.constants.js";

export default function CourtUtilizationPanel({ clubId, courts = [], bookings = [], revision = 0 }) {
  const [fromDate, setFromDate] = useState(todayIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());

  const summary = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return computeCourtUtilization(
      bookings,
      courts,
      fromDate,
      toDate,
      settings.openHour,
      settings.closeHour
    );
  }, [bookings, courts, fromDate, toDate, clubId, revision]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Công suất sân</Typography>
            <Typography variant="body2" color="text.secondary">
              Tỷ lệ giờ đã book so với giờ mở cửa trong khoảng ngày chọn.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Từ ngày"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Đến ngày"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="outlined"
              onClick={() =>
                downloadTextFile(
                  `cong-suat-${fromDate}-${toDate}.csv`,
                  buildUtilizationCsv(summary)
                )
              }
            >
              Xuất CSV
            </Button>
          </Stack>

          <Box>
            <Typography variant="body2" color="text.secondary">
              Công suất tổng
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {summary.utilizationPercent}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, summary.utilizationPercent)}
              sx={{ mt: 1, height: 8, borderRadius: 1 }}
            />
          </Box>

          {summary.byCourt.length === 0 ? (
            <Typography color="text.secondary">Chưa có sân để thống kê.</Typography>
          ) : (
            summary.byCourt.map((row) => (
              <Box key={row.courtId}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography fontWeight="medium">{row.courtName}</Typography>
                  <Typography variant="body2">
                    {row.utilizationPercent}% · {row.bookingCount} booking
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, row.utilizationPercent)}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
