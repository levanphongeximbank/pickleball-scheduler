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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DownloadIcon from "@mui/icons-material/Download";

import {
  AWARD_KEY,
  assignAward,
  autoAssignAwardsFromRanking,
  buildAwardsPreview,
  exportAwardsCsv,
  exportAwardsJson,
  getAwardsConfig,
  updateAwardsConfig,
} from "../../features/individual-tournament/engines/awardsEngine.js";
import { isTournamentClosed } from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

function downloadText(filename, content, mimeType) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AwardManagerPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const closed = tournament ? isTournamentClosed(tournament) : false;

  const preview = useMemo(
    () => (tournament ? buildAwardsPreview(tournament, { eventId }) : { awards: [], ranking: [] }),
    [tournament, eventId]
  );
  const config = tournament ? getAwardsConfig(tournament) : {};

  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];
  const entries = event?.entries || [];

  const toggleOptional = (key, enabled) => {
    const result = updateAwardsConfig(tournament, {
      [key]: { ...config[key], enabled },
    });
    onTournamentChange?.(result.tournament);
  };

  const autoAssign = () => {
    const result = autoAssignAwardsFromRanking(tournament, { eventId, actor });
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: "Đã gán giải từ thứ hạng cuối." });
  };

  const manualAssign = (awardKey, entryId) => {
    const result = assignAward(tournament, awardKey, entryId, {
      actor,
      allowWhenClosed: false,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: `Đã gán ${awardKey}.` });
  };

  const exportJson = () => {
    const file = exportAwardsJson(tournament, { eventId });
    downloadText(file.filename, file.content, file.mimeType);
  };

  const exportCsv = () => {
    const file = exportAwardsCsv(tournament, { eventId });
    downloadText(file.filename, file.content, file.mimeType);
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để quản lý trao giải.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={config[AWARD_KEY.SPORTSMANSHIP]?.enabled === true}
                onChange={(e) => toggleOptional(AWARD_KEY.SPORTSMANSHIP, e.target.checked)}
                disabled={closed}
              />
            }
            label="Fair-play / Thể thao"
          />
          <FormControlLabel
            control={
              <Switch
                checked={config[AWARD_KEY.MVP]?.enabled === true}
                onChange={(e) => toggleOptional(AWARD_KEY.MVP, e.target.checked)}
                disabled={closed}
              />
            }
            label="MVP"
          />
          <Button variant="contained" onClick={autoAssign} disabled={closed}>
            Tự động gán từ podium
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={exportJson}>
            Export JSON
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={exportCsv}>
            Export CSV
          </Button>
        </Stack>
      </Paper>

      <Stack spacing={1}>
        {preview.awards.map((award) => (
          <Paper key={award.key} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <EmojiEventsIcon color="warning" />
              <Typography fontWeight={700}>{award.label}</Typography>
              {award.auto ? <Chip size="small" label="Tự động" /> : null}
              {award.medal ? <Chip size="small" color="primary" label={award.medal} /> : null}
              <Chip size="small" label={`Cert: ${award.certificateStatus}`} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <Typography sx={{ minWidth: 160 }}>
                {award.entryName || "Chưa xác định"}
              </Typography>
              <TextField
                select
                size="small"
                label="Gán thủ công"
                value={award.entryId || ""}
                onChange={(e) => manualAssign(award.key, e.target.value)}
                sx={{ minWidth: 200 }}
                disabled={closed && award.key !== AWARD_KEY.SPORTSMANSHIP}
              >
                <MenuItem value="">—</MenuItem>
                {entries.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name || e.id}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Paper sx={{ overflowX: "auto" }}>
        <Typography variant="subtitle2" sx={{ p: 1.5, pb: 0 }}>
          Thứ hạng cuối
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Hạng</TableCell>
              <TableCell>Đội</TableCell>
              <TableCell>Huy chương</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(preview.ranking || []).map((row) => (
              <TableRow key={`${row.rank}-${row.entryId}`}>
                <TableCell>{row.rank}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.medal || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
