import { useState } from "react";
import {
  Alert,
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

/**
 * Free-text tournament referee roster editor.
 * This is NOT an authenticated referee-account directory.
 * onChange may be sync or async; returns false/{ok:false} to keep form values.
 */
export default function RefereeRosterPanel({
  roster = [],
  onChange,
  title = "Danh sách trọng tài",
  description = "Thêm trọng tài trước giải — Director chọn nhanh khi gán trận hoặc sân.",
  pending: pendingProp = false,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState(null);
  const pending = Boolean(pendingProp || localPending);

  const commitChange = async (nextRoster) => {
    if (typeof onChange !== "function") return true;
    setLocalError(null);
    setLocalPending(true);
    try {
      const result = await Promise.resolve(onChange(nextRoster));
      if (result === false || result?.ok === false) {
        setLocalError(
          result?.error || "Không lưu được danh sách trọng tài."
        );
        return false;
      }
      return true;
    } catch (error) {
      setLocalError(String(error?.message || error || "Không lưu được danh sách trọng tài."));
      return false;
    } finally {
      setLocalPending(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) {
      return;
    }

    const entry = createRefereeRosterEntry({ name: trimmed, phone: phone.trim() });
    const ok = await commitChange(upsertRefereeRosterEntry(roster, entry));
    if (ok) {
      setName("");
      setPhone("");
    }
  };

  const handleRemove = async (entryId) => {
    if (pending) return;
    await commitChange(removeRefereeRosterEntry(roster, entryId));
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      {localError && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setLocalError(null)}>
          {localError}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          label="Tên trọng tài"
          value={name}
          onChange={(event) => setName(event.target.value)}
          size="small"
          fullWidth
          disabled={pending}
        />
        <TextField
          label="SĐT (tuỳ chọn)"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          size="small"
          fullWidth
          disabled={pending}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => void handleAdd()}
          disabled={!name.trim() || pending}
          sx={{ flexShrink: 0, minWidth: { sm: 120 } }}
        >
          {pending ? "Đang lưu..." : "Thêm"}
        </Button>
      </Stack>

      {roster.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có trọng tài trong danh sách giải. Danh sách này là roster vận hành của
          buổi chơi (tên/SĐT), không tự lấy từ tài khoản đăng nhập REFEREE.
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
                  <IconButton
                    size="small"
                    color="error"
                    disabled={pending}
                    onClick={() => void handleRemove(entry.id)}
                  >
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
