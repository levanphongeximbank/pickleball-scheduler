import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { getCourtDisplayName } from "../../models/court.js";
import { calculateBookingAmount, formatCurrency } from "../../domain/courtBookingEngine.js";
import { createBooking, saveBooking } from "../../domain/bookingService.js";
import { loadCustomersForClub } from "../../domain/clubStorage.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { buildEndTimeOptions, buildTimeOptions } from "./courtManagement.constants.js";

function toNumber(value) {
  const parsed = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function BookingForm({
  open,
  onClose,
  clubId,
  courts = [],
  initialValues = {},
  editingBooking = null,
  onSaved,
}) {
  const [customerName, setCustomerName] = useState(initialValues.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialValues.customerPhone || "");
  const [date, setDate] = useState(initialValues.date || new Date().toISOString().slice(0, 10));
  const [courtId, setCourtId] = useState(initialValues.courtId || courts[0]?.id || "");
  const [startTime, setStartTime] = useState(initialValues.startTime || "18:00");
  const [endTime, setEndTime] = useState(initialValues.endTime || "20:00");
  const [totalAmount, setTotalAmount] = useState(String(initialValues.totalAmount || ""));
  const [depositAmount, setDepositAmount] = useState(String(initialValues.depositAmount || ""));
  const [paidAmount, setPaidAmount] = useState(String(initialValues.paidAmount || ""));
  const [note, setNote] = useState(initialValues.note || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [error, setError] = useState(null);

  const customers = useMemo(() => {
    if (!open) {
      return [];
    }

    return [...loadCustomersForClub(clubId)].sort((a, b) => a.name.localeCompare(b.name));
  }, [open, clubId]);

  const { startTimeOptions, endTimeOptions, courtSettings } = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return {
      startTimeOptions: buildTimeOptions(settings.openHour, settings.closeHour),
      endTimeOptions: buildEndTimeOptions(settings.openHour, settings.closeHour),
      courtSettings: settings,
    };
  }, [clubId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomerName(initialValues.customerName || editingBooking?.customerName || "");
    setCustomerPhone(initialValues.customerPhone || editingBooking?.customerPhone || "");
    setDate(initialValues.date || editingBooking?.date || new Date().toISOString().slice(0, 10));
    setCourtId(initialValues.courtId || editingBooking?.courtId || courts[0]?.id || "");
    setStartTime(initialValues.startTime || editingBooking?.startTime || "18:00");
    setEndTime(initialValues.endTime || editingBooking?.endTime || "20:00");
    setTotalAmount(
      String(
        initialValues.totalAmount ??
          editingBooking?.totalAmount ??
          ""
      )
    );
    setDepositAmount(
      String(
        initialValues.depositAmount ??
          editingBooking?.depositAmount ??
          ""
      )
    );
    setPaidAmount(
      String(
        initialValues.paidAmount ??
          editingBooking?.paidAmount ??
          ""
      )
    );
    setNote(initialValues.note || editingBooking?.note || "");
    setSelectedCustomerId("");
    setError(null);
  }, [open, initialValues, editingBooking, courts]);

  const selectedCourt = useMemo(
    () => courts.find((court) => court.id === courtId),
    [courts, courtId]
  );

  const suggestedAmount = useMemo(() => {
    if (!selectedCourt) {
      return 0;
    }

    return calculateBookingAmount(selectedCourt, startTime, endTime, {
      peakHourRules: courtSettings.peakHourRules,
      date,
    });
  }, [selectedCourt, startTime, endTime, courtSettings, date]);

  const handleApplySuggested = () => {
    if (suggestedAmount > 0) {
      setTotalAmount(String(suggestedAmount));
    }
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      setError("Vui lòng nhập tên khách.");
      return;
    }

    if (!courtId) {
      setError("Vui lòng chọn sân.");
      return;
    }

    const payload = {
      ...(editingBooking || {}),
      courtId,
      date,
      startTime,
      endTime,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      totalAmount: toNumber(totalAmount),
      depositAmount: toNumber(depositAmount),
      paidAmount: toNumber(paidAmount),
      note: note.trim(),
      bookingType: "single",
      bookingStatus: editingBooking?.bookingStatus || "confirmed",
    };

    const result = editingBooking
      ? saveBooking(payload, clubId, { excludeId: editingBooking.id })
      : createBooking(payload, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    onSaved?.(result.booking);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editingBooking ? "Sửa booking" : "Tạo booking mới"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!editingBooking && customers.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Chọn khách có sẵn</InputLabel>
              <Select
                label="Chọn khách có sẵn"
                value={selectedCustomerId}
                onChange={(event) => {
                  const customerId = event.target.value;
                  setSelectedCustomerId(customerId);

                  const customer = customers.find((item) => item.id === customerId);

                  if (customer) {
                    setCustomerName(customer.name);
                    setCustomerPhone(customer.phone || "");
                  }
                }}
              >
                <MenuItem value="">Nhập khách mới</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Tên khách"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Số điện thoại"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            fullWidth
          />

          <TextField
            label="Ngày"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <FormControl fullWidth>
            <InputLabel>Sân</InputLabel>
            <Select
              label="Sân"
              value={courtId}
              onChange={(event) => setCourtId(event.target.value)}
            >
              {courts.map((court, index) => (
                <MenuItem key={court.id} value={court.id}>
                  {getCourtDisplayName(court, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Giờ bắt đầu</InputLabel>
                <Select
                  label="Giờ bắt đầu"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                >
                  {startTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Giờ kết thúc</InputLabel>
                <Select
                  label="Giờ kết thúc"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                >
                  {endTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Gợi ý giá: {formatCurrency(suggestedAmount)} đ
            </Typography>
            <Button size="small" onClick={handleApplySuggested}>
              Dùng gợi ý
            </Button>
          </Stack>

          <TextField
            label="Tổng tiền"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            fullWidth
          />

          <TextField
            label="Tiền cọc"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            fullWidth
          />

          <TextField
            label="Đã thanh toán"
            value={paidAmount}
            onChange={(event) => setPaidAmount(event.target.value)}
            fullWidth
          />

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Lưu booking
        </Button>
      </DialogActions>
    </Dialog>
  );
}
