import {
  Alert,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  getSchedulePublishStatus,
  getPublishedScheduleSnapshot,
  SCHEDULE_PUBLISH_STATUS,
} from "../../tournament/engines/publishScheduleEngine.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function resolveOpponent(match, entryId) {
  if (String(match.entryAId) === String(entryId)) return match.entryBId;
  if (String(match.entryBId) === String(entryId)) return match.entryAId;
  return null;
}

/**
 * Player-facing schedule after publish (live snapshot).
 */
export default function PlayerSchedulePanel({
  tournament,
  entryId,
  entryLabels = {},
  courts = [],
  draftMatches = null,
}) {
  const publish = getSchedulePublishStatus(tournament);
  const snapshot = getPublishedScheduleSnapshot(tournament);
  const source =
    publish.status === SCHEDULE_PUBLISH_STATUS.PUBLISHED
      ? snapshot || []
      : draftMatches || [];

  const myMatches = (source || []).filter(
    (match) =>
      String(match.entryAId) === String(entryId) ||
      String(match.entryBId) === String(entryId)
  );

  if (publish.status !== SCHEDULE_PUBLISH_STATUS.PUBLISHED) {
    return (
      <Alert severity="info">
        Lịch thi đấu chưa công bố. Sau khi BTC công bố, bạn sẽ thấy giờ / sân / đối thủ tại đây.
      </Alert>
    );
  }

  if (!entryId) {
    return null;
  }

  if (myMatches.length === 0) {
    return (
      <Alert severity="info">Chưa có trận của bạn trong lịch đã công bố.</Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Lịch thi đấu của bạn
        </Typography>
        <Chip size="small" color="success" label="Đã công bố" />
        {publish.publishedAt && (
          <Typography variant="caption" color="text.secondary">
            Cập nhật: {new Date(publish.publishedAt).toLocaleString("vi-VN")}
          </Typography>
        )}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Giờ</TableCell>
            <TableCell>Sân</TableCell>
            <TableCell>Đối thủ</TableCell>
            <TableCell>Trận</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {myMatches.map((match) => {
            const oppId = resolveOpponent(match, entryId);
            const court = courts.find((c) => String(c.id) === String(match.courtId));
            return (
              <TableRow key={match.id}>
                <TableCell>{formatTime(match.scheduledStart)}</TableCell>
                <TableCell>{court?.name || match.courtId || "—"}</TableCell>
                <TableCell>{entryLabels[oppId] || oppId || "—"}</TableCell>
                <TableCell>{match.id}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
