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
import { createBooking, saveBookingCapacityMutation } from "../../domain/bookingService.js";
import { loadCustomersForClub } from "../../domain/clubStorage.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import {
  createCourtOperationsBooking,
  listBookingEligibleCourts,
  rescheduleCourtOperationsBooking,
} from "../../features/court-resource/services/courtOperationsBookingApplication.js";
import { isCanonicalBookingLifecycle } from "../../features/court-resource/constants/canonicalBooking.js";
import { buildEndTimeOptions, buildTimeOptions, todayIsoDate } from "./courtManagement.constants.js";

function toNumber(value) {
  const parsed = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function courtOptionId(court) {
  return court?.physicalCourtId || court?.id || "";
}

function courtOptionLabel(court, index) {
  if (court?.displayName) return court.displayName;
  if (court?.courtDisplayName) return court.courtDisplayName;
  return getCourtDisplayName(court, index);
}

export default function BookingForm({
  open,
  onClose,
  clubId,
  tenantId = null,
  courts = [],
  initialValues = {},
  editingBooking = null,
  onSaved,
}) {
  const canonicalPath = isCanonicalBookingLifecycle();
  const [customerName, setCustomerName] = useState(initialValues.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialValues.customerPhone || "");
  const [date, setDate] = useState(initialValues.date || todayIsoDate({ clubId, allowBrowserLocal: !clubId }));
  const [courtId, setCourtId] = useState(
    initialValues.physicalCourtId || initialValues.courtId || courts[0]?.physicalCourtId || courts[0]?.id || ""
  );
  const [startTime, setStartTime] = useState(initialValues.startTime || "18:00");
  const [endTime, setEndTime] = useState(initialValues.endTime || "20:00");
  const [totalAmount, setTotalAmount] = useState(String(initialValues.totalAmount || ""));
  const [depositAmount, setDepositAmount] = useState(String(initialValues.depositAmount || ""));
  const [paidAmount, setPaidAmount] = useState(String(initialValues.paidAmount || ""));
  const [note, setNote] = useState(initialValues.note || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [error, setError] = useState(null);
  const [eligibleCourts, setEligibleCourts] = useState([]);
  const [inventoryError, setInventoryError] = useState(null);

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
    setDate(initialValues.date || editingBooking?.date || todayIsoDate({ clubId, allowBrowserLocal: !clubId }));
    setCourtId(
      initialValues.physicalCourtId
        || editingBooking?.physicalCourtId
        || initialValues.courtId
        || editingBooking?.courtId
        || courts[0]?.physicalCourtId
        || courts[0]?.id
        || ""
    );
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
    setInventoryError(null);
  }, [open, initialValues, editingBooking, courts, clubId]);

  useEffect(() => {
    if (!open || !canonicalPath) {
      setEligibleCourts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const listed = await listBookingEligibleCourts({ tenantId, clubId });
      if (cancelled) return;
      if (!listed?.ok) {
        setEligibleCourts([]);
        setInventoryError(listed?.message || listed?.error || "Không tải được danh sách sân canonical.");
        return;
      }
      setEligibleCourts(Array.isArray(listed.courts) ? listed.courts : []);
      setInventoryError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canonicalPath, tenantId, clubId]);

  const courtOptions = canonicalPath
    ? (eligibleCourts.length > 0 ? eligibleCourts : courts.filter((c) => c.physicalCourtId))
    : courts;

  const selectedCourt = useMemo(
    () => courtOptions.find((court) => courtOptionId(court) === courtId),
    [courtOptions, courtId]
  );

  const suggestedAmount = useMemo(() => {
    if (!selectedCourt || canonicalPath) {
      // Canonical inventory rows may lack rate cards; keep amount user-entered.
      if (!selectedCourt?.hourlyRate && !selectedCourt?.pricePerHour) {
        return 0;
      }
    }
    if (!selectedCourt) {
      return 0;
    }

    return calculateBookingAmount(selectedCourt, startTime, endTime, {
      peakHourRules: courtSettings.peakHourRules,
      date,
    });
  }, [selectedCourt, startTime, endTime, courtSettings, date, canonicalPath]);

  const handleApplySuggested = () => {
    if (suggestedAmount > 0) {
      setTotalAmount(String(suggestedAmount));
    }
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setError("Vui lòng nhập tên khách.");
      return;
    }

    if (!courtId) {
      setError("Vui lòng chọn sân.");
      return;
    }

    if (canonicalPath) {
      if (!tenantId) {
        setError("Thiếu tenantId — không thể tạo booking canonical.");
        return;
      }
      const displayName = selectedCourt
        ? courtOptionLabel(selectedCourt, 0)
        : "";
      const base = {
        tenantId,
        clubId,
        physicalCourtId: courtId,
        date,
        startTime,
        endTime,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerRef: selectedCustomerId || null,
        totalAmount: toNumber(totalAmount),
        depositAmount: toNumber(depositAmount),
        paidAmount: toNumber(paidAmount),
        note: note.trim(),
        bookingType: "single",
        courtDisplayName: displayName,
        forceCanonical: true,
      };

      const result = editingBooking
        ? await rescheduleCourtOperationsBooking({
            ...base,
            bookingId: editingBooking.bookingId || editingBooking.id,
            expectedVersion: editingBooking.version,
          })
        : await createCourtOperationsBooking(base);

      if (!result.ok) {
        setError(result.message || result.error || "Không lưu được booking canonical.");
        return;
      }

      setError(null);
      onSaved?.(result.booking);
      onClose?.();
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
      ? await saveBookingCapacityMutation(payload, clubId, { excludeId: editingBooking.id })
      : await createBooking(payload, clubId);

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
          {inventoryError && <Alert severity="warning">{inventoryError}</Alert>}

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
              {courtOptions.map((court, index) => (
                <MenuItem key={courtOptionId(court)} value={courtOptionId(court)}>
                  {courtOptionLabel(court, index)}
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
