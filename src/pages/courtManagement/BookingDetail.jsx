import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  duplicateBooking,
  extendBookingTime,
  transferBookingCourt,
  updateBookingPayment,
  updateBookingStatus,
} from "../../domain/bookingService.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";
import { copyBookingShareText, printBookingReceipt, buildWhatsAppShareUrl } from "../../domain/bookingReceipt.js";
import { getCourtDisplayName } from "../../models/court.js";
import { getRemainingAmount } from "../../models/booking.js";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  formatDisplayDate,
  formatTimeRange,
  PAYMENT_STATUS_LABELS,
} from "./courtManagement.constants.js";
import BookingForm from "./BookingForm.jsx";

export default function BookingDetail({
  open,
  booking,
  clubId,
  courts = [],
  onClose,
  onUpdated,
}) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [transferCourtId, setTransferCourtId] = useState("");
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  if (!booking) {
    return null;
  }

  const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);
  const canModify = !["completed", "cancelled", "no_show"].includes(booking.bookingStatus);
  const canExtend = canModify && booking.bookingType === "single";

  const runStatusUpdate = (status) => {
    const result = updateBookingStatus(booking.id, status, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handleCollectPayment = () => {
    const extra = Number(String(paymentAmount).replace(/[^\d]/g, "")) || 0;

    if (extra <= 0) {
      setError("Nhập số tiền thu thêm.");
      return;
    }

    const result = updateBookingPayment(
      booking.id,
      {
        paidAmount: (Number(booking.paidAmount) || 0) + extra,
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setPaymentAmount("");
    setError(null);
    onUpdated?.(result.booking);
  };

  const handleExtend = (minutes) => {
    const result = extendBookingTime(booking.id, minutes, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handleTransfer = () => {
    const result = transferBookingCourt(booking.id, transferCourtId, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handleDuplicate = () => {
    const result = duplicateBooking(booking.id, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handlePrint = () => {
    const ok = printBookingReceipt(booking);

    if (!ok) {
      setError("Không mở được cửa sổ in. Hãy cho phép popup trình duyệt.");
    }
  };

  const handlePayFull = () => {
    const result = updateBookingPayment(
      booking.id,
      { paidAmount: Number(booking.totalAmount) || 0 },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handlePayHalfDeposit = () => {
    const total = Number(booking.totalAmount) || 0;
    const half = Math.round(total / 2);

    const result = updateBookingPayment(
      booking.id,
      {
        depositAmount: half,
        paidAmount: Math.max(Number(booking.paidAmount) || 0, half),
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onUpdated?.(result.booking);
  };

  const handleCopyInfo = async () => {
    const ok = await copyBookingShareText(booking);

    if (!ok) {
      setError("Không sao chép được. Trình duyệt không hỗ trợ clipboard.");
      return;
    }

    setError(null);
    setActionMessage("Đã sao chép thông tin booking.");
  };

  const phoneHref = booking.customerPhone
    ? `tel:${String(booking.customerPhone).replace(/\s+/g, "")}`
    : null;

  return (
    <>
      <Dialog open={open && !editOpen} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Chi tiết booking</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {actionMessage && <Alert severity="success">{actionMessage}</Alert>}

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Mã booking
              </Typography>
              <Typography>{booking.bookingCode}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Khách
              </Typography>
              <Typography>
                {booking.customerName}
                {booking.customerPhone ? ` · ${booking.customerPhone}` : ""}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Sân · Thời gian
              </Typography>
              <Typography>
                {booking.courtName} · {formatDisplayDate(booking.date)} ·{" "}
                {formatTimeRange(booking.startTime, booking.endTime)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Trạng thái
              </Typography>
              <Typography>
                {BOOKING_STATUS_LABELS[booking.bookingStatus] || booking.bookingStatus}
                {" · "}
                {PAYMENT_STATUS_LABELS[booking.paymentStatus] || booking.paymentStatus}
              </Typography>
            </Box>

            <Divider />

            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Tổng tiền
                </Typography>
                <Typography fontWeight="bold">{formatCurrency(booking.totalAmount)} đ</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Đã thu
                </Typography>
                <Typography fontWeight="bold">{formatCurrency(booking.paidAmount)} đ</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Còn lại
                </Typography>
                <Typography fontWeight="bold" color={remaining > 0 ? "error.main" : "success.main"}>
                  {formatCurrency(remaining)} đ
                </Typography>
              </Box>
            </Stack>

            {booking.note && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Ghi chú
                </Typography>
                <Typography>{booking.note}</Typography>
              </Box>
            )}

            {canExtend && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Gia hạn giờ
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" onClick={() => handleExtend(30)}>
                    +30 phút
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => handleExtend(60)}>
                    +1 giờ
                  </Button>
                </Stack>
              </Box>
            )}

            {canModify && booking.bookingType === "single" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <FormControl fullWidth size="small">
                  <InputLabel>Chuyển sân</InputLabel>
                  <Select
                    label="Chuyển sân"
                    value={transferCourtId}
                    onChange={(event) => setTransferCourtId(event.target.value)}
                  >
                    {courts
                      .filter((court) => court.id !== booking.courtId)
                      .map((court, index) => (
                        <MenuItem key={court.id} value={court.id}>
                          {getCourtDisplayName(court, index)}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Button variant="outlined" onClick={handleTransfer} sx={{ minWidth: 120 }}>
                  Chuyển
                </Button>
              </Stack>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {canModify && booking.bookingType === "single" && (
                <Button variant="outlined" onClick={handleDuplicate}>
                  Nhân bản (+7 ngày)
                </Button>
              )}
              {canModify && (
                <Button variant="outlined" onClick={() => setEditOpen(true)}>
                  Sửa booking
                </Button>
              )}
              {booking.bookingStatus === "confirmed" && (
                <Button variant="outlined" onClick={() => runStatusUpdate("checked_in")}>
                  Check-in
                </Button>
              )}
              {(booking.bookingStatus === "confirmed" ||
                booking.bookingStatus === "checked_in") && (
                <Button variant="contained" onClick={() => runStatusUpdate("playing")}>
                  Bắt đầu chơi
                </Button>
              )}
              {booking.bookingStatus === "playing" && (
                <Button variant="contained" color="success" onClick={() => runStatusUpdate("completed")}>
                  Hoàn thành
                </Button>
              )}
              {canModify && (
                <Button variant="outlined" color="warning" onClick={() => runStatusUpdate("no_show")}>
                  No-show
                </Button>
              )}
              {canModify && (
                <Button variant="outlined" color="error" onClick={() => runStatusUpdate("cancelled")}>
                  Hủy
                </Button>
              )}
            </Stack>

            {remaining > 0 && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" size="small" onClick={handlePayHalfDeposit}>
                    Cọc 50%
                  </Button>
                  <Button variant="contained" size="small" onClick={handlePayFull}>
                    Thu đủ
                  </Button>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Thu thêm"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    fullWidth
                  />
                  <Button variant="contained" onClick={handleCollectPayment} sx={{ minWidth: 120 }}>
                    Thu tiền
                  </Button>
                </Stack>
              </Stack>
            )}
          </Stack>
        </DialogContent>
      <DialogActions>
        {phoneHref && (
          <Button component="a" href={phoneHref}>
            Gọi khách
          </Button>
        )}
        <Button
          component="a"
          href={buildWhatsAppShareUrl(booking)}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </Button>
        <Button onClick={handleCopyInfo}>Sao chép</Button>
        <Button onClick={handlePrint}>In phiếu</Button>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
      </Dialog>

      <BookingForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        clubId={clubId}
        courts={courts}
        editingBooking={booking}
        onSaved={() => {
          setEditOpen(false);
          onUpdated?.();
        }}
      />
    </>
  );
}
