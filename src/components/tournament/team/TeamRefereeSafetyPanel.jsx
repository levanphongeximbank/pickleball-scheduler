import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
  buildCreateAssignmentPayload,
  buildRevokeAssignmentPayload,
  mapCorrectionStatusLabel,
} from "../../../features/team-tournament/engines/teamRefereeV5SafetyEngine.js";
import {
  rpcTeamTournamentCreateRefereeAssignment,
  rpcTeamTournamentListRefereeAssignments,
  rpcTeamTournamentListRefereeCorrections,
  rpcTeamTournamentReviewRefereeCorrection,
  rpcTeamTournamentRevokeRefereeAssignment,
} from "../../../features/team-tournament/services/teamTournamentRpcService.js";

/**
 * TT-5D BTC panel: create/list/revoke assignments + correction review.
 * Eligibility: server `team_tournament_can_manage` + `referee_assignments`.
 * Identity: `profiles` row for display only (RPC REFEREE_NOT_FOUND if missing).
 * Does NOT treat profiles.role as eligibility authority.
 */
export default function TeamRefereeSafetyPanel({
  tournamentId,
  matchupId = "",
  subMatches = [],
  subMatchId = null,
  onNotice,
}) {
  const [assignments, setAssignments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [revokeReason, setRevokeReason] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [assignSubMatchId, setAssignSubMatchId] = useState(
    () => String(subMatchId || subMatches?.[0]?.id || "")
  );
  const [refereeUserId, setRefereeUserId] = useState("");

  const subMatchOptions = useMemo(() => {
    if (Array.isArray(subMatches) && subMatches.length > 0) {
      return subMatches.map((item) => ({
        id: String(item.id),
        label: item.name || item.disciplineName || item.id,
      }));
    }
    if (subMatchId) {
      return [{ id: String(subMatchId), label: String(subMatchId) }];
    }
    return [];
  }, [subMatchId, subMatches]);

  const reload = useCallback(async () => {
    if (!tournamentId) return;
    const [assignRes, corrRes] = await Promise.all([
      rpcTeamTournamentListRefereeAssignments(tournamentId, subMatchId),
      rpcTeamTournamentListRefereeCorrections(tournamentId, "pending"),
    ]);
    if (assignRes.ok) {
      setAssignments(assignRes.assignments || []);
    }
    if (corrRes.ok) {
      setCorrections(corrRes.corrections || []);
    }
  }, [subMatchId, tournamentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!assignSubMatchId && subMatchOptions[0]?.id) {
      setAssignSubMatchId(subMatchOptions[0].id);
    }
  }, [assignSubMatchId, subMatchOptions]);

  async function handleAssign() {
    if (!matchupId) {
      setError("Thiếu matchupId để gán trọng tài.");
      return;
    }
    if (!assignSubMatchId) {
      setError("Chọn trận con để gán trọng tài.");
      return;
    }
    const uid = String(refereeUserId || "").trim();
    if (!uid) {
      setError("Nhập referee user id (auth/profiles id).");
      return;
    }
    setBusyId("assign");
    setError("");
    const result = await rpcTeamTournamentCreateRefereeAssignment(
      buildCreateAssignmentPayload({
        tournamentId,
        matchupId,
        subMatchId: assignSubMatchId,
        refereeUserId: uid,
        activate: true,
        reason: "TT-5D BTC assign",
      })
    );
    setBusyId(null);
    if (result.ok) {
      onNotice?.(result.replayed ? "Assignment đã tồn tại (replay)." : "Đã gán trọng tài.");
      setRefereeUserId("");
      reload();
    } else {
      setError(result.error || result.code || "Gán trọng tài thất bại.");
    }
  }

  async function handleRevoke(row) {
    if (!revokeReason.trim()) {
      setError("Cần lý do revoke.");
      return;
    }
    setBusyId(row.assignmentId);
    setError("");
    const result = await rpcTeamTournamentRevokeRefereeAssignment(
      buildRevokeAssignmentPayload({
        tournamentId,
        assignmentId: row.assignmentId,
        expectedVersion: row.version,
        reason: revokeReason.trim(),
      })
    );
    setBusyId(null);
    if (result.ok) {
      onNotice?.("Đã revoke assignment.");
      reload();
    } else {
      setError(result.error || result.code || "Revoke thất bại.");
    }
  }

  async function handleReview(correction, decision) {
    const reviewReason =
      decision === "reject"
        ? window.prompt("Lý do từ chối (bắt buộc):") || ""
        : window.prompt("Ghi chú duyệt (tuỳ chọn):") || "";
    if (decision === "reject" && !reviewReason.trim()) return;

    setBusyId(correction.correctionRequestId);
    const result = await rpcTeamTournamentReviewRefereeCorrection({
      tournamentId,
      correctionRequestId: correction.correctionRequestId,
      decision,
      reviewReason: reviewReason.trim() || null,
      expectedVersion: correction.version,
    });
    setBusyId(null);
    if (result.ok) {
      onNotice?.(decision === "approve" ? "Đã duyệt correction." : "Đã từ chối correction.");
      reload();
    } else {
      setError(result.error || result.code || "Review thất bại.");
    }
  }

  return (
    <Stack spacing={2} data-testid="team-referee-safety-panel">
      <Typography variant="subtitle2">Referee V5 — Assignment & Correction (TT-5D)</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1} data-testid="referee-assign-form">
        <Typography variant="body2" color="text.secondary">
          Gán qua RPC server (`referee_assignments`). Hồ sơ chỉ xác nhận identity/display —
          không dùng profiles.role làm authority.
        </Typography>
        {subMatchOptions.length > 0 ? (
          <FormControl size="small" fullWidth>
            <InputLabel>Trận con</InputLabel>
            <Select
              label="Trận con"
              value={assignSubMatchId}
              onChange={(event) => setAssignSubMatchId(event.target.value)}
              data-testid="assign-submatch-select"
            >
              {subMatchOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            size="small"
            label="Sub-match id"
            value={assignSubMatchId}
            onChange={(event) => setAssignSubMatchId(event.target.value)}
            data-testid="assign-submatch-input"
          />
        )}
        <TextField
          size="small"
          label="Referee user id (UUID)"
          value={refereeUserId}
          onChange={(event) => setRefereeUserId(event.target.value)}
          data-testid="assign-referee-user-id"
          helperText="profiles.id tồn tại trên Staging — không kiểm role từ client."
        />
        <Button
          size="small"
          variant="contained"
          disabled={busyId === "assign" || !matchupId}
          onClick={handleAssign}
          data-testid="assign-referee-button"
        >
          Gán trọng tài
        </Button>
      </Stack>

      <TextField
        size="small"
        label="Lý do revoke assignment"
        value={revokeReason}
        onChange={(e) => setRevokeReason(e.target.value)}
        data-testid="revoke-reason-input"
      />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Trận</TableCell>
            <TableCell>Trọng tài</TableCell>
            <TableCell>Trạng thái</TableCell>
            <TableCell>Hết hạn</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {assignments.map((row) => (
            <TableRow key={row.assignmentId}>
              <TableCell>{row.externalSubMatchId || row.matchId}</TableCell>
              <TableCell>{row.refereeDisplayName}</TableCell>
              <TableCell>
                <Chip size="small" label={row.status} />
              </TableCell>
              <TableCell>{row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "—"}</TableCell>
              <TableCell>
                {row.status === "active" || row.status === "pending" ? (
                  <Button
                    size="small"
                    color="warning"
                    disabled={busyId === row.assignmentId}
                    onClick={() => handleRevoke(row)}
                    data-testid={`revoke-assignment-${row.assignmentId}`}
                  >
                    Revoke
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {corrections.length > 0 ? (
        <>
          <Typography variant="body2">Correction chờ duyệt</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Match</TableCell>
                <TableCell>Score đề xuất</TableCell>
                <TableCell>Lý do</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {corrections.map((c) => (
                <TableRow key={c.correctionRequestId}>
                  <TableCell>{c.matchId}</TableCell>
                  <TableCell>{JSON.stringify(c.proposedScore)}</TableCell>
                  <TableCell>{c.reason}</TableCell>
                  <TableCell>{mapCorrectionStatusLabel(c.status)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busyId === c.correctionRequestId}
                        onClick={() => handleReview(c, "approve")}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        disabled={busyId === c.correctionRequestId}
                        onClick={() => handleReview(c, "reject")}
                      >
                        Từ chối
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </Stack>
  );
}
