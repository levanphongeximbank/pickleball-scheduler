import { useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import {
  downloadCourtManagementExport,
  importCourtManagementExport,
  summarizeCourtManagementImport,
} from "../../domain/courtManagementExport.js";

export default function CourtManagementExportPanel({ clubId, onImported }) {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [importMode, setImportMode] = useState("replace");
  const [pendingImport, setPendingImport] = useState(null);

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const preview = summarizeCourtManagementImport(clubId, payload);

      if (!preview.ok) {
        setError(preview.message);
        setMessage(null);
        return;
      }

      setError(null);
      setPendingImport({ payload, summary: preview.summary, fileName: file.name });
    } catch {
      setError("Không đọc được file JSON.");
      setMessage(null);
    } finally {
      event.target.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) {
      return;
    }

    const result = importCourtManagementExport(clubId, pendingImport.payload, {
      mode: importMode,
    });

    if (!result.ok) {
      setError(result.message);
      setMessage(null);
      setPendingImport(null);
      return;
    }

    setError(null);
    setMessage(result.message);
    setPendingImport(null);
    onImported?.();
  };

  const summary = pendingImport?.summary;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Sao lưu / Khôi phục</Typography>
            <Typography variant="body2" color="text.secondary">
              Xuất hoặc nhập dữ liệu booking, khách hàng và cài đặt quản lý sân.
            </Typography>
          </Box>

          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="contained" onClick={() => downloadCourtManagementExport(clubId)}>
              Tải JSON
            </Button>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
              Chọn file nhập
            </Button>
          </Stack>

          <FormControl sx={{ maxWidth: 280 }}>
            <InputLabel>Chế độ nhập</InputLabel>
            <Select
              label="Chế độ nhập"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value)}
            >
              <MenuItem value="replace">Thay thế toàn bộ</MenuItem>
              <MenuItem value="merge">Gộp thêm</MenuItem>
            </Select>
          </FormControl>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </Stack>
      </CardContent>

      <Dialog
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Xem trước nhập dữ liệu</DialogTitle>
        <DialogContent>
          {summary && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                File: {pendingImport.fileName}
              </Typography>
              {summary.exportedAt && (
                <Typography variant="body2">
                  Xuất lúc: {new Date(summary.exportedAt).toLocaleString("vi-VN")}
                </Typography>
              )}
              {summary.sourceClubId && (
                <Typography variant="body2">CLB nguồn: {summary.sourceClubId}</Typography>
              )}
              <Typography variant="body2">
                Trong file: {summary.importBookings} booking, {summary.importCustomers} khách,{" "}
                {summary.importRecurringSeries} chuỗi lặp
              </Typography>
              <Typography variant="body2">
                Hiện tại: {summary.currentBookings} booking, {summary.currentCustomers} khách
              </Typography>
              <Alert severity={importMode === "replace" ? "warning" : "info"}>
                {importMode === "replace"
                  ? "Chế độ Thay thế sẽ ghi đè toàn bộ booking/khách hiện có."
                  : "Chế độ Gộp sẽ thêm dữ liệu từ file vào dữ liệu hiện có."}
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingImport(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleConfirmImport}>
            Xác nhận nhập
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
