import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
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
import SaveIcon from "@mui/icons-material/Save";

import { useTenant } from "../../context/TenantContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import {
  getVenueOperatingHours,
  updateVenueOperatingHours,
  shouldWarnLegacyImport,
} from "../../features/venue-court/index.js";

export default function VenueHoursPage() {
  const { currentTenantId } = useTenant();
  const { activeClubId, activeClub } = useClub();
  const [draft, setDraft] = useState({ openTime: "06:00", closeTime: "22:00" });
  const [savedHours, setSavedHours] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [compatWarning, setCompatWarning] = useState(null);

  const clubBelongsToTenant = Boolean(
    currentTenantId && activeClubId && activeClub?.venueId === currentTenantId
  );

  useEffect(() => {
    setMessage(null);
    setError(null);
    setCompatWarning(null);

    if (!currentTenantId) {
      setSavedHours(null);
      return;
    }

    if (!activeClubId || !clubBelongsToTenant) {
      setSavedHours(null);
      return;
    }

    try {
      const hours = getVenueOperatingHours({
        clubId: activeClubId,
        tenantId: currentTenantId,
      });
      setSavedHours(hours);
      setDraft({
        openTime: hours.openHour,
        closeTime: hours.closeHour,
      });
      if (shouldWarnLegacyImport(hours.legacyImport)) {
        setCompatWarning(
          hours.legacyImport?.message ||
            "Giờ hoạt động cũ có lịch khác nhau theo ngày hoặc có phút lẻ nên không thể tự chuyển. Hệ thống chưa thay đổi dữ liệu cũ."
        );
      }
    } catch (loadError) {
      setSavedHours(null);
      setError(loadError?.message || "Không tải được giờ mở cửa.");
    }
  }, [currentTenantId, activeClubId, clubBelongsToTenant]);

  const displayRows = useMemo(() => {
    if (!savedHours) {
      return [];
    }
    return [
      {
        id: "operating-hours-ssot",
        label: "Mọi ngày",
        openTime: savedHours.openHour,
        closeTime: savedHours.closeHour,
      },
    ];
  }, [savedHours]);

  const handleSave = () => {
    setMessage(null);
    setError(null);

    if (!currentTenantId || !activeClubId || !clubBelongsToTenant) {
      return;
    }

    try {
      const result = updateVenueOperatingHours(
        { openHour: draft.openTime, closeHour: draft.closeTime },
        { clubId: activeClubId, tenantId: currentTenantId }
      );

      if (!result.ok) {
        setError(result.message || "Giờ mở cửa không hợp lệ.");
        return;
      }

      setSavedHours(result.hours);
      setDraft({
        openTime: result.hours.openHour,
        closeTime: result.hours.closeHour,
      });
      setMessage("Đã lưu giờ mở cửa vào Court Management.");
    } catch (saveError) {
      setError(saveError?.message || "Không lưu được giờ mở cửa.");
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Giờ mở cửa
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Khung giờ hoạt động theo cơ sở — dùng cho cảnh báo quá tải sân.
      </Typography>

      {!currentTenantId ? <Alert severity="info">Chọn cơ sở để cấu hình giờ mở cửa.</Alert> : null}
      {currentTenantId && !clubBelongsToTenant ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chọn CLB thuộc cơ sở hiện tại để cấu hình giờ mở cửa.
        </Alert>
      ) : null}
      {compatWarning ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {compatWarning}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField
            label="Mở cửa"
            value={draft.openTime}
            onChange={(e) => setDraft((prev) => ({ ...prev, openTime: e.target.value }))}
            disabled={!clubBelongsToTenant}
          />
          <TextField
            label="Đóng cửa"
            value={draft.closeTime}
            onChange={(e) => setDraft((prev) => ({ ...prev, closeTime: e.target.value }))}
            disabled={!clubBelongsToTenant}
          />
          <Button
            startIcon={<SaveIcon />}
            variant="contained"
            onClick={handleSave}
            disabled={!clubBelongsToTenant}
          >
            Lưu
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Nguồn: Court Management (openHour/closeHour). Chỉ hỗ trợ giờ tròn HH:00.
        </Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ngày</TableCell>
              <TableCell>Mở cửa</TableCell>
              <TableCell>Đóng cửa</TableCell>
              <TableCell>Nhãn</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Chưa có khung giờ.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{row.openTime}</TableCell>
                  <TableCell>{row.closeTime}</TableCell>
                  <TableCell>{row.label}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
