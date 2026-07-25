import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { useCoachingCollection } from "../../features/coaching/runtime/useCoachingCollection.js";
import { COACHING_RUNTIME_ERROR_CODES } from "../../features/coaching/runtime/errors.js";

const EMPTY_FORM = {};

/**
 * Shared coaching CRUD table page.
 * Uses runtime collection hook — pages pass `collection` name only.
 */
export default function CoachingEntityPage({
  title,
  description,
  columns,
  fields,
  collection,
  emptyLabel = "Chưa có dữ liệu.",
}) {
  const { activeClubId, activeClub } = useClub();
  const { status, rows, error: collectionError, save, remove, pending } =
    useCoachingCollection(collection, { clubId: activeClubId });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

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

  const handleSave = async () => {
    if (!activeClubId) {
      setError("Chọn CLB trước khi lưu.");
      return;
    }
    const missing = fields.filter(
      (field) => field.required && !String(form[field.key] || "").trim()
    );
    if (missing.length > 0) {
      setError(`Vui lòng nhập: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    const result = await save(form);
    if (!result?.ok) {
      if (result?.code === COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT) {
        setError(
          result.error ||
            "Xung đột phiên bản dữ liệu. Tải lại trang và thử lại."
        );
      } else {
        setError(result?.error || "Không lưu được.");
      }
      return;
    }
    setDialogOpen(false);
  };

  const handleDelete = async (row) => {
    if (!activeClubId) return;
    if (!window.confirm("Xóa mục này?")) return;
    const result = await remove(row.id);
    if (!result?.ok) {
      if (result?.code === COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT) {
        setError(
          result.error ||
            "Xung đột phiên bản dữ liệu. Tải lại trang và thử lại."
        );
      } else {
        setError(result?.error || "Không xóa được.");
      }
    }
  };

  const bannerError =
    error ||
    (collectionError && status === "error" ? collectionError.error : null);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
          <Typography color="text.secondary">{description}</Typography>
          {activeClub?.name ? (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 0.5 }}
            >
              CLB: {activeClub.name}
            </Typography>
          ) : null}
        </Box>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={openCreate}
          disabled={!activeClubId || pending || status === "denied"}
        >
          Thêm mới
        </Button>
      </Stack>

      {!activeClubId ? (
        <Alert severity="info">Chọn CLB ở header để quản lý huấn luyện.</Alert>
      ) : null}

      {status === "loading" ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Đang tải…</Typography>
        </Stack>
      ) : null}

      {status === "denied" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {collectionError?.error ||
            "Bạn không có quyền truy cập dữ liệu huấn luyện này."}
        </Alert>
      ) : null}

      {bannerError && status !== "denied" && !dialogOpen ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {bannerError}
        </Alert>
      ) : null}

      {status === "empty" && activeClubId && status !== "loading" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {emptyLabel}
        </Alert>
      ) : null}

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
                  {status === "loading" ? "Đang tải…" : emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row) : row[col.key] || "—"}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEdit(row)}
                      aria-label="Sửa"
                      disabled={pending || status === "denied"}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(row)}
                      aria-label="Xóa"
                      disabled={pending || status === "denied"}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={() => !pending && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{form.id ? "Chỉnh sửa" : "Thêm mới"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {fields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={form[field.key] || ""}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    [field.key]: event.target.value,
                  }))
                }
                required={field.required}
                multiline={field.multiline}
                minRows={field.multiline ? 3 : undefined}
                type={field.type || "text"}
                fullWidth
                disabled={pending}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={pending}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
