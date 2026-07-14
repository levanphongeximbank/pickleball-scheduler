import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  ENTRY_STATUS,
  ENTRY_STATUS_LABELS,
} from "../../models/tournament/index.js";
import {
  getRegistrationSettings,
  isRegistrationLocked,
  lockRegistration,
  rejectEntry,
  setRegistrationWindow,
  waitlistEntry,
  gatedApproveEntry,
  gatedPromoteFromWaitlist,
  getEntryFee,
  canApproveWithFee,
  organizerOverridePayment,
  PAYMENT_STATUS,
  getEntryPayment,
  resolveFeeAmount,
} from "../../features/individual-tournament/index.js";

function statusColor(status) {
  switch (status) {
    case ENTRY_STATUS.APPROVED:
    case ENTRY_STATUS.ACTIVE:
      return "success";
    case ENTRY_STATUS.PENDING:
      return "warning";
    case ENTRY_STATUS.WAITLISTED:
      return "info";
    case ENTRY_STATUS.REJECTED:
    case ENTRY_STATUS.CANCELLED:
      return "error";
    default:
      return "default";
  }
}

export default function RegistrationOpsPanel({
  tournament,
  event,
  players = [],
  onPersist,
  actor = null,
  clubId = null,
}) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const settings = getRegistrationSettings(tournament);
  const locked = isRegistrationLocked(tournament);

  const [opensAt, setOpensAt] = useState(settings.opensAt ? settings.opensAt.slice(0, 16) : "");
  const [closesAt, setClosesAt] = useState(settings.closesAt ? settings.closesAt.slice(0, 16) : "");
  const [maxEntries, setMaxEntries] = useState(
    settings.maxEntries != null ? String(settings.maxEntries) : ""
  );

  const entries = event?.entries || [];
  const pending = useMemo(
    () => entries.filter((entry) => entry.status === ENTRY_STATUS.PENDING),
    [entries]
  );
  const waitlisted = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === ENTRY_STATUS.WAITLISTED)
        .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0)),
    [entries]
  );
  const approved = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status === ENTRY_STATUS.APPROVED || entry.status === ENTRY_STATUS.ACTIVE
      ),
    [entries]
  );

  const playerName = (playerId) =>
    players.find((player) => String(player.id) === String(playerId))?.name || playerId;

  const runPersist = (result, successMessage) => {
    setError(null);
    setMessage(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const saved = onPersist?.(result.tournament);
    if (saved === false) {
      setError("Không lưu được giải.");
      return;
    }
    setMessage(successMessage);
  };

  const handleSaveWindow = () => {
    const result = setRegistrationWindow(
      tournament,
      {
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        maxEntries: maxEntries === "" ? null : Number(maxEntries),
      },
      { actor, clubId, userId: actor?.id }
    );
    runPersist(result, "Đã lưu cửa sổ đăng ký.");
  };

  const handleLock = () => {
    runPersist(
      lockRegistration(tournament, { actor, clubId, userId: actor?.id }),
      "Đã khóa đăng ký."
    );
  };

  const optionBag = actor
    ? { actor, clubId, userId: actor.id, eventId: event?.id, players }
    : { clubId, eventId: event?.id, players };

  const fee = getEntryFee(tournament);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        Đăng ký VĐV (S1-B/C)
      </Typography>

      {fee.enabled && (
        <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
          Lệ phí: {resolveFeeAmount(tournament).amount} {fee.currency}
          {fee.requirePaidToApprove ? " · Duyệt yêu cầu đã thanh toán" : ""}
        </Alert>
      )}

      {locked && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Đăng ký đã khóa
          {settings.lockedAt
            ? ` lúc ${new Date(settings.lockedAt).toLocaleString("vi-VN")}`
            : " (giải sẵn sàng / draw đã công bố)"}
          .
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          Cửa sổ đăng ký
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label="Mở lúc"
            type="datetime-local"
            size="small"
            value={opensAt}
            onChange={(event_) => setOpensAt(event_.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={locked}
          />
          <TextField
            label="Đóng lúc"
            type="datetime-local"
            size="small"
            value={closesAt}
            onChange={(event_) => setClosesAt(event_.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={locked}
          />
          <TextField
            label="Sức chứa"
            size="small"
            value={maxEntries}
            onChange={(event_) => setMaxEntries(event_.target.value)}
            fullWidth
            disabled={locked}
            helperText="Hết suất → waitlist"
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" onClick={handleSaveWindow} disabled={locked}>
            Lưu cửa sổ
          </Button>
          <Button size="small" variant="contained" color="warning" onClick={handleLock} disabled={locked}>
            Khóa đăng ký
          </Button>
          <Chip size="small" label={`Đã duyệt: ${approved.length}`} color="success" variant="outlined" />
          <Chip size="small" label={`Chờ duyệt: ${pending.length}`} color="warning" variant="outlined" />
          <Chip size="small" label={`Waitlist: ${waitlisted.length}`} color="info" variant="outlined" />
        </Stack>
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
        Hàng đợi duyệt
      </Typography>
      {pending.length === 0 && waitlisted.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Không có đăng ký chờ xử lý.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {[...pending, ...waitlisted].map((entry) => (
            <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" fontWeight="bold">
                      {entry.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={ENTRY_STATUS_LABELS[entry.status] || entry.status}
                      color={statusColor(entry.status)}
                    />
                    {entry.waitlistPosition != null && (
                      <Chip size="small" label={`#${entry.waitlistPosition}`} variant="outlined" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {(entry.playerIds || []).map(playerName).join(" · ")}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={locked}
                    onClick={() =>
                      runPersist(
                        gatedApproveEntry(tournament, entry.id, optionBag),
                        `Đã duyệt ${entry.name}.`
                      )
                    }
                  >
                    Duyệt
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={locked}
                    onClick={() =>
                      runPersist(
                        waitlistEntry(tournament, entry.id, optionBag),
                        `Đã chuyển ${entry.name} sang waitlist.`
                      )
                    }
                  >
                    Waitlist
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={locked}
                    onClick={() =>
                      runPersist(
                        rejectEntry(tournament, entry.id, optionBag),
                        `Đã từ chối ${entry.name}.`
                      )
                    }
                  >
                    Từ chối
                  </Button>
                  {entry.status === ENTRY_STATUS.WAITLISTED && (
                    <Button
                      size="small"
                      color="success"
                      variant="outlined"
                      disabled={locked}
                      onClick={() =>
                        runPersist(
                          gatedPromoteFromWaitlist(tournament, {
                            ...optionBag,
                            entryId: entry.id,
                          }),
                          `Đã promote ${entry.name}.`
                        )
                      }
                    >
                      Promote
                    </Button>
                  )}
                  {fee.enabled && fee.requirePaidToApprove && !canApproveWithFee(tournament, entry.id).ok && (
                    <Button
                      size="small"
                      color="secondary"
                      variant="outlined"
                      disabled={locked}
                      onClick={() =>
                        runPersist(
                          organizerOverridePayment(tournament, entry.id, PAYMENT_STATUS.WAIVED, {
                            userId: actor?.id,
                            actor,
                            playerCount: entry.playerIds?.length || 1,
                          }),
                          `Đã miễn phí (override) cho ${entry.name}.`
                        )
                      }
                    >
                      Miễn phí
                    </Button>
                  )}
                  {fee.enabled && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={getEntryPayment(tournament, entry.id).status}
                    />
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {(settings.auditLog || []).length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Audit gần nhất: {settings.auditLog[settings.auditLog.length - 1]?.action} ·{" "}
            {new Date(settings.auditLog[settings.auditLog.length - 1]?.timestamp).toLocaleString(
              "vi-VN"
            )}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
