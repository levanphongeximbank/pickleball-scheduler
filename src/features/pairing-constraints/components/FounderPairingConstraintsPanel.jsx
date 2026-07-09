import { useMemo, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import {
  CONSTRAINT_MODE,
  CONSTRAINT_TYPE,
  CONSTRAINT_TYPE_LABELS,
} from "../constants.js";
import { createPairingConstraint } from "../models/pairingConstraint.js";
import SuperAdminFeatureGate from "./SuperAdminFeatureGate.jsx";

function formatConstraintLabel(constraint, playersById) {
  const anchor = playersById.get(constraint.anchorPlayerId)?.name || constraint.anchorPlayerId;
  const targets = constraint.targetPlayerIds
    .map((id) => playersById.get(id)?.name || id)
    .join(", ");
  return `${anchor} → ${targets}`;
}

export default function FounderPairingConstraintsPanel({
  constraints = [],
  players = [],
  onChange,
  onSave,
}) {
  const [draftType, setDraftType] = useState(CONSTRAINT_TYPE.PREFER_PARTNER);
  const [draftMode, setDraftMode] = useState(CONSTRAINT_MODE.SOFT);
  const [draftAnchor, setDraftAnchor] = useState(null);
  const [draftTargets, setDraftTargets] = useState([]);
  const [draftNote, setDraftNote] = useState("");
  const [localError, setLocalError] = useState(null);

  const playersById = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  );

  const handleAdd = () => {
    if (!draftAnchor?.id) {
      setLocalError("Chọn VĐV gốc (người A).");
      return;
    }
    if (!draftTargets.length) {
      setLocalError("Chọn ít nhất một VĐV đích (B, C, D...).");
      return;
    }

    const next = [
      ...constraints,
      createPairingConstraint({
        type: draftType,
        mode: draftMode,
        anchorPlayerId: draftAnchor.id,
        targetPlayerIds: draftTargets.map((player) => player.id),
        note: draftNote,
      }),
    ];

    setLocalError(null);
    onChange?.(next);
    setDraftTargets([]);
    setDraftNote("");
  };

  const handleRemove = (constraintId) => {
    onChange?.(constraints.filter((item) => item.id !== constraintId));
  };

  const handleToggle = (constraintId) => {
    onChange?.(
      constraints.map((item) =>
        item.id === constraintId ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  return (
    <SuperAdminFeatureGate>
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: "warning.main" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <AdminPanelSettingsIcon color="warning" fontSize="small" />
        <Typography variant="subtitle1" fontWeight="bold">
          Quy tắc ghép cặp Founder
        </Typography>
        <Chip size="small" color="warning" label="Super Admin" />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Ưu tiên hoặc tránh ghép cặp/đội, tránh cùng bảng. Engine sẽ áp dụng khi bấm Đề xuất cặp /
        Chia bảng.
      </Typography>

      {localError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {localError}
        </Alert>
      )}

      {constraints.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {constraints.map((constraint) => (
            <Paper key={constraint.id} variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 0.5 }}>
                    <Chip
                      size="small"
                      label={CONSTRAINT_TYPE_LABELS[constraint.type] || constraint.type}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={constraint.mode === CONSTRAINT_MODE.HARD ? "Cứng" : "Mềm"}
                    />
                    <Chip
                      size="small"
                      color={constraint.enabled ? "success" : "default"}
                      label={constraint.enabled ? "Bật" : "Tắt"}
                      onClick={() => handleToggle(constraint.id)}
                    />
                  </Stack>
                  <Typography variant="body2">{formatConstraintLabel(constraint, playersById)}</Typography>
                  {constraint.note ? (
                    <Typography variant="caption" color="text.secondary">
                      {constraint.note}
                    </Typography>
                  ) : null}
                </Box>
                <IconButton size="small" color="error" onClick={() => handleRemove(constraint.id)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Loại quy tắc</InputLabel>
            <Select
              label="Loại quy tắc"
              value={draftType}
              onChange={(event) => {
                const nextType = event.target.value;
                setDraftType(nextType);
                setDraftMode(
                  nextType === CONSTRAINT_TYPE.PREFER_PARTNER
                    ? CONSTRAINT_MODE.SOFT
                    : CONSTRAINT_MODE.HARD
                );
              }}
            >
              {Object.entries(CONSTRAINT_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Chế độ</InputLabel>
            <Select
              label="Chế độ"
              value={draftMode}
              onChange={(event) => setDraftMode(event.target.value)}
            >
              <MenuItem value={CONSTRAINT_MODE.SOFT}>Mềm (ưu tiên)</MenuItem>
              <MenuItem value={CONSTRAINT_MODE.HARD}>Cứng (bắt buộc)</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Autocomplete
          size="small"
          options={players}
          value={draftAnchor}
          onChange={(_, value) => setDraftAnchor(value)}
          getOptionLabel={(option) => option.name || option.id}
          renderInput={(params) => <TextField {...params} label="VĐV gốc (A)" />}
        />

        <Autocomplete
          multiple
          size="small"
          options={players.filter((player) => String(player.id) !== String(draftAnchor?.id))}
          value={draftTargets}
          onChange={(_, value) => setDraftTargets(value)}
          getOptionLabel={(option) => option.name || option.id}
          renderInput={(params) => (
            <TextField {...params} label="VĐV đích (B, C, D...)" placeholder="Chọn một hoặc nhiều" />
          )}
        />

        <TextField
          size="small"
          label="Ghi chú (tuỳ chọn)"
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
        />

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="warning" startIcon={<AddIcon />} onClick={handleAdd}>
            Thêm quy tắc
          </Button>
          {onSave ? (
            <Button variant="contained" color="warning" onClick={onSave}>
              Lưu quy tắc giải
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
    </SuperAdminFeatureGate>
  );
}
