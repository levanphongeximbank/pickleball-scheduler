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
import {
  projectCore13AssignmentOntoTournament,
  resolveCanonicalRefereeIdFromRoster,
} from "../../features/individual-tournament/engines/core13AssignmentProjection.js";
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

  const projectTrustedResult = (result, matchId, refereeId, rosterId, successText) => {
    const nextTournament = projectCore13AssignmentOntoTournament(tournament, {
      matchId,
      refereeId,
      rosterId,
      assignment: result?.assignment || null,
      version: result?.version ?? null,
    });
    const assignResult = {
      ok: true,
      tournament: nextTournament,
      assignment: result?.assignment || null,
      matchId,
      refereeId,
      core13: true,
      version: result?.version ?? null,
    };
    onTournamentChange?.(nextTournament, { assignResult });
    onAssignResult?.(assignResult, nextTournament);
    setMessage({ type: "success", text: successText });
  };

  const handleAssign = async (matchId, selectedId) => {
    setBusy(true);
    setMessage(null);
    try {
      const resolved = resolveCanonicalRefereeIdFromRoster(tournament, selectedId);
      if (!resolved.ok) {
        throw new Error(resolved.error || "Identity trọng tài không hợp lệ.");
      }
      const refereeId = resolved.refereeId;
      const rosterId = resolved.rosterEntry?.id || "";

      const base = {
        tenantId: String(tenantId || tournament.tenantId || tournament.clubId || ""),
        tournamentId: String(tournament.id || tournament.tournamentId || ""),
        matchId: String(matchId),
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        competitionMode: resolveCompetitionMode(tournament),
        refereeFeatureEnabled: true,
      };
      if (refereeId) {
        assertCanonicalRefereeId(refereeId);
      }
      const versionRes = await api.getMatchAssignmentVersion(base);
      if (versionRes?.ok === false) {
        throw new Error(versionRes.error || versionRes.code || "Không đọc được phiên bản phân công.");
      }
      const version = Number(versionRes?.version ?? 0);
      const activeRes = await api.getActiveAssignment(base);
      const active = activeRes?.assignment || null;

      let result;
      if (!refereeId) {
        result = await api.unassignReferee({
          ...base,
          expectedVersion: version,
          idempotencyKey: `ui-unassign-${matchId}-${version}`,
          reason: "organizer-unassign",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Hủy phân công thất bại.");
        projectTrustedResult(result, matchId, "", "", "Đã hủy phân công.");
        return;
      }

      if (active) {
        result = await api.replaceReferee({
          ...base,
          newRefereeId: String(refereeId),
          expectedVersion: version,
          idempotencyKey: `ui-replace-${matchId}-${refereeId}-${version}`,
          reason: "organizer-replace",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Đổi trọng tài thất bại.");
        projectTrustedResult(result, matchId, refereeId, rosterId, "Đã đổi trọng tài.");
      } else {
        result = await api.assignReferee({
          ...base,
          refereeId: String(refereeId),
          expectedVersion: version,
          idempotencyKey: `ui-assign-${matchId}-${refereeId}-${version}`,
          reason: "organizer-assign",
        });
        if (!result?.ok) throw new Error(result?.error || result?.code || "Phân công thất bại.");
        projectTrustedResult(result, matchId, refereeId, rosterId, "Đã phân công trọng tài.");
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
        const referee = assignableReferees[assigned % Math.max(assignableReferees.length, 1)];
        if (!referee) {
          skipped += 1;
          continue;
        }
        try {
          const resolved = resolveCanonicalRefereeIdFromRoster(current, referee.id);
          if (!resolved.ok || !resolved.refereeId) {
            skipped += 1;
            continue;
          }
          assertCanonicalRefereeId(resolved.refereeId);
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
            refereeId: String(resolved.refereeId),
            roleCode: REFEREE_ROLE_CODE.PRIMARY,
            expectedVersion: version,
            idempotencyKey: `ui-auto-${row.matchId}-${resolved.refereeId}-${version}`,
            competitionMode: resolveCompetitionMode(tournament),
            refereeFeatureEnabled: true,
          });
          if (!result?.ok) {
            skipped += 1;
            continue;
          }
          assigned += 1;
          current = projectCore13AssignmentOntoTournament(current, {
            matchId: row.matchId,
            refereeId: resolved.refereeId,
            rosterId: resolved.rosterEntry?.id || referee.id,
            assignment: result.assignment || null,
            version: result.version ?? version,
          });
        } catch {
          skipped += 1;
        }
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
