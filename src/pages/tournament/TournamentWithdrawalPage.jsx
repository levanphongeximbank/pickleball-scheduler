import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
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
  initializeTeamTournamentData,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  approveWithdrawal,
  listPendingWithdrawals,
  listWithdrawalHistory,
  rejectWithdrawal,
  requestWithdrawal,
} from "../../features/team-tournament/engines/withdrawalEngine.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";

function buildDemoTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Future Arena", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "Elite Club", playerIds: [] });
  return teamData;
}

export default function TournamentWithdrawalPage() {
  const [teamData, setTeamData] = useState(() => buildDemoTeamData());
  const [selectedTeamId, setSelectedTeamId] = useState("team-a");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState(null);

  const pending = useMemo(() => listPendingWithdrawals(teamData), [teamData]);
  const history = useMemo(() => listWithdrawalHistory(teamData), [teamData]);

  const submitRequest = () => {
    const result = requestWithdrawal(teamData, {
      teamId: selectedTeamId,
      reason,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setReason("");
    setMessage({ type: "success", text: "Đã gửi yêu cầu rút lui." });
  };

  const approve = (withdrawalId) => {
    const result = approveWithdrawal(teamData, withdrawalId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã duyệt rút lui." });
  };

  const reject = (withdrawalId) => {
    const result = rejectWithdrawal(teamData, withdrawalId, { reason: "Không đủ điều kiện" });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "info", text: "Đã từ chối yêu cầu." });
  };

  return (
    <TournamentConfigPageShell
      title="Xử lý rút lui / bỏ cuộc"
      description="Tiếp nhận và duyệt yêu cầu rút lui của đội."
      noCard
    >
      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <TextField
            select
            label="Đội"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            SelectProps={{ native: true }}
          >
            {teamData.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </TextField>
          <TextField
            label="Lý do"
            multiline
            minRows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button variant="contained" onClick={submitRequest}>
            Gửi yêu cầu rút lui
          </Button>
        </Stack>
      </Paper>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Chờ duyệt ({pending.length})
      </Typography>
      <Paper sx={{ overflowX: "auto", mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đội</TableCell>
              <TableCell>Lý do</TableCell>
              <TableCell>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>Không có yêu cầu chờ duyệt.</TableCell>
              </TableRow>
            ) : (
              pending.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.teamId}</TableCell>
                  <TableCell>{item.reason || "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" onClick={() => approve(item.id)}>
                        Duyệt
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => reject(item.id)}>
                        Từ chối
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Lịch sử
      </Typography>
      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đội</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Lý do</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.teamId}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{item.reason || item.rejectReason || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </TournamentConfigPageShell>
  );
}
