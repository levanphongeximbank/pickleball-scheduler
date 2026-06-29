import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

import { deleteCustomer, getBookingsForCustomer } from "../../domain/customerService.js";
import { getBookingDisplayStatus, formatCurrency } from "../../domain/courtBookingEngine.js";
import {
  BOOKING_TYPE_LABELS,
  formatDisplayDate,
  formatTimeRange,
  PAYMENT_STATUS_LABELS,
} from "./courtManagement.constants.js";

export default function CustomerDetailDialog({
  open,
  customer,
  bookings = [],
  clubId,
  onClose,
  onEdit,
  onDeleted,
  onOpenBooking,
  onBookCourt,
}) {
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const relatedBookings = useMemo(() => {
    if (!customer) {
      return [];
    }

    return getBookingsForCustomer(bookings, customer).sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.startTime.localeCompare(a.startTime);
    });
  }, [customer, bookings]);

  if (!customer) {
    return null;
  }

  const handleDelete = () => {
    const result = deleteCustomer(customer.id, clubId);

    if (!result.ok) {
      setError(result.message);
      setConfirmDelete(false);
      return;
    }

    onDeleted?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{customer.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            {customer.phone || "Chưa có SĐT"} · {customer.totalBookings || 0} booking · Đã chi{" "}
            {formatCurrency(customer.totalSpent || 0)} đ
            {(customer.debtAmount || 0) > 0 && (
              <Typography component="span" color="error.main">
                {" "}
                · Nợ {formatCurrency(customer.debtAmount)} đ
              </Typography>
            )}
          </Typography>

          {customer.note && (
            <Typography variant="body2">Ghi chú: {customer.note}</Typography>
          )}

          {confirmDelete && (
            <Alert severity="warning">
              Xóa khách này? Chỉ xóa được khi không còn booking đang hiệu lực.
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" color="error" variant="contained" onClick={handleDelete}>
                  Xác nhận xóa
                </Button>
                <Button size="small" onClick={() => setConfirmDelete(false)}>
                  Hủy
                </Button>
              </Stack>
            </Alert>
          )}

          {relatedBookings.length === 0 ? (
            <Typography color="text.secondary">Chưa có booking liên quan.</Typography>
          ) : (
            relatedBookings.map((booking) => {
              const display = getBookingDisplayStatus(booking);
              return (
                <Box
                  key={booking.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    cursor: onOpenBooking ? "pointer" : "default",
                  }}
                  onClick={() => onOpenBooking?.(booking)}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography fontWeight="bold">{booking.courtName}</Typography>
                    <Chip size="small" label={display.label} color={display.color} />
                  </Stack>
                  <Typography variant="body2">
                    {formatDisplayDate(booking.date)} ·{" "}
                    {formatTimeRange(booking.startTime, booking.endTime)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
                    {" · "}
                    {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                    {" · "}
                    {formatCurrency(booking.totalAmount)} đ
                  </Typography>
                </Box>
              );
            })
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => setConfirmDelete(true)}>
          Xóa
        </Button>
        <Button onClick={() => onBookCourt?.(customer)}>Đặt sân</Button>
        <Button onClick={() => onEdit?.(customer)}>Sửa</Button>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
