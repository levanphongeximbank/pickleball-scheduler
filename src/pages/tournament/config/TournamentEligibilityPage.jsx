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
import { isIndividualTournament, isTeamTournament } from "../../../config/tournamentRoutes.js";
import { checkAllEntriesEligibility } from "../../../features/individual-tournament/engines/eligibilityEngine.js";
import {
  checkAllTeamsEligibility,
} from "../../../features/team-tournament/engines/eligibilityEngine.js";
import {
  getTeamData,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";

export default function TournamentEligibilityPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");
  const { activeClubId, revision } = useClub();

  const tournament = useMemo(() => {
    if (!activeClubId || !tournamentId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId, revision]
  );

  const individualReport = useMemo(() => {
    if (!tournament || !isIndividualTournament(tournament)) return null;
    return checkAllEntriesEligibility(tournament, players);
  }, [tournament, players]);

  const teamData = useMemo(
    () => (tournament && isTeamTournament(tournament) ? getTeamData(tournament) : null),
    [tournament]
  );

  const teamReport = useMemo(() => {
    if (!teamData) return null;
    return checkAllTeamsEligibility(teamData, players);
  }, [teamData, players]);

  if (!tournamentId) {
    return (
      <TournamentConfigPageShell
        title="Kiểm tra điều kiện tham gia"
        description="Chọn giải để xem báo cáo điều kiện."
        noCard
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          Chọn giải từ hub điều kiện tham gia.
        </Alert>
        <Button component={RouterLink} to="/tournament/eligibility" variant="contained">
          Chọn giải
        </Button>
      </TournamentConfigPageShell>
    );
  }

  if (!tournament) {
    return (
      <TournamentConfigPageShell title="Kiểm tra điều kiện tham gia" description="Không tìm thấy giải.">
        <Alert severity="error">Giải không tồn tại.</Alert>
      </TournamentConfigPageShell>
    );
  }

  if (isIndividualTournament(tournament) && individualReport) {
    const failed = individualReport.rows.filter((row) => !row.ok);
    return (
      <TournamentConfigPageShell
        title="Kiểm tra điều kiện — giải cá nhân"
        description={tournament.name}
      >
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
          <Chip
            label={individualReport.ok ? "Tất cả đạt" : `${failed.length} đăng ký chưa đạt`}
            color={individualReport.ok ? "success" : "warning"}
          />
          <Button component={RouterLink} to={`/tournament/${tournament.id}/register`} size="small">
            Trang đăng ký
          </Button>
        </Stack>
        {failed.length === 0 ? (
          <Alert severity="success">Không có vi phạm điều kiện trên các đăng ký đang mở.</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Đăng ký</TableCell>
                <TableCell>Nội dung</TableCell>
                <TableCell>Vi phạm</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {failed.map((row) => (
                <TableRow key={row.entryId}>
                  <TableCell>{row.entryName}</TableCell>
                  <TableCell>{row.eventName}</TableCell>
                  <TableCell>
                    {row.players
                      .flatMap((player) => player.violations.map((v) => v.message))
                      .join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TournamentConfigPageShell>
    );
  }

  if (!isTeamTournament(tournament) || !teamData || !teamReport) {
    return (
      <TournamentConfigPageShell title="Kiểm tra điều kiện tham gia" description="Không hỗ trợ loại giải này.">
        <Alert severity="warning">Chỉ hỗ trợ giải cá nhân (S1-C) hoặc giải đồng đội.</Alert>
      </TournamentConfigPageShell>
    );
  }

  // Keep existing team report path
  const teamFailed = (teamReport.teams || []).filter((team) => !team.ok);
  return (
    <TournamentConfigPageShell title="Kiểm tra điều kiện — đồng đội" description={tournament.name}>
      <Chip
        sx={{ mb: 2 }}
        label={teamReport.ok ? "Tất cả đạt" : `${teamFailed.length} đội chưa đạt`}
        color={teamReport.ok ? "success" : "warning"}
      />
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đội</TableCell>
              <TableCell>VĐV</TableCell>
              <TableCell>Vi phạm</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teamFailed.flatMap((team) =>
              team.players
                .filter((player) => !player.ok)
                .map((player) => (
                  <TableRow key={`${team.teamId}-${player.playerId}`}>
                    <TableCell>{team.teamName}</TableCell>
                    <TableCell>{player.playerName}</TableCell>
                    <TableCell>
                      {player.violations.map((item) => item.message).join("; ")}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </TournamentConfigPageShell>
  );
}
