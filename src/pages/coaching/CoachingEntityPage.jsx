import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import { useClub } from "../../context/ClubContext.jsx";

const EMPTY_FORM = {};

export default function CoachingEntityPage({
  title,
  description,
  columns,
  fields,
  listFn,
  saveFn,
  deleteFn,
  emptyLabel = "Chưa có dữ liệu.",
}) {
  const { activeClubId, activeClub } = useClub();
  const [revision, setRevision] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const rows = useMemo(() => {
    if (!activeClubId) return [];
    return listFn(activeClubId);
  }, [activeClubId, listFn, revision]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setForm({ ...row });
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!activeClubId) {
      setError("Chọn CLB trước khi lưu.");
      return;
    }
    const missing = fields.filter((field) => field.required && !String(form[field.key] || "").trim());
    if (missing.length > 0) {
      setError(`Vui lòng nhập: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    const result = saveFn(activeClubId, form);
    if (!result.ok) {
      setError(result.error || "Không lưu được.");
      return;
    }
    setDialogOpen(false);
    setRevision((v) => v + 1);
  };

  const handleDelete = (row) => {
    if (!activeClubId) return;
    if (!window.confirm("Xóa mục này?")) return;
    deleteFn(activeClubId, row.id);
    setRevision((v) => v + 1);
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          <Typography color="text.secondary">{description}</Typography>
          {activeClub?.name ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              CLB: {activeClub.name}
            </Typography>
          ) : null}
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} disabled={!activeClubId}>
          Thêm mới
        </Button>
      </Stack>

      {!activeClubId ? (
        <Alert severity="info">Chọn CLB ở header để quản lý huấn luyện.</Alert>
      ) : null}
      {error && !dialogOpen ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.key}>{col.label}</TableCell>
              ))}
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render ? col.render(row) : row[col.key] || "—"}</TableCell>
                  ))}
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(row)} aria-label="Sửa">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="Xóa">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? "Chỉnh sửa" : "Thêm mới"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {fields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={form[field.key] || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                required={field.required}
                multiline={field.multiline}
                minRows={field.multiline ? 3 : undefined}
                type={field.type || "text"}
                fullWidth
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSave}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
