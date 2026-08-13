import { useMemo } from "react";
import {
  Alert,
  Button,
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
  summarizeOfficialEntries,
  buildOfficialDrawBlockMessage,
  projectOfficialFinalizationBuckets,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { isRegistrationLocked } from "../../../features/individual-tournament/engines/registrationEngine.js";
import { ENTRY_STATUS_LABELS } from "../../../models/tournament/constants.js";
import { isDrawEligibleEntry } from "../../../models/tournament/entry.js";

function resolvePlayerName(playersById, playerId) {
  const player = playersById.get(String(playerId || ""));
  return player?.name || player?.displayName || playerId || "—";
}

function resolveEntryLevel(entry, playersById) {
  if (entry?.rating != null && entry.rating !== "") return entry.rating;
  if (entry?.pairRating != null && entry.pairRating !== "") return entry.pairRating;
  if (entry?.level != null && entry.level !== "") return entry.level;
  const ids = entry?.playerIds || [];
  if (ids.length === 1) {
    const player = playersById.get(String(ids[0]));
    return (
      player?.skillLevel ??
      player?.level ??
      player?.displayRating ??
      player?.elo ??
      "—"
    );
  }
  return "—";
}

function resolveSource(entry) {
  if (entry?.sourceLabel) return entry.sourceLabel;
  if (entry?.source) return String(entry.source);
  if (entry?.registeredOnline) return "Online";
  if (entry?.addedByOrganizer) return "BTC thêm";
  return "Hệ thống";
}

function EntryBucketTable({
  title,
  color,
  rows,
  isPair,
  playersById,
  emptyLabel,
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Chip size="small" color={color} label={`${rows.length}`} />
      </Stack>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {isPair ? (
                <>
                  <TableCell>VĐV A</TableCell>
                  <TableCell>VĐV B</TableCell>
                  <TableCell>Cặp</TableCell>
                </>
              ) : (
                <TableCell>VĐV</TableCell>
              )}
              <TableCell>Trình độ</TableCell>
              <TableCell>Nguồn</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ghi chú</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((entry) => {
              const ids = entry.playerIds || [];
              const eligible = isDrawEligibleEntry(entry);
              return (
                <TableRow key={entry.id}>
                  {isPair ? (
                    <>
                      <TableCell>{resolvePlayerName(playersById, ids[0])}</TableCell>
                      <TableCell>{resolvePlayerName(playersById, ids[1])}</TableCell>
                      <TableCell>{entry.name || "—"}</TableCell>
                    </>
                  ) : (
                    <TableCell>
                      {entry.name || resolvePlayerName(playersById, ids[0])}
                    </TableCell>
                  )}
                  <TableCell>{resolveEntryLevel(entry, playersById)}</TableCell>
                  <TableCell>{resolveSource(entry)}</TableCell>
                  <TableCell>
                    {ENTRY_STATUS_LABELS[entry.status] || entry.status || "—"}
                  </TableCell>
                  <TableCell>
                    {entry.rejectionReason ||
                      (!eligible && entry.status !== "pending"
                        ? "Không đủ ĐK bốc thăm"
                        : eligible
                          ? "Đủ ĐK"
                          : "Chờ xử lý")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

/**
 * Participant finalization — derived projection, no duplicate persisted list.
 */
export default function OfficialTournamentFinalizeScreen({
  tournament,
  eventId = "",
  players = [],
  canManage = true,
  onLockRegistration,
}) {
  const competition = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const summary = useMemo(
    () => summarizeOfficialEntries(tournament, eventId),
    [tournament, eventId]
  );
  const buckets = useMemo(
    () => projectOfficialFinalizationBuckets(tournament, eventId),
    [tournament, eventId]
  );
  const locked = isRegistrationLocked(tournament);
  const gate = buildOfficialDrawBlockMessage(
    tournament?.events?.find((e) => String(e.id) === String(eventId))?.entries ||
      tournament?.events?.[0]?.entries ||
      [],
    tournament,
    2
  );
  const isPair = competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR;
  const unitLabel = isPair ? "cặp" : "VĐV";
  const playersById = useMemo(
    () => new Map((players || []).map((player) => [String(player.id), player])),
    [players]
  );

  const countMismatch =
    buckets.counts.eligible !== summary.drawEligibleCount ||
    buckets.counts.pending !== summary.pending + summary.waitlisted ||
    buckets.counts.total !== summary.total;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]} />
        <Chip color="success" label={`Hợp lệ: ${summary.drawEligibleCount} ${unitLabel}`} />
        <Chip color="warning" label={`Chờ duyệt: ${summary.pending + summary.waitlisted}`} />
        <Chip
          label={`Không hợp lệ/rút: ${
            summary.rejected + summary.withdrawn + summary.cancelled
          }`}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Đăng ký nhận được: {summary.total} · Đủ điều kiện: {summary.drawEligibleCount} · Chưa hoàn
        tất: {summary.pending + summary.waitlisted}
      </Typography>

      {countMismatch ? (
        <Alert severity="warning">
          Số liệu tổng hợp và danh sách hiển thị không khớp — kiểm tra lại dữ liệu đăng ký.
        </Alert>
      ) : null}

      <EntryBucketTable
        title="ĐỦ ĐIỀU KIỆN"
        color="success"
        rows={buckets.eligible}
        isPair={isPair}
        playersById={playersById}
        emptyLabel="Chưa có hồ sơ đủ điều kiện bốc thăm."
      />
      <EntryBucketTable
        title="CHỜ XỬ LÝ"
        color="warning"
        rows={buckets.pending}
        isPair={isPair}
        playersById={playersById}
        emptyLabel="Không có hồ sơ chờ duyệt / waitlist."
      />
      <EntryBucketTable
        title="KHÔNG HỢP LỆ / ĐÃ RÚT"
        color="default"
        rows={buckets.ineligible}
        isPair={isPair}
        playersById={playersById}
        emptyLabel="Không có hồ sơ từ chối / rút / hủy."
      />

      {!gate.ok ? <Alert severity="warning">{gate.error}</Alert> : null}
      {locked ? (
        <Alert severity="success">
          Đã chốt đăng ký. Danh sách đủ điều kiện là đầu vào bước Bốc thăm.
        </Alert>
      ) : (
        <Alert severity="info">
          Chốt VĐV khóa hồ sơ mới và dùng danh sách đủ điều kiện làm đầu vào bốc thăm.
        </Alert>
      )}

      <Button
        variant="contained"
        disabled={!canManage || locked || !gate.ok}
        onClick={onLockRegistration}
      >
        {locked ? "Đã chốt" : "Chốt vận động viên"}
      </Button>
    </Stack>
  );
}
