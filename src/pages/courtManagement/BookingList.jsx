import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
import {
  AuthFilterBar,
  AuthPageHeader,
  AuthResponsiveDataView,
  StatusToneChip,
} from "../../features/web-app-ui/index.js";

const BOOKING_TONE_BY_MUI_COLOR = Object.freeze({
  default: "neutral",
  primary: "primary",
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
});

function resolveBookingTone(color) {
  return BOOKING_TONE_BY_MUI_COLOR[color] || "neutral";
}

export default function BookingList({ clubId, tenantId = null, courts = [], bookings = [], onRefresh }) {
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

  const columns = useMemo(
    () => [
      { field: "bookingCode", headerName: "Mã" },
      { field: "customerName", headerName: "Khách" },
      {
        field: "bookingType",
        headerName: "Loại",
        render: (booking) => BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType,
      },
      { field: "courtName", headerName: "Sân" },
      {
        field: "time",
        headerName: "Thời gian",
        render: (booking) => (
          <Stack spacing={0.25}>
            <Typography variant="body2">{formatDisplayDate(booking.date)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTimeRange(booking.startTime, booking.endTime)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "totalAmount",
        headerName: "Tổng tiền",
        render: (booking) => `${formatCurrency(booking.totalAmount)} đ`,
      },
      {
        field: "bookingStatus",
        headerName: "Trạng thái",
        render: (booking) => {
          const display = getBookingDisplayStatus(booking);
          return (
            <StatusToneChip
              label={display.label}
              tone={resolveBookingTone(display.color)}
            />
          );
        },
      },
      {
        field: "paymentStatus",
        headerName: "Thanh toán",
        render: (booking) => {
          const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);
          return (
            <Box>
              <Typography variant="body2">
                {PAYMENT_STATUS_LABELS[booking.paymentStatus] || booking.paymentStatus}
              </Typography>
              {remaining > 0 && (
                <Typography variant="caption" display="block" color="error.main">
                  Nợ {formatCurrency(remaining)} đ
                </Typography>
              )}
            </Box>
          );
        },
      },
    ],
    []
  );

  return (
    <Box>
      <AuthPageHeader
        title="Booking sân"
        subtitle="Quản lý booking theo đúng sân, khách hàng, khung giờ và trạng thái nghiệp vụ."
        status={
          <StatusToneChip
            label={`Quyền runtime: ${accessAllowed ? "được phép" : "bị từ chối"}`}
            tone={accessAllowed ? "success" : "warning"}
          />
        }
        primaryAction={
          <PermissionGate
            permissions={[PERMISSIONS.BOOKING_CREATE, PERMISSIONS.BOOKING_UPDATE]}
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                if (!accessAllowed) {
                  return;
                }
                setFormOpen(true);
              }}
            >
              Tạo booking
            </Button>
          </PermissionGate>
        }
        secondaryActions={
          <Button
            variant="outlined"
            onClick={() =>
              downloadTextFile(
                `booking-${dateFilter || "all"}.csv`,
                buildBookingsCsv(filtered)
              )
            }
          >
            Xuất CSV
          </Button>
        }
      />

      <AuthFilterBar
        search={
          <TextField
            label="Tìm khách, SĐT hoặc mã booking"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
          />
        }
        dateControls={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
          </Stack>
        }
        filters={
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(160px, 1fr))",
                lg: "repeat(4, minmax(160px, 1fr))",
              },
              gap: 1,
              width: "100%",
              minWidth: 0,
            }}
          >
          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="booking-status-filter-label">Trạng thái</InputLabel>
            <Select
              labelId="booking-status-filter-label"
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
          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="booking-payment-filter-label">Thanh toán</InputLabel>
            <Select
              labelId="booking-payment-filter-label"
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
          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="booking-sort-filter-label">Sắp xếp</InputLabel>
            <Select
              labelId="booking-sort-filter-label"
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
          <FormControl sx={{ minWidth: 0 }}>
            <InputLabel id="booking-type-filter-label">Loại booking</InputLabel>
            <Select
              labelId="booking-type-filter-label"
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
          </Box>
        }
        resultCount={filtered.length}
        resultCountLabel="booking"
      />

      <AuthResponsiveDataView
        columns={columns}
        rows={filtered}
        getRowId={(booking) => booking.id}
        emptyTitle="Không có booking phù hợp"
        emptyDescription="Hãy điều chỉnh bộ lọc hoặc tạo booking mới."
        renderRowActions={(booking) => (
          <Button
            size="small"
            onClick={() => setDetailBooking(booking)}
            aria-label={`Xem chi tiết booking ${booking.bookingCode || booking.id}`}
          >
            Xem chi tiết
          </Button>
        )}
      />

      <BookingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        tenantId={tenantId}
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
