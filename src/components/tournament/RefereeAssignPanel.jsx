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
import { buildRefereeUrl } from "../../tournament/engines/refereeEngine.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  createBlobCanonicalAssignmentPersistence,
  createCompetitionRefereeAssignmentCommandService,
  createModeAssignmentCommandBridge,
  isCompetitionRefereeAssignmentCommandError,
} from "../../features/competition-engine/operations/referee/assignment/index.js";
import { REFEREE_ROLE_CODE } from "../../features/competition-core/referee-assignment/index.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN");
}

function resolveCompetitionMode(tournament) {
  const type = String(tournament?.type || tournament?.competitionType || "")
    .toLowerCase();
  if (type.includes("official") || type.includes("open")) {
    return ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN;
  }
  if (type.includes("daily")) {
    return ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY;
  }
  return ASSIGNMENT_COMPETITION_MODE.INTERNAL;
}

export default function RefereeAssignPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
  compact = false,
  tenantId = null,
}) {
  const [message, setMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => (tournament ? buildIndividualRefereeAssignmentTable(tournament, { eventId }) : []),
    [tournament, eventId]
  );
  const referees = useMemo(
    () => (tournament ? listIndividualReferees(tournament) : []),
    [tournament]
  );

  const bridge = useMemo(() => {
    if (!tournament) return null;
    let current = tournament;
    const persistence = createBlobCanonicalAssignmentPersistence({
      tenantId: String(tenantId || tournament.tenantId || tournament.clubId || "local-tenant"),
      tournamentId: String(tournament.id || tournament.tournamentId || ""),
      getTournament: () => current,
      setTournament: (next) => {
        current = next;
      },
      clockIso: new Date().toISOString(),
    });
    const commandService = createCompetitionRefereeAssignmentCommandService({
      persistence,
      production: false,
    });
    return {
      current: () => current,
      api: createModeAssignmentCommandBridge({
        commandService,
        competitionMode: resolveCompetitionMode(tournament),
      }),
    };
  }, [tournament, tenantId]);

  const persistProjection = (successText) => {
    onTournamentChange?.(bridge.current());
    setMessage({ type: "success", text: successText });
  };

  const handleAssign = async (matchId, rosterId) => {
    if (!bridge) return;
    setBusy(true);
    setMessage(null);
    try {
      const actorId = String(actor?.id || actor?.userId || "organizer");
      const base = {
        tenantId: String(tenantId || tournament.tenantId || tournament.clubId || "local-tenant"),
        tournamentId: String(tournament.id || tournament.tournamentId || ""),
        matchId: String(matchId),
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        actorId,
        lifecycleState: "PRE_MATCH",
        authorizedTenantId: String(
          tenantId || tournament.tenantId || tournament.clubId || "local-tenant"
        ),
        authorizedTournamentId: String(tournament.id || tournament.tournamentId || ""),
        candidates: referees.map((r) => ({
          refereeId: String(r.id),
          active: r.active !== false,
          displayLabel: r.name,
        })),
      };
      const version = await bridge.api.getMatchAssignmentVersion({
        tenantId: base.tenantId,
        tournamentId: base.tournamentId,
        matchId: base.matchId,
        role: REFEREE_ROLE_CODE.PRIMARY,
      });
      const active = await bridge.api.getActiveAssignment({
        tenantId: base.tenantId,
        tournamentId: base.tournamentId,
        matchId: base.matchId,
        role: REFEREE_ROLE_CODE.PRIMARY,
      });

      if (!rosterId) {
        await bridge.api.unassignReferee({
          ...base,
          expectedVersion: version,
          idempotencyKey: `ui-unassign-${matchId}-${version}`,
          reason: "organizer-unassign",
        });
        persistProjection("Đã hủy phân công.");
        return;
      }

      if (active) {
        await bridge.api.replaceReferee({
          ...base,
          newRefereeId: String(rosterId),
          expectedVersion: version,
          idempotencyKey: `ui-replace-${matchId}-${rosterId}-${version}`,
          reason: "organizer-replace",
        });
        persistProjection("Đã đổi trọng tài.");
      } else {
        await bridge.api.assignReferee({
          ...base,
          refereeId: String(rosterId),
          expectedVersion: version,
          idempotencyKey: `ui-assign-${matchId}-${rosterId}-${version}`,
          reason: "organizer-assign",
        });
        persistProjection("Đã phân công trọng tài.");
      }
    } catch (err) {
      const text = isCompetitionRefereeAssignmentCommandError(err)
        ? err.message
        : err?.message || "Phân công thất bại.";
      setMessage({ type: "error", text });
    } finally {
      setBusy(false);
    }
  };

  const handleAuto = async () => {
    if (!bridge) return;
    setBusy(true);
    setMessage(null);
    try {
      let assigned = 0;
      let skipped = 0;
      for (const row of rows) {
        if (row.assigned) continue;
        const referee = referees[assigned % Math.max(referees.length, 1)];
        if (!referee) {
          skipped += 1;
          continue;
        }
        try {
          const version = await bridge.api.getMatchAssignmentVersion({
            tenantId: String(tenantId || tournament.tenantId || tournament.clubId || "local-tenant"),
            tournamentId: String(tournament.id || tournament.tournamentId || ""),
            matchId: String(row.matchId),
            role: REFEREE_ROLE_CODE.PRIMARY,
          });
          await bridge.api.assignReferee({
            tenantId: String(tenantId || tournament.tenantId || tournament.clubId || "local-tenant"),
            tournamentId: String(tournament.id || tournament.tournamentId || ""),
            matchId: String(row.matchId),
            refereeId: String(referee.id),
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            actorId: String(actor?.id || actor?.userId || "organizer"),
            expectedVersion: version,
            idempotencyKey: `ui-auto-${row.matchId}-${referee.id}-${version}`,
            lifecycleState: "PRE_MATCH",
            candidates: referees.map((r) => ({
              refereeId: String(r.id),
              active: r.active !== false,
              displayLabel: r.name,
            })),
          });
          assigned += 1;
        } catch {
          skipped += 1;
        }
      }
      onTournamentChange?.(bridge.current());
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

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Phân công trọng tài (CORE-13)
          </Typography>
          <Button
            size="small"
            startIcon={<AutoFixHighIcon />}
            onClick={handleAuto}
            disabled={busy || referees.length === 0}
          >
            Tự động gán
          </Button>
        </Stack>
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
                  value={row.rosterId || ""}
                  onChange={(e) => handleAssign(row.matchId, e.target.value)}
                >
                  <MenuItem value="">— Hủy gán —</MenuItem>
                  {referees.map((ref) => (
                    <MenuItem key={ref.id} value={ref.id}>
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
                      {buildRefereeUrl(row.token)}
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
