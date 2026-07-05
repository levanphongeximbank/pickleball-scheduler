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
import AddIcon from "@mui/icons-material/Add";

import { useTenant } from "../../context/TenantContext.jsx";

const STORAGE_KEY = "pickleball-venue-hours-v1";

function readHours(tenantId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}::${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHours(tenantId, rows) {
  localStorage.setItem(`${STORAGE_KEY}::${tenantId}`, JSON.stringify(rows));
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function VenueHoursPage() {
  const { currentTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ dayOfWeek: "1", openTime: "06:00", closeTime: "22:00", label: "" });

  useEffect(() => {
    if (!currentTenantId) {
      setRows([]);
      return;
    }
    setRows(readHours(currentTenantId));
  }, [currentTenantId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek)),
    [rows]
  );

  const handleAdd = () => {
    if (!currentTenantId) return;
    const next = [
      ...rows,
      {
        id: `hours-${Date.now()}`,
        dayOfWeek: draft.dayOfWeek,
        openTime: draft.openTime,
        closeTime: draft.closeTime,
        label: draft.label || DAY_LABELS[Number(draft.dayOfWeek)] || "Ngày",
      },
    ];
    writeHours(currentTenantId, next);
    setRows(next);
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

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField
            select
            label="Ngày"
            value={draft.dayOfWeek}
            onChange={(e) => setDraft((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
            SelectProps={{ native: true }}
            sx={{ minWidth: 120 }}
          >
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={String(index)}>{label}</option>
            ))}
          </TextField>
          <TextField label="Mở cửa" value={draft.openTime} onChange={(e) => setDraft((prev) => ({ ...prev, openTime: e.target.value }))} />
          <TextField label="Đóng cửa" value={draft.closeTime} onChange={(e) => setDraft((prev) => ({ ...prev, closeTime: e.target.value }))} />
          <TextField label="Nhãn" value={draft.label} onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))} />
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleAdd} disabled={!currentTenantId}>
            Thêm khung
          </Button>
        </Stack>
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
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">Chưa có khung giờ.</TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.label || DAY_LABELS[Number(row.dayOfWeek)] || row.dayOfWeek}</TableCell>
                  <TableCell>{row.openTime}</TableCell>
                  <TableCell>{row.closeTime}</TableCell>
                  <TableCell>{row.label || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
