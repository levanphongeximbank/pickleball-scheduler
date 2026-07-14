import { useState } from "react";
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import {
  applyManualSeedOverride,
  SEED_RATING_SOURCE,
  verifySeedIntegrity,
} from "../../../../features/individual-tournament/adapters/ratingV5SeedAdapter.js";

const SOURCE_LABEL = {
  [SEED_RATING_SOURCE.RATING_V5]: "Rating V5",
  [SEED_RATING_SOURCE.ELO]: "Elo",
  [SEED_RATING_SOURCE.SKILL]: "Trình độ",
  [SEED_RATING_SOURCE.NONE]: "—",
};

export default function EngineSeedTab({ engine }) {
  const { engineState, generateSeed, saveConfig, hasReopenPermission } = engine;
  const participants = engineState.seedResult?.participants || engineState.participants || [];
  const integrity = verifySeedIntegrity(participants);
  const [adjustId, setAdjustId] = useState("");
  const [adjustSeed, setAdjustSeed] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canAdjust = hasReopenPermission === true;

  const handleManualAdjust = () => {
    setMessage(null);
    setError(null);
    const result = applyManualSeedOverride(participants, adjustId, adjustSeed, {
      hasPermission: canAdjust,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const priorLog = Array.isArray(engineState.seedAuditLog) ? engineState.seedAuditLog : [];
    const auditEntry = {
      id: `seed-audit-${Date.now()}`,
      action: "manual_seed_override",
      detail: `entry=${adjustId} → seed #${adjustSeed}`,
      before: participants.find((row) => String(row.id) === String(adjustId))?.seed ?? null,
      after: Number(adjustSeed),
      timestamp: new Date().toISOString(),
    };
    saveConfig({
      participants: result.participants,
      seedResult: {
        ...(engineState.seedResult || {}),
        participants: result.participants,
        integrity: verifySeedIntegrity(result.participants),
      },
      seedAuditLog: [...priorLog, auditEntry].slice(-50),
    });
    setMessage(`Đã chỉnh seed #${adjustSeed} (protected).`);
    setAdjustId("");
    setAdjustSeed("");
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={generateSeed}>
          Tạo hạt giống
        </Button>
        <Chip label={`VĐV: ${participants.length}`} size="small" variant="outlined" />
        <Chip
          label={integrity.ok ? "Seed OK" : "Seed lỗi"}
          size="small"
          color={integrity.ok ? "success" : "error"}
        />
        {integrity.protectedCount > 0 ? (
          <Chip label={`Protected: ${integrity.protectedCount}`} size="small" color="warning" />
        ) : null}
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Ưu tiên Rating V5 (display rating). Thiếu V5 → Elo / trình độ. Band dùng cho random draw trong nhóm hạt.
      </Alert>

      {participants.length === 0 ? (
        <Alert severity="info">Chưa có hạt giống. Nhấn &quot;Tạo hạt giống&quot; để bắt đầu.</Alert>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Seed</TableCell>
                <TableCell>Tên</TableCell>
                <TableCell align="right">Rating V5</TableCell>
                <TableCell align="right">Reliability</TableCell>
                <TableCell>Nguồn</TableCell>
                <TableCell>Band</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell>Lý do</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.seed ?? "—"}
                    {row.manualSeedOverride ? (
                      <Chip size="small" label="locked" sx={{ ml: 0.5 }} color="warning" />
                    ) : null}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.displayRating ?? "—"}</TableCell>
                  <TableCell align="right">{row.reliabilityScore ?? "—"}</TableCell>
                  <TableCell>{SOURCE_LABEL[row.seedRatingSource] || row.seedRatingSource || "—"}</TableCell>
                  <TableCell>{row.seedBand?.label || "—"}</TableCell>
                  <TableCell align="right">{row.seedScore ?? "—"}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{row.seedReason || "—"}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {canAdjust && participants.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Chỉnh seed (quyền BTC)
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Entry ID"
              value={adjustId}
              onChange={(event) => setAdjustId(event.target.value)}
            />
            <TextField
              size="small"
              type="number"
              label="Seed #"
              value={adjustSeed}
              onChange={(event) => setAdjustSeed(event.target.value)}
              inputProps={{ min: 1 }}
            />
            <Button variant="outlined" onClick={handleManualAdjust}>
              Áp dụng protected
            </Button>
          </Stack>
          {message ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              {message}
            </Alert>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          ) : null}
        </Paper>
      ) : null}

      {!integrity.ok ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {integrity.errors.join(" ")}
        </Alert>
      ) : null}
    </Box>
  );
}
