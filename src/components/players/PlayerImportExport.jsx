import { useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ImportExportIcon from "@mui/icons-material/ImportExport";

import { getActiveClubId } from "../../data/club";
import {
  buildPlayersExportPayload,
  importClubData,
  stringifyClubDataExport,
} from "../../pages/clubData.logic";

export default function PlayerImportExportDialog({ open, onClose, items, onImport }) {
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("merge");
  const [statusMessage, setStatusMessage] = useState(null);

  const handleExport = () => {
    const payload = buildPlayersExportPayload(items, getActiveClubId());
    setExportText(stringifyClubDataExport(payload));
    setStatusMessage({ type: "success", text: "Đã tạo dữ liệu export." });
  };

  const handleDownload = () => {
    if (!exportText.trim()) {
      setStatusMessage({ type: "error", text: "Hãy bấm Export trước khi tải file." });
      return;
    }

    const blob = new Blob([exportText], { type: "application/json;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `pickleball-players-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setStatusMessage({ type: "success", text: "Đã tải file JSON." });
  };

  const handleImport = () => {
    const result = importClubData(importText, {
      expectedType: "players",
      mode: importMode,
      existingPlayers: items,
      existingCourts: [],
    });

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error });
      return;
    }

    onImport(result.items);
    setImportText("");
    setStatusMessage({
      type: "success",
      text: `Đã import ${result.items.length} người chơi.`,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>Import / Export người chơi</DialogTitle>
      <DialogContent>
        {statusMessage && (
          <Alert severity={statusMessage.type} sx={{ mb: 2 }}>
            {statusMessage.text}
          </Alert>
        )}

        <Typography variant="subtitle2" fontWeight={800} gutterBottom>
          Export
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="outlined" size="small" onClick={handleExport}>
            Tạo export
          </Button>
          <Button variant="contained" size="small" onClick={handleDownload}>
            Tải JSON
          </Button>
        </Stack>
        <TextField
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          value={exportText}
          onChange={(e) => setExportText(e.target.value)}
          placeholder="Dữ liệu export sẽ hiện ở đây..."
          size="small"
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" fontWeight={800} gutterBottom>
          Import
        </Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Chế độ</InputLabel>
          <Select
            value={importMode}
            label="Chế độ"
            onChange={(e) => setImportMode(e.target.value)}
          >
            <MenuItem value="merge">Gộp (merge)</MenuItem>
            <MenuItem value="replace">Thay thế</MenuItem>
          </Select>
        </FormControl>
        <TextField
          multiline
          minRows={4}
          maxRows={8}
          fullWidth
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Dán JSON import vào đây..."
          size="small"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Đóng</Button>
        <Button variant="contained" onClick={handleImport} startIcon={<ImportExportIcon />}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PlayerImportExportButton({ onClick }) {
  return (
    <Button
      variant="outlined"
      size="large"
      startIcon={<ImportExportIcon />}
      onClick={onClick}
      sx={{
        borderRadius: 1.5,
        fontWeight: 700,
        borderColor: "rgba(255,255,255,0.5)",
        color: "#ffffff",
        "&:hover": {
          borderColor: "#ffffff",
          bgcolor: "rgba(255,255,255,0.1)",
        },
      }}
    >
      Import / Export
    </Button>
  );
}
