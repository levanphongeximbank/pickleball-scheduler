import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  rpcTeamTournamentSearchRefereeCandidates,
} from "../../../features/team-tournament/services/teamTournamentRpcService.js";
import {
  planRefereeAssignment,
  REFEREE_ASSIGN_ACTION,
} from "../../../features/team-tournament/engines/teamRefereeAssignmentLifecycle.js";
import { mapTeamTournamentDomainFailure } from "../../../features/team-tournament/engines/teamTournamentDomainErrors.js";
import {
  PARENT_ASSIGNMENT_SELECT_VALUE,
  isParentRefereeAssignment,
} from "../../../features/team-tournament/engines/teamRefereeCanonicalLifecycle.js";

/**
 * TT-5D BTC panel: searchable assign / change / revoke + correction review.
 * Candidate source: team_tournament_search_referee_candidates (profiles identity).
 * Eligibility server check: create_referee_assignment (profiles row exists; no role).
 * MANUAL_REFEREE_UUID_REQUIRED=NO
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
  const [revokeReason, setRevokeReason] = useState("BTC đổi/thu hồi trọng tài");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [assignSubMatchId, setAssignSubMatchId] = useState(
    () =>
      subMatchId
        ? String(subMatchId)
        : PARENT_ASSIGNMENT_SELECT_VALUE
  );
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);

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

  const activeForSelectedSub = useMemo(
    () =>
      assignments.filter((row) => {
        if (!(row.status === "active" || row.status === "pending")) return false;
        if (!assignSubMatchId) {
          return isParentRefereeAssignment(row) || String(row.matchId || "") === String(matchupId || "");
        }
        return (
          String(row.externalSubMatchId || row.subMatchId || "") ===
          String(assignSubMatchId)
        );
      }),
    [assignSubMatchId, assignments, matchupId]
  );

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
    if (!tournamentId) return undefined;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearchBusy(true);
      const result = await rpcTeamTournamentSearchRefereeCandidates({
        tournamentId,
        search: candidateQuery,
        limit: 20,
      });
      if (cancelled) return;
      setSearchBusy(false);
      if (result.ok) {
        setCandidates(result.candidates || result.data?.candidates || []);
        setError("");
      } else if (result.code === "RPC_NOT_DEPLOYED" || /could not find the function/i.test(result.error || "")) {
        setCandidates([]);
        setError(
          "RPC tìm trọng tài chưa apply trên Staging — chờ Owner GO package lifecycle."
        );
      } else {
        setCandidates([]);
        setError(result.error || result.code || "Không tải được danh sách trọng tài.");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [candidateQuery, tournamentId]);

  async function revokeRows(rows, reason) {
    for (const row of rows) {
      const result = await rpcTeamTournamentRevokeRefereeAssignment(
        buildRevokeAssignmentPayload({
          tournamentId,
          assignmentId: row.assignmentId,
          expectedVersion: row.version,
          reason,
        })
      );
      if (!result.ok) {
        return result;
      }
    }
    return { ok: true };
  }

  async function handleAssignOrChange() {
    if (!matchupId) {
      setError("Thiếu matchupId để gán trọng tài.");
      return;
    }
    // Empty assignSubMatchId = canonical parent matchup assignment.
    const uid = String(selectedCandidate?.userId || selectedCandidate?.id || "").trim();
    if (!uid) {
      setError("Chọn trọng tài từ danh sách tìm kiếm.");
      return;
    }
    setBusyId("assign");
    setError("");

    const canonicalMatchId = assignSubMatchId || matchupId;
    const plan = planRefereeAssignment({
      matchup: { id: matchupId, teamAId: "resolved", teamBId: "resolved" },
      existingAssignments: activeForSelectedSub.map((row) => ({
        ...row,
        matchId: canonicalMatchId,
        role: "REFEREE",
      })),
      refereeUserId: uid,
      matchId: canonicalMatchId,
    });
    if (plan.action === REFEREE_ASSIGN_ACTION.IDEMPOTENT_NOOP) {
      setBusyId(null);
      onNotice?.("Trọng tài này đã được gán cho trận (không tạo trùng).");
      reload();
      return;
    }

    if (activeForSelectedSub.length > 0 && plan.action === REFEREE_ASSIGN_ACTION.SUPERSEDE) {
      const revoke = await revokeRows(
        activeForSelectedSub,
        revokeReason.trim() || "BTC đổi trọng tài"
      );
      if (!revoke.ok) {
        setBusyId(null);
        const mapped = mapTeamTournamentDomainFailure(revoke);
        setError(mapped.error || revoke.error || revoke.code || "Revoke trước khi đổi thất bại.");
        return;
      }
    }

    const result = await rpcTeamTournamentCreateRefereeAssignment(
      buildCreateAssignmentPayload({
        tournamentId,
        matchupId,
        subMatchId: assignSubMatchId || null,
        refereeUserId: uid,
        activate: true,
        reason: activeForSelectedSub.length > 0 ? "TT-5D BTC change" : "TT-5D BTC assign",
      })
    );
    setBusyId(null);
    if (result.ok) {
      onNotice?.(
        activeForSelectedSub.length > 0
          ? "Đã đổi trọng tài."
          : result.replayed
            ? "Assignment đã tồn tại (replay)."
            : "Đã gán trọng tài."
      );
      setSelectedCandidate(null);
      setCandidateQuery("");
      reload();
    } else {
      const mapped = mapTeamTournamentDomainFailure(result);
      setError(mapped.error || result.error || result.code || "Gán trọng tài thất bại.");
    }
  }

  async function handleRevoke(row) {
    if (!revokeReason.trim()) {
      setError("Cần lý do revoke.");
      return;
    }
    setBusyId(row.assignmentId);
    setError("");
    const result = await revokeRows([row], revokeReason.trim());
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
          Gán trọng tài một lần cho cả trận. WD / MD / XD / Dreambreaker kế thừa.
          Không nhập UUID. Không cần tạo phiên trọng tài.
        </Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Phạm vi</InputLabel>
          <Select
            label="Phạm vi"
            value={assignSubMatchId}
            onChange={(event) => setAssignSubMatchId(event.target.value)}
            data-testid="assign-submatch-select"
          >
            <MenuItem value={PARENT_ASSIGNMENT_SELECT_VALUE}>
              Cả trận (canonical)
            </MenuItem>
            {subMatchOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label} (override)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          size="small"
          options={candidates}
          loading={searchBusy}
          value={selectedCandidate}
          onChange={(_event, value) => setSelectedCandidate(value)}
          inputValue={candidateQuery}
          onInputChange={(_event, value) => setCandidateQuery(value)}
          getOptionLabel={(option) =>
            option
              ? `${option.displayName || option.email || "Referee"}${
                  option.email ? ` (${option.email})` : ""
                }`
              : ""
          }
          isOptionEqualToValue={(a, b) =>
            String(a?.userId || a?.id || "") === String(b?.userId || b?.id || "")
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Tìm trọng tài (tên / email)"
              data-testid="assign-referee-search"
            />
          )}
          data-testid="assign-referee-autocomplete"
        />

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            disabled={busyId === "assign" || !matchupId || !selectedCandidate}
            onClick={handleAssignOrChange}
            data-testid="assign-referee-button"
          >
            {activeForSelectedSub.length > 0 ? "Đổi trọng tài" : "Gán trọng tài"}
          </Button>
        </Stack>
      </Stack>

      <TextField
        size="small"
        label="Lý do revoke / đổi assignment"
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
