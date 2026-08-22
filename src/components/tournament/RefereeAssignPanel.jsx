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
  buildIndividualRefereeAssignmentTable,
  listIndividualReferees,
} from "../../features/individual-tournament/engines/refereeAssignEngine.js";
import { resolveCanonicalRefereeIdFromRoster } from "../../features/individual-tournament/engines/core13AssignmentProjection.js";
import { buildRefereeUrl } from "../../tournament/engines/refereeEngine.js";
import {
  executeOfficialCore13RefereeAssignment,
  OFFICIAL_CORE13_ASSIGNMENT_ACTIONS,
} from "../../features/tournament/official-tournament-experience/officialCore13AssignmentCommands.js";
import {
  buildOfficialCore16RulesEnvelopeFromTournament,
  buildOfficialRefereeUrlWithCore16Rules,
} from "../../features/tournament/official-open-adapter-b/officialOpenCore16LiveScoringBinding.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN");
}

function buildOfficialLiveRefereeUrl(tournament, matchLike, token) {
  if (!token) return "";
  const built = buildOfficialCore16RulesEnvelopeFromTournament(
    tournament,
    matchLike || {},
    {
      tenantId: tournament?.tenantId,
      eventId: matchLike?.eventId,
    }
  );
  if (built.ok) {
    const path = buildOfficialRefereeUrlWithCore16Rules(token, built.envelope);
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${path}`;
    }
    return path;
  }
  return buildRefereeUrl(token);
}

function refereeSelectValue(ref) {
  return String(ref.canonicalUserId || ref.refereeUserId || "").trim();
}

export default function RefereeAssignPanel({
  tournament,
  eventId = "",
  onTournamentChange,
  onAssignResult = null,
  compact = false,
  matchPresentationById = null,
  tenantId = null,
}) {
  const [message, setMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const raw = tournament ? buildIndividualRefereeAssignmentTable(tournament, { eventId }) : [];
    if (!matchPresentationById) return raw;
    return raw.map((row) => {
      const presentation = matchPresentationById[String(row.matchId)];
      if (!presentation) return row;
      return {
        ...row,
        entryALabel: presentation.sideA?.label || row.entryALabel,
        entryBLabel: presentation.sideB?.label || row.entryBLabel,
        stageLabel: presentation.heading || presentation.groupLabel || row.stageLabel,
      };
    });
  }, [tournament, eventId, matchPresentationById]);

  const referees = useMemo(
    () => (tournament ? listIndividualReferees(tournament) : []),
    [tournament]
  );

  const assignableReferees = useMemo(
    () => referees.filter((ref) => Boolean(refereeSelectValue(ref))),
    [referees]
  );

  const runCommand = async (matchId, selectedId) => {
    const action = selectedId
      ? OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN
      : OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN;
    const result = await executeOfficialCore13RefereeAssignment(tournament, {
      action,
      matchId,
      rosterOrCanonicalId: selectedId || "",
      tenantId: tenantId || tournament.tenantId || "",
      reason: selectedId ? "organizer-assign" : "organizer-unassign",
    });
    if (!result.ok) {
      throw new Error(result.error || result.code || "Phân công thất bại.");
    }
    if (result.noop) {
      setMessage({ type: "success", text: "Không có phân công active để hủy." });
      return;
    }
    const assignResult = {
      ok: true,
      tournament: result.tournament,
      assignment: result.assignment || null,
      matchId: result.matchId,
      refereeId: result.refereeId || "",
      core13: true,
      version: result.version ?? null,
      action: result.action,
    };
    onTournamentChange?.(result.tournament, { assignResult });
    onAssignResult?.(assignResult, result.tournament);
    setMessage({
      type: "success",
      text:
        result.action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN
          ? "Đã hủy phân công."
          : result.action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE
            ? "Đã đổi trọng tài."
            : "Đã phân công trọng tài.",
    });
  };

  const handleAssign = async (matchId, selectedId) => {
    setBusy(true);
    setMessage(null);
    try {
      await runCommand(matchId, selectedId);
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.message || "Phân công thất bại.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAuto = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let assigned = 0;
      let skipped = 0;
      let current = tournament;
      for (const row of rows) {
        if (row.assigned) continue;
        const referee = assignableReferees[assigned % Math.max(assignableReferees.length, 1)];
        if (!referee) {
          skipped += 1;
          continue;
        }
        const result = await executeOfficialCore13RefereeAssignment(current, {
          action: OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN,
          matchId: row.matchId,
          rosterOrCanonicalId: referee.canonicalUserId || referee.id,
          tenantId: tenantId || tournament.tenantId || "",
          reason: "organizer-auto-assign",
        });
        if (!result.ok) {
          skipped += 1;
          continue;
        }
        assigned += 1;
        current = result.tournament;
      }
      onTournamentChange?.(current, {
        assignResult: { ok: true, tournament: current, core13: true, auto: true },
      });
      setMessage({
        type: "success",
        text: `Tự động gán ${assigned} trận` + (skipped ? `, bỏ qua ${skipped}.` : "."),
      });
    } finally {
      setBusy(false);
    }
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
    setMessage({
      type: "success",
      text: `Đã thêm trọng tài ${result.referee.name} (cần gắn canonicalUserId trước khi phân công).`,
    });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để phân công trọng tài.</Alert>;
  }

  const selectedValueForRow = (row) => {
    const canonical = String(row.canonicalUserId || "").trim();
    if (canonical) return canonical;
    const resolved = resolveCanonicalRefereeIdFromRoster(tournament, row.rosterId);
    return resolved.ok ? resolved.refereeId : "";
  };

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Phân công trọng tài (CORE-13)
          </Typography>
          <Button
            size="small"
            startIcon={<AutoFixHighIcon />}
            onClick={handleAuto}
            disabled={busy || assignableReferees.length === 0}
          >
            Tự động gán
          </Button>
        </Stack>
        {assignableReferees.length === 0 ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Cần gắn canonicalUserId (tài khoản REFEREE) trước khi phân công CORE-13. Tên hiển thị
            không phải identity.
          </Alert>
        ) : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            label="Tên trọng tài"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <TextField
            size="small"
            label="SĐT (không dùng làm identity)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Button
            size="small"
            startIcon={<PersonAddAltIcon />}
            onClick={handleAddReferee}
            disabled={!newName.trim()}
          >
            Thêm roster
          </Button>
        </Stack>
      </Paper>

      <Table size={compact ? "small" : "medium"}>
        <TableHead>
          <TableRow>
            <TableCell>Trận</TableCell>
            <TableCell>Trọng tài</TableCell>
            <TableCell>Trạng thái</TableCell>
            {!compact ? <TableCell>Link</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.matchId}>
              <TableCell>{row.label || row.matchId}</TableCell>
              <TableCell>
                <TextField
                  select
                  size="small"
                  fullWidth
                  disabled={busy}
                  value={selectedValueForRow(row)}
                  onChange={(e) => handleAssign(row.matchId, e.target.value)}
                >
                  <MenuItem value="">— Hủy gán —</MenuItem>
                  {assignableReferees.map((ref) => (
                    <MenuItem key={ref.id} value={refereeSelectValue(ref)}>
                      {ref.name}
                    </MenuItem>
                  ))}
                </TextField>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={row.assigned ? "Đã gán" : "Chưa gán"}
                  color={row.assigned ? "success" : "default"}
                />
                {row.assignedAt ? (
                  <Typography variant="caption" display="block">
                    {formatTime(row.assignedAt)}
                  </Typography>
                ) : null}
              </TableCell>
              {!compact ? (
                <TableCell>
                  {row.token ? (
                    <Typography variant="caption">
                      {buildOfficialLiveRefereeUrl(
                        tournament,
                        { id: row.matchId, eventId, stage: row.stage },
                        row.token
                      )}
                    </Typography>
                  ) : (
                    "—"
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
