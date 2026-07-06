import { useMemo, useState } from "react";

import {
  Box,
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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import { recordSubMatchResult } from "../../features/team-tournament/engines/teamResultEngine.js";
import { getAwardsPreview } from "../../features/team-tournament/engines/awardsEngine.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";

function buildDemoTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Future Arena", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "Elite Club", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-c", name: "Rising Stars", playerIds: [] });
  teamData = buildRoundRobinMatchups(teamData);
  return teamData;
}

export default function TournamentAwardsPage() {
  const [teamData] = useState(() => {
    let data = buildDemoTeamData();
    const matchup = data.matchups[0];
    for (const subMatch of matchup.subMatches) {
      data = recordSubMatchResult(data, {
        matchupId: matchup.id,
        subMatchId: subMatch.id,
        winnerTeamId: matchup.teamAId,
        score: { teamA: 11, teamB: 5 },
      }).teamData;
    }
    return data;
  });

  const preview = useMemo(() => getAwardsPreview(teamData), [teamData]);

  return (
    <TournamentConfigPageShell
      title="Trao giải"
      description="Bảng trao giải tự động từ BXH đồng đội."
      noCard
    >
      <Stack spacing={2}>
        {preview.awards.map((award) => (
          <Paper key={award.key} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <EmojiEventsIcon color="warning" />
              <Typography fontWeight={700}>{award.label}</Typography>
              {award.auto ? <Chip size="small" label="Tự động" /> : null}
            </Stack>
            <Typography sx={{ mt: 1 }}>
              {award.teamName || "Chưa xác định"}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
        BXH tham chiếu
      </Typography>
      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Hạng</TableCell>
              <TableCell>Đội</TableCell>
              <TableCell>Thắng</TableCell>
              <TableCell>Thua</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.standings.map((row) => (
              <TableRow key={row.teamId}>
                <TableCell>{row.rank}</TableCell>
                <TableCell>{row.teamName}</TableCell>
                <TableCell>{row.wins}</TableCell>
                <TableCell>{row.losses}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </TournamentConfigPageShell>
  );
}
