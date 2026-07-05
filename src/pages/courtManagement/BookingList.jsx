import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { getBookingDisplayStatus } from "../../domain/courtBookingEngine.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";
import { getRemainingAmount } from "../../models/booking.js";
import {
  BOOKING_TYPE_LABELS,
  formatDisplayDate,
  formatTimeRange,
  PAYMENT_STATUS_LABELS,
  todayIsoDate,
} from "./courtManagement.constants.js";
import { buildBookingsCsv, downloadTextFile } from "../../domain/courtManagementSettings.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";
import { buildRuntimeAccessState } from "../../core/platform/app/runtimeAccess.js";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";

export default function BookingList({ clubId, courts = [], bookings = [], onRefresh }) {
  const runtime = usePlatformRuntime();
  const [searchParams] = useSearchParams();
  const [dateFilter, setDateFilter] = useState(todayIsoDate());
  const [showAllDates, setShowAllDates] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_asc");
  const [formOpen, setFormOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    const query = searchParams.get("q");

    if (query) {
      setSearch(query);
      setShowAllDates(true);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const tenantId = clubId || "booking-list-preview";
      const accessState = buildRuntimeAccessState(
        runtime,
        {
          user_id: "demo-admin",
          tenant_id: tenantId,
          role: "SUPER_ADMIN",
        },
        "booking.manage",
        tenantId,
        { source: "booking.list" }
      );
      setAccessAllowed(accessState.allowed);
    } catch {
      setAccessAllowed(false);
    }
  }, [clubId, runtime]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return [...bookings]
      .filter((booking) => showAllDates || booking.date === dateFilter)
      .filter((booking) => typeFilter === "all" || booking.bookingType === typeFilter)
      .filter((booking) => {
        if (statusFilter === "all") {
          return true;
        }

        if (statusFilter === "active") {
          return ["pending", "confirmed", "checked_in", "playing"].includes(booking.bookingStatus);
        }

        if (statusFilter === "completed") {
          return booking.bookingStatus === "completed";
        }

        if (statusFilter === "cancelled") {
          return ["cancelled", "no_show"].includes(booking.bookingStatus);
        }

        return true;
      })
      .filter((booking) => {
        if (paymentFilter === "all") {
          return true;
        }

        const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);

        if (paymentFilter === "debt") {
          return remaining > 0 && !["cancelled", "no_show"].includes(booking.bookingStatus);
        }

        if (paymentFilter === "paid") {
          return booking.paymentStatus === "paid";
        }

        if (paymentFilter === "unpaid") {
          return booking.paymentStatus === "unpaid";
        }

        return true;
      })
      .filter((booking) => {
        if (!keyword) {
          return true;
        }

        return (
          booking.customerName?.toLowerCase().includes(keyword) ||
          booking.customerPhone?.includes(keyword) ||
          booking.bookingCode?.toLowerCase().includes(keyword) ||
          booking.courtName?.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => {
        if (sortBy === "date_desc") {
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }

          return b.startTime.localeCompare(a.startTime);
        }

        if (sortBy === "amount_desc") {
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        }

        if (sortBy === "customer") {
          return (a.customerName || "").localeCompare(b.customerName || "", "vi");
        }

        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }

        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings, dateFilter, showAllDates, search, typeFilter, paymentFilter, statusFilter, sortBy]);

  return (
    <Box>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <TextField
            label="Lọc theo ngày"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
            disabled={showAllDates}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showAllDates}
                onChange={(event) => setShowAllDates(event.target.checked)}
              />
            }
            label="Tất cả ngày"
          />
          <TextField
            label="Tìm khách / SĐT / mã"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: 1 }}
          />
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Trạng thái</InputLabel>
            <Select
              label="Trạng thái"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="active">Đang hiệu lực</MenuItem>
              <MenuItem value="completed">Hoàn thành</MenuItem>
              <MenuItem value="cancelled">Hủy / No-show</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Thanh toán</InputLabel>
            <Select
              label="Thanh toán"
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="debt">Còn nợ</MenuItem>
              <MenuItem value="unpaid">Chưa thanh toán</MenuItem>
              <MenuItem value="paid">Đã thanh toán</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Sắp xếp</InputLabel>
            <Select
              label="Sắp xếp"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <MenuItem value="date_asc">Ngày tăng dần</MenuItem>
              <MenuItem value="date_desc">Ngày giảm dần</MenuItem>
              <MenuItem value="amount_desc">Giá trị cao nhất</MenuItem>
              <MenuItem value="customer">Tên khách A–Z</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Loại booking</InputLabel>
            <Select
              label="Loại booking"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              {Object.entries(BOOKING_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={() => downloadTextFile(`booking-${dateFilter || "all"}.csv`, buildBookingsCsv(filtered))}>
            Xuất CSV
          </Button>
          <Chip
            size="small"
            label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
            color={accessAllowed ? "success" : "warning"}
          />
          <PermissionGate
            permissions={[PERMISSIONS.BOOKING_CREATE, PERMISSIONS.BOOKING_UPDATE]}
          >
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { if (!accessAllowed) { return; } setFormOpen(true); }}>
              Tạo booking
            </Button>
          </PermissionGate>
        </Stack>
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Khách</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Sân</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Tổng tiền</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Thanh toán</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    Không có booking phù hợp.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filtered.map((booking) => {
              const display = getBookingDisplayStatus(booking);
              const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);

              return (
                <TableRow
                  key={booking.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => setDetailBooking(booking)}
                >
                  <TableCell>{booking.bookingCode}</TableCell>
                  <TableCell>{booking.customerName}</TableCell>
                  <TableCell>
                    {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
                  </TableCell>
                  <TableCell>{booking.courtName}</TableCell>
                  <TableCell>
                    {formatDisplayDate(booking.date)}
                    <br />
                    {formatTimeRange(booking.startTime, booking.endTime)}
                  </TableCell>
                  <TableCell>{formatCurrency(booking.totalAmount)} đ</TableCell>
                  <TableCell>
                    <Chip size="small" label={display.label} color={display.color} />
                  </TableCell>
                  <TableCell>
                    {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                    {remaining > 0 && (
                      <Typography variant="caption" display="block" color="error.main">
                        Nợ {formatCurrency(remaining)} đ
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <BookingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        courts={courts}
        initialValues={{ date: showAllDates ? todayIsoDate() : dateFilter }}
        onSaved={() => onRefresh?.()}
      />

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
    </Box>
  );
}
