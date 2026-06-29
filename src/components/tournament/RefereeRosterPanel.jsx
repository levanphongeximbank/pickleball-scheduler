import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  createRefereeRosterEntry,
  removeRefereeRosterEntry,
  upsertRefereeRosterEntry,
} from "../../models/tournament/refereeRoster.js";

export default function RefereeRosterPanel({
  roster = [],
  onChange,
  title = "Danh sách trọng tài",
  description = "Thêm trọng tài trước giải — Director chọn nhanh khi gán trận hoặc sân.",
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const entry = createRefereeRosterEntry({ name: trimmed, phone: phone.trim() });
    onChange(upsertRefereeRosterEntry(roster, entry));
    setName("");
    setPhone("");
  };

  const handleRemove = (entryId) => {
    onChange(removeRefereeRosterEntry(roster, entryId));
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          label="Tên trọng tài"
          value={name}
          onChange={(event) => setName(event.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="SĐT (tuỳ chọn)"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          size="small"
          fullWidth
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!name.trim()}
          sx={{ flexShrink: 0, minWidth: { sm: 120 } }}
        >
          Thêm
        </Button>
      </Stack>

      {roster.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có trọng tài trong danh sách.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {roster.map((entry) => (
            <Paper key={entry.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography fontWeight="bold">{entry.name}</Typography>
                  {entry.phone && (
                    <Typography variant="caption" color="text.secondary">
                      {entry.phone}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip size="small" label="Sẵn sàng" color="success" variant="outlined" />
                  <IconButton size="small" color="error" onClick={() => handleRemove(entry.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
