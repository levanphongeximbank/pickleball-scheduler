import { useMemo, useState } from "react";

import {
  Alert,
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

import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  checkAllTeamsEligibility,
  updateEligibilityRules,
} from "../../../features/team-tournament/engines/eligibilityEngine.js";

const DEMO_PLAYERS = [
  { id: "p1", name: "Nam A", gender: "Nam", birthYear: 1995, level: 3.5 },
  { id: "p2", name: "Nam B", gender: "Nam", birthYear: 2010, level: 2.5 },
  { id: "p3", name: "Nu A", gender: "Nữ", birthYear: 1998, level: 4.0 },
  { id: "p4", name: "Nu B", gender: "Nữ", level: 3.0 },
];

function buildDemoTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = updateEligibilityRules(teamData, {
    age: { enabled: true, minAge: 18, maxAge: 50, asOfDate: "2026-01-01" },
    gender: { enabled: true, allowedGenders: ["male", "female"] },
    skill: { enabled: true, minLevel: 2.5, maxLevel: 4.5 },
  }).teamData;
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Future Arena",
    playerIds: ["p1", "p2", "p3", "p4"],
  });
  return teamData;
}

export default function TournamentEligibilityPage() {
  const [teamData] = useState(() => buildDemoTeamData());
  const report = useMemo(
    () => checkAllTeamsEligibility(teamData, DEMO_PLAYERS),
    [teamData]
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Kiểm tra điều kiện tham gia
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Đối chiếu roster với quy tắc tuổi, giới tính và trình độ.
      </Typography>

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
    </Box>
  );
}
