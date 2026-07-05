import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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

const STORAGE_KEY = "pickleball-venue-staff-v1";

function readStaff(tenantId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}::${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStaff(tenantId, rows) {
  localStorage.setItem(`${STORAGE_KEY}::${tenantId}`, JSON.stringify(rows));
}

export default function StaffListPage() {
  const { currentTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ name: "", role: "staff", phone: "", email: "" });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentTenantId) {
      setRows([]);
      return;
    }
    setRows(readStaff(currentTenantId));
  }, [currentTenantId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), "vi")),
    [rows]
  );

  const handleAdd = () => {
    if (!currentTenantId) return;
    if (!String(draft.name || "").trim()) {
      setError("Nhập tên nhân viên.");
      return;
    }
    setError(null);
    const next = [
      ...rows,
      {
        id: `staff-${Date.now()}`,
        ...draft,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    ];
    writeStaff(currentTenantId, next);
    setRows(next);
    setDraft({ name: "", role: "staff", phone: "", email: "" });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Nhân viên cơ sở
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Danh sách nhân sự vận hành theo cơ sở (local pilot).
      </Typography>

      {!currentTenantId ? <Alert severity="info">Chọn cơ sở để quản lý nhân viên.</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField label="Tên" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <TextField label="Vai trò" value={draft.role} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))} />
          <TextField label="Điện thoại" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} />
          <TextField label="Email" value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} />
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleAdd} disabled={!currentTenantId}>
            Thêm nhân viên
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Liên hệ</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">Chưa có nhân viên.</TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell>{row.phone || row.email || "—"}</TableCell>
                  <TableCell><Chip size="small" label={row.status || "active"} color="success" /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
