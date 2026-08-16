import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createMaintenanceBooking } from "../../domain/bookingService.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { getCourtDisplayName } from "../../models/court.js";
import { isCanonicalPhysicalCourtId } from "../../features/court-resource/contracts/canonicalPhysicalCourt.js";
import {
  CANONICAL_RESOURCE_BLOCK_TYPE,
  isCanonicalResourceBlocks,
} from "../../features/court-resource/constants/canonicalResourceBlock.js";
import { createResourceBlock } from "../../features/court-resource/services/courtOperationsResourceBlockApplication.js";
import {
  buildEndTimeOptions,
  buildTimeOptions,
  todayIsoDate,
} from "./courtManagement.constants.js";

export default function MaintenanceBookingPanel({
  clubId,
  tenantId = null,
  courts = [],
  onSaved,
}) {
  const canonicalPath = isCanonicalResourceBlocks();
  const [date, setDate] = useState(todayIsoDate());
  const [courtId, setCourtId] = useState(
    courts[0]?.physicalCourtId || courts[0]?.id || ""
  );
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const { startTimeOptions, endTimeOptions } = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return {
      startTimeOptions: buildTimeOptions(settings.openHour, settings.closeHour),
      endTimeOptions: buildEndTimeOptions(settings.openHour, settings.closeHour),
    };
  }, [clubId]);

  const selectedCourt = useMemo(
    () =>
      courts.find(
        (court) =>
          court?.physicalCourtId === courtId || court?.id === courtId
      ) || null,
    [courts, courtId]
  );

  const handleSubmit = async () => {
    const physicalCourtId =
      selectedCourt?.physicalCourtId ||
      (isCanonicalPhysicalCourtId(courtId) ? courtId : "");
    const useCanonical =
      canonicalPath && Boolean(physicalCourtId) && isCanonicalPhysicalCourtId(physicalCourtId);

    if (useCanonical) {
      if (!tenantId) {
        setError("Thiếu tenantId — không thể tạo resource block canonical.");
        setMessage(null);
        return;
      }
      const displayName = selectedCourt
        ? getCourtDisplayName(selectedCourt, 0)
        : "";
      const result = await createResourceBlock({
        tenantId,
        clubId,
        physicalCourtId,
        date,
        startTime,
        endTime,
        blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
        reason: note.trim() || "Bảo trì sân",
        operatorNotes: note.trim() || "Bảo trì sân",
        courtDisplayName: displayName,
        forceCanonical: true,
      });

      if (!result.ok) {
        setError(result.message || result.error || "Không tạo được resource block.");
        setMessage(null);
        return;
      }

      setError(null);
      setMessage("Đã khóa sân bảo trì (canonical Resource Block).");
      onSaved?.();
      return;
    }

    const result = await createMaintenanceBooking(
      {
        courtId,
        date,
        startTime,
        endTime,
        note: note.trim() || "Bảo trì sân",
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage("Đã khóa sân bảo trì trên lịch booking.");
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Khóa sân bảo trì</Typography>
          <Typography variant="body2" color="text.secondary">
            {canonicalPath
              ? "Canonical path: tạo Resource Block loại MAINTENANCE (không tạo booking bảo trì)."
              : "Tạo booking loại bảo trì để chặn khách đặt trùng giờ."}
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <FormControl fullWidth>
            <InputLabel>Sân</InputLabel>
            <Select label="Sân" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
              {courts.map((court, index) => (
                <MenuItem
                  key={court.physicalCourtId || court.id}
                  value={court.physicalCourtId || court.id}
                >
                  {getCourtDisplayName(court, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Ngày"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Từ giờ</InputLabel>
                <Select label="Từ giờ" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
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
                <InputLabel>Đến giờ</InputLabel>
                <Select label="Đến giờ" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {endTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            placeholder="Ví dụ: Sửa mặt sân, thay lưới..."
          />

          <Box>
            <Button variant="contained" color="warning" onClick={handleSubmit}>
              Khóa bảo trì
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
