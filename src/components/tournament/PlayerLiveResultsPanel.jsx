import { useMemo } from "react";

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

import { collectEventMatches } from "../../features/individual-tournament/engines/refereeAssignEngine.js";
import { getLiveStandings } from "../../features/individual-tournament/engines/resultPropagationEngine.js";
import { getMatchResult } from "../../features/individual-tournament/engines/matchResultEngine.js";

/**
 * Player-facing: live results + standings snapshot + knockout progress hint.
 */
export default function PlayerLiveResultsPanel({ tournament, eventId = "" }) {
  const matches = useMemo(() => {
    if (!tournament) return [];
    return collectEventMatches(tournament, eventId).filter(
      (m) =>
        m.status === "completed" ||
        m.status === "forfeit" ||
        m.status === "playing" ||
        m.locked
    );
  }, [tournament, eventId]);

  const live = tournament ? getLiveStandings(tournament, eventId) : null;
  const groups = live?.groups || [];

  if (!tournament) {
    return <Alert severity="info">Chọn giải để xem kết quả live.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Kết quả trực tiếp
        </Typography>
        {live?.updatedAt ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Cập nhật bảng xếp hạng: {new Date(live.updatedAt).toLocaleString("vi-VN")}
          </Typography>
        ) : null}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>Tỷ số</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">Chưa có kết quả.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              matches.map((match) => {
                const stored = getMatchResult(tournament, match.id);
                return (
                  <TableRow key={match.id}>
                    <TableCell>
                      {match.entryAId} vs {match.entryBId}
                      {match.stage === "third_place" || stored?.isThirdPlace ? (
                        <Chip size="small" label="Hạng 3" sx={{ ml: 1 }} />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {match.scoreA ?? stored?.scoreA ?? "—"} :{" "}
                      {match.scoreB ?? stored?.scoreB ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={
                          match.locked || stored?.locked
                            ? "success"
                            : match.status === "playing"
                              ? "info"
                              : "default"
                        }
                        label={
                          match.locked || stored?.locked
                            ? "Đã chốt"
                            : match.status || stored?.status || "—"
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      {groups.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Bảng xếp hạng (cập nhật sau kết quả)
          </Typography>
          {groups.map((group) => (
            <Stack key={group.groupId || group.group || "g"} spacing={0.5} sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>
                Bảng {group.groupId || group.group || ""}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Đội</TableCell>
                    <TableCell>W</TableCell>
                    <TableCell>L</TableCell>
                    <TableCell>Điểm</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(group.standing || group.rows || []).map((row, index) => (
                    <TableRow key={row.entryId || row.id || index}>
                      <TableCell>{row.rank ?? index + 1}</TableCell>
                      <TableCell>{row.name || row.entryId || row.id}</TableCell>
                      <TableCell>{row.won ?? row.wins ?? "—"}</TableCell>
                      <TableCell>{row.lost ?? row.losses ?? "—"}</TableCell>
                      <TableCell>{row.matchPoints ?? row.points ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ))}
        </Paper>
      ) : null}

      {tournament.events?.[0]?.bracket?.rounds?.length ? (
        <Alert severity="success">
          Nhánh knockout đã được cập nhật theo kết quả mới nhất (auto advance).
        </Alert>
      ) : null}
    </Stack>
  );
}
