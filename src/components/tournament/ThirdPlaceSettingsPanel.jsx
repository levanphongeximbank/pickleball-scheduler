import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  generateThirdPlaceForTournament,
  isThirdPlaceEnabled,
  setThirdPlaceEnabled,
} from "../../features/individual-tournament/engines/thirdPlaceEngine.js";
import { MATCH_STAGE } from "../../models/tournament/constants.js";

export default function ThirdPlaceSettingsPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const enabled = tournament ? isThirdPlaceEnabled(tournament) : true;

  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];

  const thirdMatch = useMemo(
    () =>
      (event?.matches || []).find(
        (m) => m.stage === MATCH_STAGE.THIRD_PLACE || m.isThirdPlace
      ) || null,
    [event]
  );

  const toggle = (checked) => {
    const result = setThirdPlaceEnabled(tournament, checked, { actor });
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: checked ? "Đã bật tranh hạng ba." : "Đã tắt tranh hạng ba.",
    });
  };

  const generate = () => {
    const result = generateThirdPlaceForTournament(tournament, {
      eventId: event?.id || eventId,
      actor,
      force: true,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: result.created
        ? "Đã tạo / cập nhật trận tranh hạng ba."
        : "Trận tranh hạng ba đã sẵn sàng.",
    });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để cấu hình tranh hạng ba.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} />}
          label="Bật trận tranh hạng ba (optional playoff)"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          Khi có bán kết, hệ thống tạo trận H3 và gán HCĐ cho người thắng; hạng 4 = thua H3.
        </Typography>
        <Button variant="contained" onClick={generate} disabled={!enabled}>
          Tạo / đồng bộ trận hạng ba
        </Button>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Trạng thái trận H3
        </Typography>
        {thirdMatch ? (
          <Stack spacing={0.5}>
            <Typography>
              {thirdMatch.entryAId || "TBD"} vs {thirdMatch.entryBId || "TBD"}
            </Typography>
            <Chip size="small" label={thirdMatch.status || "waiting"} sx={{ width: "fit-content" }} />
            {(thirdMatch.scoreA != null || thirdMatch.winnerId) && (
              <Typography variant="body2">
                Kết quả: {thirdMatch.scoreA ?? "—"}:{thirdMatch.scoreB ?? "—"} · Thắng:{" "}
                {thirdMatch.winnerId || "—"}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary">Chưa có trận tranh hạng ba.</Typography>
        )}
      </Paper>
    </Stack>
  );
}
