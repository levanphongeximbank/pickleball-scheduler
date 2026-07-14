/**
 * S2-H — BTC awards preview/assign + close tournament.
 */

import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import DownloadIcon from "@mui/icons-material/Download";

import {
  exportAwardsCsv,
  exportAwardsJson,
  getAwardsConfig,
  getAwardsPreview,
} from "../../../features/team-tournament/engines/awardsEngine.js";
import {
  getTeamTournamentSummary,
  isTeamTournamentClosed,
  previewCloseReadiness,
} from "../../../features/team-tournament/engines/teamClosingEngine.js";
import {
  assignTeamAward,
  autoAssignTeamAwards,
  closeTeamTournamentForClub,
  updateTeamAwardsConfig,
} from "../../../features/team-tournament/services/teamTournamentService.js";

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

export default function TeamAwardsClosePanel({
  clubId,
  tournamentId,
  teamData,
  tournamentName = "",
  canManage = false,
  onUpdated,
  onError,
  onMessage,
}) {
  const [busy, setBusy] = useState(false);
  const closed = isTeamTournamentClosed(teamData);
  const preview = useMemo(
    () => (teamData ? getAwardsPreview(teamData) : { awards: [], ranking: [] }),
    [teamData]
  );
  const readiness = useMemo(
    () => (teamData ? previewCloseReadiness(teamData) : null),
    [teamData]
  );
  const summary = teamData ? getTeamTournamentSummary(teamData) : null;
  const config = teamData ? getAwardsConfig(teamData) : {};
  const teams = teamData?.teams || [];

  if (!canManage) {
    return null;
  }

  function run(action, successText) {
    setBusy(true);
    try {
      const result = action();
      if (!result?.ok) {
        onError?.(result?.error || "Thao tác thất bại.");
        return;
      }
      onMessage?.(successText);
      onUpdated?.(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      {closed ? (
        <Alert severity="success">Giải đã đóng — kết quả và bảng xếp hạng đã khóa.</Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <EmojiEventsIcon color="warning" />
          <Typography variant="subtitle1" fontWeight={700}>
            Trao giải
          </Typography>
          {preview.source ? (
            <Chip size="small" label={preview.source === "knockout_final" || preview.source?.startsWith("knockout")
              ? "Theo knockout"
              : "Theo BXH"} />
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Vô địch / Á quân ưu tiên từ trận chung kết knockout (nếu có). Fair-play gán thủ công.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            disabled={busy || closed}
            onClick={() =>
              run(
                () => autoAssignTeamAwards(clubId, tournamentId),
                "Đã gán giải từ podium."
              )
            }
          >
            Gán tự động
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={!teamData}
            onClick={() => {
              const file = exportAwardsJson(teamData);
              downloadText(file.filename, file.content, file.mimeType);
            }}
          >
            Xuất JSON
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={!teamData}
            onClick={() => {
              const file = exportAwardsCsv(teamData);
              downloadText(file.filename, file.content, file.mimeType);
            }}
          >
            Xuất CSV
          </Button>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Giải</TableCell>
              <TableCell>Đội</TableCell>
              <TableCell width={220}>Gán tay</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(preview.awards || []).map((award) => (
              <TableRow key={award.key}>
                <TableCell>
                  {award.label}
                  {award.medal ? (
                    <Chip size="small" sx={{ ml: 1 }} label={award.medal} />
                  ) : null}
                </TableCell>
                <TableCell>{award.teamName || "—"}</TableCell>
                <TableCell>
                  {award.key === "fairPlay" || !closed ? (
                    <FormControl fullWidth size="small" disabled={busy || closed}>
                      <InputLabel>Chọn đội</InputLabel>
                      <Select
                        label="Chọn đội"
                        value={award.teamId || ""}
                        onChange={(event) =>
                          run(
                            () =>
                              assignTeamAward(
                                clubId,
                                tournamentId,
                                award.key,
                                event.target.value
                              ),
                            `Đã gán ${award.label}.`
                          )
                        }
                      >
                        <MenuItem value="">
                          <em>Tự động / trống</em>
                        </MenuItem>
                        {teams.map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            {team.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
          <Typography variant="body2">Fair-play:</Typography>
          <Button
            size="small"
            disabled={busy || closed}
            onClick={() =>
              run(
                () =>
                  updateTeamAwardsConfig(clubId, tournamentId, {
                    fairPlay: {
                      ...config.fairPlay,
                      enabled: !config.fairPlay?.enabled,
                    },
                  }),
                config.fairPlay?.enabled ? "Đã tắt fair-play." : "Đã bật fair-play."
              )
            }
          >
            {config.fairPlay?.enabled ? "Tắt fair-play" : "Bật fair-play"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Đóng giải đấu
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Khóa kết quả, đóng băng BXH, gán giải tự động (nếu chưa), tạo tóm tắt.
        </Typography>
        {readiness && readiness.pendingMatchupCount > 0 && !closed ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Còn {readiness.pendingMatchupCount} trận chưa có đội thắng — vẫn có thể đóng nếu BTC
            xác nhận.
          </Alert>
        ) : null}
        <Button
          variant="contained"
          color="error"
          startIcon={<LockIcon />}
          disabled={busy || closed}
          onClick={() =>
            run(
              () =>
                closeTeamTournamentForClub(clubId, tournamentId, {
                  autoAwards: true,
                }),
              "Đã đóng giải đồng đội."
            )
          }
        >
          {closed ? "Đã đóng giải" : "Đóng giải ngay"}
        </Button>
      </Paper>

      {summary ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Tóm tắt giải {tournamentName ? `— ${tournamentName}` : ""}
          </Typography>
          <Typography variant="body2">
            Đội: {summary.teamCount} · Trận xong: {summary.completedMatchupCount}/
            {summary.matchupCount}
          </Typography>
          <Typography variant="body2">
            Vô địch: {summary.champion?.teamName || "—"}
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
