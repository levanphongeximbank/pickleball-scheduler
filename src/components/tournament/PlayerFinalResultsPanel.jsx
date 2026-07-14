import { useMemo, useState } from "react";

import {
  Alert,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import { getPlayerAwardSummary } from "../../features/individual-tournament/engines/awardsEngine.js";
import { getTournamentSummary } from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

/**
 * Player-facing: final result, medal, award, certificate status.
 */
export default function PlayerFinalResultsPanel({ tournament, eventId = "" }) {
  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];
  const entries = event?.entries || [];
  const [entryId, setEntryId] = useState(entries[0]?.id || "");

  const summary = useMemo(
    () => (tournament && entryId ? getPlayerAwardSummary(tournament, entryId) : null),
    [tournament, entryId]
  );
  const tournamentSummary = tournament ? getTournamentSummary(tournament) : null;

  if (!tournament) {
    return <Alert severity="info">Chọn giải để xem kết quả cuối.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <TextField
          select
          size="small"
          label="Cặp / đội của tôi"
          value={entryId}
          onChange={(e) => setEntryId(e.target.value)}
          sx={{ minWidth: 240, mb: 2 }}
        >
          {entries.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name || e.id}
            </MenuItem>
          ))}
        </TextField>

        {summary ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <EmojiEventsIcon color="warning" />
              <Typography fontWeight={700}>
                Hạng cuối: {summary.finalRank || "—"}
              </Typography>
              {summary.medal ? <Chip color="primary" label={summary.medal} /> : null}
            </Stack>
            <Typography variant="body2">
              Chứng nhận: {summary.certificateStatus || "none"}
            </Typography>
            {(summary.awards || []).length === 0 ? (
              <Typography color="text.secondary">Chưa có giải thưởng gán cho đội này.</Typography>
            ) : (
              summary.awards.map((a) => (
                <Chip key={a.key} label={`${a.label}: ${a.certificateStatus}`} sx={{ mr: 1 }} />
              ))
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary">Chọn đội để xem kết quả.</Typography>
        )}
      </Paper>

      {tournamentSummary?.champion ? (
        <Alert severity="success">
          Vô địch giải: {tournamentSummary.champion.entryName || tournamentSummary.champion.entryId}
        </Alert>
      ) : null}
    </Stack>
  );
}
