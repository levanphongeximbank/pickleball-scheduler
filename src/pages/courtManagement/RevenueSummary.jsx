import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  computeDailyRevenue,
  computeRangeRevenue,
  formatCurrency,
  getMonthRange,
} from "../../domain/courtBookingEngine.js";
import {
  buildRangeRevenueCsv,
  buildRevenueCsv,
  downloadTextFile,
} from "../../domain/courtManagementSettings.js";
import {
  BOOKING_TYPE_LABELS,
  formatDisplayDate,
  todayIsoDate,
} from "./courtManagement.constants.js";
import DebtReportPanel from "./DebtReportPanel.jsx";
import CourtUtilizationPanel from "./CourtUtilizationPanel.jsx";
import BookingDetail from "./BookingDetail.jsx";
import { guardSubscriptionForClub } from "../../auth/subscriptionGuard.js";
import { useAuth } from "../../context/AuthContext.jsx";

function StatCard({ label, value, hint }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight="bold" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function RevenueSummary({ bookings = [], clubId, courts = [], onRefresh, revision = 0 }) {
  const { rbacEnabled } = useAuth();
  const [mode, setMode] = useState("day");
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [fromDate, setFromDate] = useState(todayIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [detailBooking, setDetailBooking] = useState(null);
  const [exportError, setExportError] = useState(null);

  const daySummary = useMemo(
    () => computeDailyRevenue(bookings, selectedDate),
    [bookings, selectedDate]
  );

  const rangeSummary = useMemo(
    () => computeRangeRevenue(bookings, fromDate, toDate),
    [bookings, fromDate, toDate]
  );

  const summary = mode === "day" ? daySummary : rangeSummary;

  const handleExport = () => {
    if (rbacEnabled) {
      const planCheck = guardSubscriptionForClub(clubId, "accounting");
      if (!planCheck.ok) {
        setExportError(planCheck.error);
        return;
      }
    }

    setExportError(null);

    if (mode === "day") {
      downloadTextFile(`doanh-thu-${selectedDate}.csv`, buildRevenueCsv(daySummary));
      return;
    }

    if (mode === "range") {
      downloadTextFile(
        `doanh-thu-${fromDate}-${toDate}.csv`,
        buildRangeRevenueCsv(rangeSummary)
      );
    }
  };

  const applyCurrentMonth = () => {
    const { fromDate: monthStart, toDate: monthEnd } = getMonthRange(todayIsoDate());
    setFromDate(monthStart);
    setToDate(monthEnd);
    setMode("range");
  };

  return (
    <Box>
      <Tabs value={mode} onChange={(_, value) => setMode(value)} sx={{ mb: 2 }}>
        <Tab value="day" label="Theo ngày" sx={{ textTransform: "none" }} />
        <Tab value="range" label="Theo khoảng ngày" sx={{ textTransform: "none" }} />
        <Tab value="debt" label="Công nợ" sx={{ textTransform: "none" }} />
        <Tab value="utilization" label="Công suất" sx={{ textTransform: "none" }} />
      </Tabs>

      {mode === "debt" ? (
        <DebtReportPanel bookings={bookings} onOpenBooking={setDetailBooking} />
      ) : mode === "utilization" ? (
        <CourtUtilizationPanel
          clubId={clubId}
          courts={courts}
          bookings={bookings}
          revision={revision}
        />
      ) : (
        <>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        {mode === "day" ? (
          <TextField
            label="Ngày báo cáo"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        ) : (
          <>
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
            <Button variant="text" onClick={applyCurrentMonth}>
              Tháng này
            </Button>
          </>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6">
            {mode === "day"
              ? `Doanh thu ngày ${formatDisplayDate(selectedDate)}`
              : `Doanh thu ${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
          </Typography>
          <Button variant="outlined" size="small" onClick={handleExport}>
            Xuất CSV
          </Button>
        </Box>
      </Stack>

      {exportError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="Tổng doanh thu dự kiến"
            value={`${formatCurrency(summary.expectedRevenue)} đ`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard label="Đã thu" value={`${formatCurrency(summary.collected)} đ`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard label="Còn nợ" value={`${formatCurrency(summary.debt)} đ`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Booking" value={summary.totalBookings} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Hoàn thành" value={summary.completed} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Đang chơi" value={summary.playing} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Hủy" value={summary.cancelled} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="No-show" value={summary.noShow} />
        </Grid>
      </Grid>

      {mode === "range" && rangeSummary.dailyBreakdown?.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Chi tiết theo ngày
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ngày</TableCell>
                  <TableCell align="right">Dự kiến</TableCell>
                  <TableCell align="right">Đã thu</TableCell>
                  <TableCell align="right">Còn nợ</TableCell>
                  <TableCell align="right">Booking</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rangeSummary.dailyBreakdown.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell>{formatDisplayDate(day.date)}</TableCell>
                    <TableCell align="right">{formatCurrency(day.expectedRevenue)} đ</TableCell>
                    <TableCell align="right">{formatCurrency(day.collected)} đ</TableCell>
                    <TableCell align="right">{formatCurrency(day.debt)} đ</TableCell>
                    <TableCell align="right">{day.totalBookings}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Doanh thu theo sân
              </Typography>
              {Object.keys(summary.byCourt).length === 0 ? (
                <Typography color="text.secondary">Chưa có dữ liệu.</Typography>
              ) : (
                Object.entries(summary.byCourt).map(([courtName, amount]) => (
                  <Stack
                    key={courtName}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 0.5 }}
                  >
                    <Typography>{courtName}</Typography>
                    <Typography fontWeight="medium">{formatCurrency(amount)} đ</Typography>
                  </Stack>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Doanh thu theo loại booking
              </Typography>
              {Object.keys(summary.byType).length === 0 ? (
                <Typography color="text.secondary">Chưa có dữ liệu.</Typography>
              ) : (
                Object.entries(summary.byType).map(([type, amount]) => (
                  <Stack
                    key={type}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 0.5 }}
                  >
                    <Typography>{BOOKING_TYPE_LABELS[type] || type}</Typography>
                    <Typography fontWeight="medium">{formatCurrency(amount)} đ</Typography>
                  </Stack>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
        </>
      )}

      {clubId && (
        <BookingDetail
          open={Boolean(detailBooking)}
          booking={detailBooking}
          clubId={clubId}
          courts={courts}
          onClose={() => setDetailBooking(null)}
          onUpdated={() => {
            onRefresh?.();
            setDetailBooking(null);
          }}
        />
      )}
    </Box>
  );
}
