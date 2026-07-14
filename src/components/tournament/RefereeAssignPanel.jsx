import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
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
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import {
  addIndividualReferee,
  assignRefereeToIndividualMatch,
  autoAssignReferees,
  buildIndividualRefereeAssignmentTable,
  listIndividualReferees,
  reassignReferee,
  unassignRefereeFromMatch,
} from "../../features/individual-tournament/engines/refereeAssignEngine.js";
import { buildRefereeUrl } from "../../tournament/engines/refereeEngine.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN");
}

export default function RefereeAssignPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
  compact = false,
}) {
  const [message, setMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const rows = useMemo(
    () => (tournament ? buildIndividualRefereeAssignmentTable(tournament, { eventId }) : []),
    [tournament, eventId]
  );
  const referees = useMemo(
    () => (tournament ? listIndividualReferees(tournament) : []),
    [tournament]
  );

  const persist = (result, successText) => {
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: successText });
  };

  const handleAssign = (matchId, rosterId) => {
    if (!rosterId) {
      const result = unassignRefereeFromMatch(tournament, matchId, { actor, eventId });
      persist(result, "Đã hủy phân công.");
      return;
    }
    const existing = rows.find((r) => r.matchId === matchId);
    const result = existing?.assigned
      ? reassignReferee(tournament, matchId, rosterId, { actor, eventId })
      : assignRefereeToIndividualMatch(tournament, matchId, rosterId, { actor, eventId });
    persist(
      result,
      result.reassigned ? "Đã đổi trọng tài." : "Đã phân công trọng tài."
    );
  };

  const handleAuto = () => {
    const result = autoAssignReferees(tournament, {
      actor,
      eventId,
      onlyUnassigned: true,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: `Tự động gán ${result.assigned.length} trận` +
        (result.skipped.length ? `, bỏ qua ${result.skipped.length}.` : "."),
    });
  };

  const handleAddReferee = () => {
    const result = addIndividualReferee(tournament, { name: newName, phone: newPhone });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setNewName("");
    setNewPhone("");
    setMessage({ type: "success", text: `Đã thêm trọng tài ${result.referee.name}.` });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để phân công trọng tài.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Danh sách trọng tài ({referees.length})
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
          <TextField
            size="small"
            label="Tên trọng tài"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <TextField
            size="small"
            label="SĐT"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Button
            variant="outlined"
            startIcon={<PersonAddAltIcon />}
            onClick={handleAddReferee}
          >
            Thêm
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            onClick={handleAuto}
            disabled={referees.length === 0 || rows.length === 0}
          >
            Tự động phân công
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {!compact ? <TableCell>Nội dung</TableCell> : null}
              <TableCell>Trận</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Trọng tài</TableCell>
              <TableCell>Link</TableCell>
              <TableCell>Cảnh báo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={compact ? 5 : 6}>
                  <Typography color="text.secondary">Chưa có trận để phân công.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.matchId}>
                  {!compact ? <TableCell>{row.eventName || "—"}</TableCell> : null}
                  <TableCell>
                    {row.entryALabel} vs {row.entryBLabel}
                    {row.stageLabel ? (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.stageLabel}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatTime(row.scheduledStart)}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={row.rosterId}
                      onChange={(e) => handleAssign(row.matchId, e.target.value)}
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="">— Chưa phân công —</MenuItem>
                      {row.availableReferees.map((ref) => (
                        <MenuItem key={ref.id} value={ref.id}>
                          {ref.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    {row.token ? (
                      <Typography
                        variant="caption"
                        component="a"
                        href={buildRefereeUrl(row.token)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở bảng điểm
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.conflicts?.length ? (
                      <Chip size="small" color="warning" label={`Xung đột ${row.conflicts.length}`} />
                    ) : row.assigned ? (
                      <Chip size="small" color="success" label="OK" />
                    ) : (
                      <Chip size="small" label="Chưa gán" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
