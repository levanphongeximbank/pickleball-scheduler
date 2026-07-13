import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
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
  buildRevokeAssignmentPayload,
  mapCorrectionStatusLabel,
} from "../../../features/team-tournament/engines/teamRefereeV5SafetyEngine.js";
import {
  rpcTeamTournamentListRefereeAssignments,
  rpcTeamTournamentListRefereeCorrections,
  rpcTeamTournamentReviewRefereeCorrection,
  rpcTeamTournamentRevokeRefereeAssignment,
} from "../../../features/team-tournament/services/teamTournamentRpcService.js";

/** TT-5D minimal BTC panel: assignments, revoke, correction review. */
export default function TeamRefereeSafetyPanel({ tournamentId, subMatchId = null, onNotice }) {
  const [assignments, setAssignments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [revokeReason, setRevokeReason] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

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
