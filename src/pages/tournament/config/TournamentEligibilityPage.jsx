import { useMemo } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

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

import { useClub } from "../../../context/ClubContext.jsx";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { getTournament } from "../../../domain/tournamentService.js";
import {
  checkAllTeamsEligibility,
} from "../../../features/team-tournament/engines/eligibilityEngine.js";
import {
  getTeamData,
  isTeamTournament,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";

export default function TournamentEligibilityPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");
  const { activeClubId, revision } = useClub();

  const tournament = useMemo(() => {
    if (!activeClubId || !tournamentId) {
      return null;
    }
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const teamData = useMemo(
    () => (tournament ? getTeamData(tournament) : null),
    [tournament]
  );

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId, revision]
  );

  const report = useMemo(() => {
    if (!teamData) {
      return null;
    }
    return checkAllTeamsEligibility(teamData, players);
  }, [teamData, players]);

  if (!tournamentId) {
    return (
      <TournamentConfigPageShell
        title="Kiểm tra điều kiện tham gia"
        description="Chọn giải đồng đội để xem báo cáo điều kiện."
        noCard
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          Vui lòng chọn giải đồng đội từ danh sách.
        </Alert>
        <Button component={RouterLink} to="/tournament/eligibility" variant="contained">
          Chọn giải
        </Button>
      </TournamentConfigPageShell>
    );
  }

  if (!tournament || !isTeamTournament(tournament) || !teamData) {
    return (
      <TournamentConfigPageShell
        title="Kiểm tra điều kiện tham gia"
        description="Không tìm thấy giải đồng đội."
        noCard
      >
        <Alert severity="warning">Giải không tồn tại hoặc không phải giải đồng đội.</Alert>
        <Button component={RouterLink} to="/tournament/eligibility" sx={{ mt: 2 }}>
          Chọn giải khác
        </Button>
      </TournamentConfigPageShell>
    );
  }

  return (
    <TournamentConfigPageShell
      title="Kiểm tra điều kiện tham gia"
      description={`${tournament.name} — đối chiếu roster với quy tắc tuổi, giới tính và trình độ.`}
      noCard
    >
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button component={RouterLink} to="/tournament/eligibility" size="small">
          Đổi giải
        </Button>
        <Button
          component={RouterLink}
          to={`/tournament/team/${tournamentId}`}
          size="small"
          variant="outlined"
        >
          Mở setup giải
        </Button>
      </Stack>

      {!report ? (
        <Alert severity="info">Chưa có dữ liệu đội để kiểm tra.</Alert>
      ) : (
        <>
          <Alert severity={report.ok ? "success" : "warning"} sx={{ mb: 2 }}>
            {report.ok
              ? "Tất cả VĐV trong roster đáp ứng điều kiện."
              : "Có VĐV chưa đáp ứng điều kiện tham gia."}
          </Alert>

          {report.teams.map((team) => (
            <Paper key={team.teamId} sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography fontWeight={700}>{team.teamName}</Typography>
                <Chip
                  size="small"
                  color={team.ok ? "success" : "warning"}
                  label={team.ok ? "Đạt" : "Chưa đạt"}
                />
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>VĐV</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Chi tiết</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {team.players.map((player) => (
                    <TableRow key={player.playerId}>
                      <TableCell>{player.playerName}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={player.ok ? "success" : "error"}
                          label={player.ok ? "Đạt" : "Không đạt"}
                        />
                      </TableCell>
                      <TableCell>
                        {player.violations.map((violation) => violation.message).join(" ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ))}
        </>
      )}
    </TournamentConfigPageShell>
  );
}
