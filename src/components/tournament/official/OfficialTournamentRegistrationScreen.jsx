import { useMemo } from "react";
import {
  Alert,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import RegistrationOpsPanel from "../RegistrationOpsPanel.jsx";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { ENTRY_STATUS_LABELS } from "../../../models/tournament/constants.js";
import { isDrawEligibleEntry } from "../../../models/tournament/entry.js";

function resolvePlayerName(playersById, playerId) {
  const player = playersById.get(String(playerId || ""));
  return player?.name || player?.displayName || playerId || "—";
}

function resolveEntrySource(entry) {
  if (entry?.sourceLabel) return entry.sourceLabel;
  if (entry?.source) return String(entry.source);
  if (entry?.registeredOnline) return "Online";
  if (entry?.addedByOrganizer) return "BTC thêm";
  return "Hệ thống";
}

/**
 * Registration-only screen. No draw/group/bracket controls.
 */
export default function OfficialTournamentRegistrationScreen({
  tournament,
  event,
  players = [],
  actor = null,
  clubId = null,
  onPersist,
  registrationChildren = null,
}) {
  const competition = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const isPair = competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR;
  const entries = event?.entries || [];
  const playersById = useMemo(
    () => new Map((players || []).map((player) => [String(player.id), player])),
    [players]
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          color="primary"
          label={OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]}
        />
        <Chip size="small" variant="outlined" label={`${entries.length} hồ sơ`} />
      </Stack>

      <Alert severity="info">
        Màn hình này chỉ quản lý đăng ký. Bốc thăm nằm ở bước riêng sau khi chốt VĐV.
      </Alert>

      <RegistrationOpsPanel
        tournament={tournament}
        event={event}
        players={players}
        actor={actor}
        clubId={clubId}
        onPersist={onPersist}
      />

      {registrationChildren}

      <Typography variant="subtitle2" fontWeight={700}>
        {isPair ? "Danh sách cặp đăng ký" : "Danh sách VĐV đăng ký"}
      </Typography>
      {entries.length === 0 ? (
        <Alert severity="info">Chưa có VĐV đăng ký</Alert>
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
              <TableCell>Đủ ĐK</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => {
              const ids = entry.playerIds || [];
              const rating =
                entry.rating ??
                entry.pairRating ??
                entry.level ??
                "—";
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
                  <TableCell>{rating}</TableCell>
                  <TableCell>{resolveEntrySource(entry)}</TableCell>
                  <TableCell>
                    {ENTRY_STATUS_LABELS[entry.status] || entry.status || "—"}
                  </TableCell>
                  <TableCell>{isDrawEligibleEntry(entry) ? "Có" : "Không"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
