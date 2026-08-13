import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  REFEREE_ROSTER_SOURCE,
  addCanonicalRefereeToRoster,
  createRefereeRosterEntry,
  findRosterEntryByCanonicalUserId,
  removeRefereeRosterEntry,
  upsertRefereeRosterEntry,
} from "../../models/tournament/refereeRoster.js";

/**
 * Tournament / Daily Play referee roster editor.
 *
 * Supports:
 * - Canonical authenticated REFEREE account selection (when candidates provided)
 * - Manual / guest free-text entries (backward compatible)
 *
 * onChange may be sync or async; returns false/{ok:false} to keep form values.
 */
export default function RefereeRosterPanel({
  roster = [],
  onChange,
  title = "Danh sách trọng tài",
  description = "Thêm trọng tài trước giải — Director chọn nhanh khi gán trận hoặc sân.",
  pending: pendingProp = false,
  canonicalCandidates = null,
  canonicalLoading = false,
  canonicalError = null,
  canonicalWarning = null,
  enableCanonicalDirectory = false,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [candidatePick, setCandidatePick] = useState(null);
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState(null);
  const pending = Boolean(pendingProp || localPending);

  const showCanonical = Boolean(enableCanonicalDirectory);

  const availableCandidates = useMemo(() => {
    if (!showCanonical || !Array.isArray(canonicalCandidates)) {
      return [];
    }
    return canonicalCandidates.filter(
      (candidate) => !findRosterEntryByCanonicalUserId(roster, candidate.userId)
    );
  }, [canonicalCandidates, roster, showCanonical]);

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

  const handleAddCanonical = async () => {
    if (!candidatePick || pending) {
      return;
    }
    const result = addCanonicalRefereeToRoster(roster, candidatePick);
    if (!result.ok) {
      setLocalError(result.error || "Không thêm được tài khoản trọng tài.");
      return;
    }
    const ok = await commitChange(result.roster);
    if (ok) {
      setCandidatePick(null);
    }
  };

  const handleAddManual = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) {
      return;
    }

    const entry = createRefereeRosterEntry({
      name: trimmed,
      phone: phone.trim(),
      source: REFEREE_ROSTER_SOURCE.MANUAL,
    });
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
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="referee-roster-panel">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      {(localError || canonicalError) && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          onClose={() => setLocalError(null)}
        >
          {localError || canonicalError}
        </Alert>
      )}

      {canonicalWarning && !canonicalError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {canonicalWarning}
        </Alert>
      )}

      {showCanonical && (
        <Box sx={{ mb: 2 }} data-testid="referee-canonical-directory">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tài khoản trọng tài
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Autocomplete
              fullWidth
              size="small"
              options={availableCandidates}
              loading={canonicalLoading}
              value={candidatePick}
              onChange={(_event, value) => setCandidatePick(value)}
              getOptionLabel={(option) =>
                option?.displayName || option?.email || "Trọng tài"
              }
              isOptionEqualToValue={(option, value) =>
                String(option?.userId) === String(value?.userId)
              }
              disabled={pending || canonicalLoading}
              renderOption={(props, option) => (
                <li {...props} key={option.userId}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {option.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[option.email, option.phone].filter(Boolean).join(" · ") ||
                        "Đã có tài khoản"}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tìm / chọn tài khoản trọng tài"
                  placeholder="Tên, email hoặc SĐT"
                />
              )}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => void handleAddCanonical()}
              disabled={!candidatePick || pending}
              sx={{ flexShrink: 0, minWidth: { sm: 140 } }}
              data-testid="referee-add-canonical"
            >
              {pending ? "Đang lưu..." : "Thêm tài khoản"}
            </Button>
          </Stack>
          {!canonicalLoading &&
            Array.isArray(canonicalCandidates) &&
            canonicalCandidates.length === 0 &&
            !canonicalError && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Không có tài khoản REFEREE đủ điều kiện trong tenant/CLB hiện tại.
              </Typography>
            )}
        </Box>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {showCanonical ? "Trọng tài khách / nhập tay" : "Thêm trọng tài"}
      </Typography>

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
          variant={showCanonical ? "outlined" : "contained"}
          startIcon={<AddIcon />}
          onClick={() => void handleAddManual()}
          disabled={!name.trim() || pending}
          sx={{ flexShrink: 0, minWidth: { sm: 120 } }}
          data-testid="referee-add-manual"
        >
          {pending ? "Đang lưu..." : "Thêm"}
        </Button>
      </Stack>

      {roster.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {showCanonical
            ? "Chưa có trọng tài trong danh sách. Chọn tài khoản REFEREE hoặc thêm trọng tài khách."
            : "Chưa có trọng tài trong danh sách giải. Danh sách này là roster vận hành của buổi chơi (tên/SĐT), không tự lấy từ tài khoản đăng nhập REFEREE."}
        </Typography>
      ) : (
        <Stack spacing={1} data-testid="referee-roster-assigned">
          {roster.map((entry) => {
            const isCanonical =
              entry.source === REFEREE_ROSTER_SOURCE.CANONICAL_ACCOUNT ||
              Boolean(entry.canonicalUserId);
            const unavailable = entry.eligibility === "unavailable";
            return (
              <Paper key={entry.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography fontWeight="bold">{entry.name}</Typography>
                    {(entry.phone || entry.email) && (
                      <Typography variant="caption" color="text.secondary">
                        {[entry.email, entry.phone].filter(Boolean).join(" · ")}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {isCanonical ? (
                      <Chip
                        size="small"
                        label={unavailable ? "Tài khoản không còn đủ điều kiện" : "Đã có tài khoản"}
                        color={unavailable ? "warning" : "info"}
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        size="small"
                        label="Nhập tay"
                        color="default"
                        variant="outlined"
                      />
                    )}
                    {!unavailable && (
                      <Chip size="small" label="Sẵn sàng" color="success" variant="outlined" />
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      disabled={pending}
                      onClick={() => void handleRemove(entry.id)}
                      aria-label={`Xóa ${entry.name}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
