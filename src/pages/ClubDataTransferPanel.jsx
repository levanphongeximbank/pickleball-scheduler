import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { getActiveClubId } from "../data/club";
import {
  buildCourtsExportPayload,
  buildPlayersExportPayload,
  importClubData,
  stringifyClubDataExport,
} from "./clubData.logic";

export default function ClubDataTransferPanel({
  type,
  items,
  onImport,
  title,
}) {
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("merge");
  const [statusMessage, setStatusMessage] = useState(null);

  const handleExport = () => {
    const payload =
      type === "players"
        ? buildPlayersExportPayload(items, getActiveClubId())
        : buildCourtsExportPayload(items, getActiveClubId());
    const text = stringifyClubDataExport(payload);
    setExportText(text);
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
    anchor.download = `pickleball-${type}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setStatusMessage({ type: "success", text: "Đã tải file JSON." });
  };

  const handleImport = () => {
    const result = importClubData(importText, {
      expectedType: type,
      mode: importMode,
      existingPlayers: type === "players" ? items : [],
      existingCourts: type === "courts" ? items : [],
    });

    if (!result.ok) {
      setStatusMessage({ type: "error", text: result.error });
      return;
    }

    onImport(result.items);
    setImportText("");
    setStatusMessage({
      type: "success",
      text: `Đã import ${result.items.length} ${type === "players" ? "người chơi" : "sân"}.`,
    });
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
          {title}
        </Typography>

        {statusMessage && (
          <Alert severity={statusMessage.type} sx={{ mb: 2 }}>
            {statusMessage.text}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={handleExport}>
            Export JSON
          </Button>
          <Button variant="outlined" onClick={handleDownload}>
            Tải file
          </Button>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Chế độ import</InputLabel>
            <Select
              label="Chế độ import"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value)}
            >
              <MenuItem value="merge">Gộp (merge)</MenuItem>
              <MenuItem value="replace">Thay thế toàn bộ</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleImport}>
            Import JSON
          </Button>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            multiline
            minRows={5}
            fullWidth
            label="Export"
            value={exportText}
            onChange={(event) => setExportText(event.target.value)}
            placeholder="Bấm Export JSON để xem dữ liệu..."
          />
          <TextField
            multiline
            minRows={5}
            fullWidth
            label="Import"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='Dán JSON có type "players" hoặc "courts"...'
          />
        </Box>
      </CardContent>
    </Card>
  );
}
