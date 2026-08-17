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
  assertCanonicalRefereeId,
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../features/competition-engine/operations/referee/assignment/index.js";
import { REFEREE_ROLE_CODE } from "../../features/competition-core/referee-assignment/index.js";
import { getSupabaseAuthClient } from "../../auth/supabaseClient.js";

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

  const api = useMemo(
    () =>
      createCompetitionRefereeAssignmentTrustedClient({
        edgeBaseUrl: resolveCompetitionAssignmentEdgeBaseUrl(),
        getAccessToken: async () => {
          const client = getSupabaseAuthClient();
          const { data } = (await client?.auth.getSession()) || {};
          return data?.session?.access_token || null;
        },
      }),
    []
  );

  const projectTrustedResult = (result, matchId, rosterId, successText) => {
    const current = tournament;
    const prev = current?.settings?.core13RefereeAssignments || {
      byScope: {},
      versionByScope: {},
    };
    const key = `${String(matchId)}::${REFEREE_ROLE_CODE.PRIMARY}`;
    const byScope = { ...(prev.byScope || {}) };
    const versionByScope = { ...(prev.versionByScope || {}) };
    if (!rosterId) {
      delete byScope[key];
    } else if (result?.assignment) {
      byScope[key] = {
        ...result.assignment,
        rosterId: String(rosterId),
        status: "active",
      };
    }
    if (result?.version != null) versionByScope[key] = result.version;
    onTournamentChange?.({
      ...current,
      settings: {
        ...(current?.settings || {}),
        core13RefereeAssignments: {
          schema: "core13-blob-canonical-v1",
          interimUntilSqlGo: false,
          authority: false,
          projectionOnly: true,
          source: "trusted-server-projection",
          byScope,
          versionByScope,
          audit: prev.audit || [],
          idempotency: prev.idempotency || {},
        },
      },
    });
    setMessage({ type: "success", text: successText });
  };

  const handleAssign = async (matchId, rosterId) => {
    setBusy(true);
    setMessage(null);
    try {
      const base = {
        tenantId: String(tenantId || tournament.tenantId || tournament.clubId || ""),
        tournamentId: String(tournament.id || tournament.tournamentId || ""),
        matchId: String(matchId),
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        competitionMode: resolveCompetitionMode(tournament),
        refereeFeatureEnabled: true,
      };
      if (rosterId) {
        assertCanonicalRefereeId(rosterId);
      }
      const versionRes = await api.getMatchAssignmentVersion(base);
      if (versionRes?.ok === false) {
        throw new Error(versionRes.error || versionRes.code || "Không đọc được phiên bản phân công.");
      }
      const version = Number(versionRes?.version ?? 0);
      const activeRes = await api.getActiveAssignment(base);
      const active = activeRes?.assignment || null;

      let result;
      if (!rosterId) {
        result = await api.unassignReferee({
          ...base,
          expectedVersion: version,
          idempotencyKey: `ui-unassign-${matchId}-${version}`,
          reason: "organizer-unassign",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Hủy phân công thất bại.");
        projectTrustedResult(result, matchId, "", "Đã hủy phân công.");
        return;
      }

      if (active) {
        result = await api.replaceReferee({
          ...base,
          newRefereeId: String(rosterId),
          expectedVersion: version,
          idempotencyKey: `ui-replace-${matchId}-${rosterId}-${version}`,
          reason: "organizer-replace",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Đổi trọng tài thất bại.");
        projectTrustedResult(result, matchId, rosterId, "Đã đổi trọng tài.");
      } else {
        result = await api.assignReferee({
          ...base,
          refereeId: String(rosterId),
          expectedVersion: version,
          idempotencyKey: `ui-assign-${matchId}-${rosterId}-${version}`,
          reason: "organizer-assign",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Phân công thất bại.");
        projectTrustedResult(result, matchId, rosterId, "Đã phân công trọng tài.");
      }
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
        const referee = referees[assigned % Math.max(referees.length, 1)];
        if (!referee) {
          skipped += 1;
          continue;
        }
        try {
          assertCanonicalRefereeId(referee.id);
          const versionRes = await api.getMatchAssignmentVersion({
            tenantId: String(tenantId || tournament.tenantId || tournament.clubId || ""),
            tournamentId: String(tournament.id || tournament.tournamentId || ""),
            matchId: String(row.matchId),
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            competitionMode: resolveCompetitionMode(tournament),
            refereeFeatureEnabled: true,
          });
          if (versionRes?.ok === false) {
            skipped += 1;
            continue;
          }
          const version = Number(versionRes?.version ?? 0);
          const result = await api.assignReferee({
            tenantId: String(tenantId || tournament.tenantId || tournament.clubId || ""),
            tournamentId: String(tournament.id || tournament.tournamentId || ""),
            matchId: String(row.matchId),
            refereeId: String(referee.id),
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            expectedVersion: version,
            idempotencyKey: `ui-auto-${row.matchId}-${referee.id}-${version}`,
            competitionMode: resolveCompetitionMode(tournament),
            refereeFeatureEnabled: true,
          });
          if (!result?.ok) {
            skipped += 1;
            continue;
          }
          assigned += 1;
          current = {
            ...current,
            settings: {
              ...(current?.settings || {}),
              core13RefereeAssignments: {
                ...(current?.settings?.core13RefereeAssignments || {}),
                schema: "core13-blob-canonical-v1",
                interimUntilSqlGo: false,
                authority: false,
                projectionOnly: true,
                source: "trusted-server-projection",
              },
            },
          };
        } catch {
          skipped += 1;
        }
      }
      onTournamentChange?.(current);
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
