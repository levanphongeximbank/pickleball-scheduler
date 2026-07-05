import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  addReferee,
  assignReferee,
  buildRefereeAssignmentTable,
} from "../../features/team-tournament/engines/refereeAssignEngine.js";

function buildDemoTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Team A", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "Team B", playerIds: [] });
  teamData = buildRoundRobinMatchups(teamData, {
    scheduledAt: "2026-07-10T08:00:00.000Z",
  });
  teamData = addReferee(teamData, { id: "ref-1", name: "Trọng tài A" }).teamData;
  teamData = addReferee(teamData, { id: "ref-2", name: "Trọng tài B" }).teamData;
  return teamData;
}

export default function TournamentRefereeAssignPage() {
  const [teamData, setTeamData] = useState(() => buildDemoTeamData());
  const [message, setMessage] = useState(null);
  const rows = useMemo(() => buildRefereeAssignmentTable(teamData), [teamData]);

  const handleAssign = (matchId, refereeId) => {
    const result = assignReferee(teamData, matchId, refereeId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã phân công trọng tài." });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Phân công trọng tài
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Gán trọng tài cho từng lượt đối đầu.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Trọng tài</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.matchId}>
                <TableCell>
                  {row.teamAName} vs {row.teamBName}
                </TableCell>
                <TableCell>
                  {row.scheduledAt
                    ? new Date(row.scheduledAt).toLocaleString("vi-VN")
                    : "—"}
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.refereeId}
                    onChange={(event) => handleAssign(row.matchId, event.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="">— Chưa phân công —</MenuItem>
                    {row.availableReferees.map((referee) => (
                      <MenuItem key={referee.id} value={referee.id}>
                        {referee.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={!row.refereeId}
                      onClick={() => handleAssign(row.matchId, row.refereeId)}
                    >
                      Lưu
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
