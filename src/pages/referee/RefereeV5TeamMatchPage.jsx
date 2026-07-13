import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { isRefereeV5Enabled } from "../../features/referee-v5/flags.js";
import RefereeV5Workspace from "../../features/referee-v5/components/RefereeV5Workspace.jsx";
import {
  buildCorrectionRequestPayload,
  formatExpiryCountdown,
  shouldShowCorrectionRequest,
  summarizeRefereeAccessState,
} from "../../features/team-tournament/engines/teamRefereeV5SafetyEngine.js";
import {
  rpcTeamTournamentRefereeMatchAccessOps,
  rpcTeamTournamentRequestRefereeCorrection,
} from "../../features/team-tournament/services/teamTournamentRpcService.js";
import RefereeSessionScoreboard from "./RefereeSessionScoreboard.jsx";

/**
 * TT-5D — /referee/match/:matchId with server-side access guard.
 * Requires ?tournamentId= for V5 team bridge; falls back to legacy session otherwise.
 */
export default function RefereeV5TeamMatchPage() {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, session } = useAuth();
  const tournamentId =
    searchParams.get("tournamentId") ||
    location.state?.tournamentId ||
    null;

  const [accessOps, setAccessOps] = useState(null);
  const [loading, setLoading] = useState(Boolean(tournamentId && isRefereeV5Enabled()));
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");

  const reloadAccess = useCallback(async () => {
    if (!tournamentId || !matchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await rpcTeamTournamentRefereeMatchAccessOps({
      tournamentId,
      matchId,
    });
    setAccessOps(result);
    setLoading(false);
  }, [matchId, tournamentId]);

  useEffect(() => {
    if (!isRefereeV5Enabled() || !tournamentId) {
      setLoading(false);
      return;
    }
    reloadAccess();
  }, [reloadAccess, tournamentId]);

  const accessState = useMemo(
    () => summarizeRefereeAccessState(accessOps || {}),
    [accessOps]
  );

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isRefereeV5Enabled() || !tournamentId) {
    return <RefereeSessionScoreboard />;
  }

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">Đang kiểm tra phân công (server)...</Alert>
      </Box>
    );
  }

  if (accessState.denied) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" data-testid="referee-access-denied">
          {accessState.message}
          {accessState.revokeReason ? ` — Lý do: ${accessState.revokeReason}` : ""}
        </Alert>
      </Box>
    );
  }

  async function handleCorrectionRequest() {
    if (!shouldShowCorrectionRequest(accessOps)) return;
    const reason = window.prompt("Lý do correction (bắt buộc):");
    if (!reason?.trim()) return;
    setRequestBusy(true);
    setRequestNotice("");
    const proposedScore = window.prompt('Score JSON, vd {"teamA":11,"teamB":9}') || '{"teamA":11,"teamB":9}';
    let parsedScore;
    try {
      parsedScore = JSON.parse(proposedScore);
    } catch {
      setRequestNotice("Score JSON không hợp lệ.");
      setRequestBusy(false);
      return;
    }
    const result = await rpcTeamTournamentRequestRefereeCorrection(
      buildCorrectionRequestPayload({
        tournamentId,
        matchId,
        resultRevisionId: accessOps?.lastResultRevisionId,
        proposedScore: parsedScore,
        proposedWinner: parsedScore.teamA > parsedScore.teamB ? "team-a" : "team-b",
        reason: reason.trim(),
        requestId: `corr-ui-${Date.now()}`,
      })
    );
    setRequestBusy(false);
    if (result.ok) {
      setRequestNotice("Đã gửi correction — chờ BTC duyệt.");
      reloadAccess();
    } else {
      setRequestNotice(result.error || result.code || "Gửi correction thất bại.");
    }
  }

  const expiryLabel = formatExpiryCountdown(accessState.expiresAt);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }} data-testid="referee-v5-team-match-page">
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Alert severity={accessState.severity} data-testid="referee-access-banner">
          <Typography variant="body2">
            Assignment: <strong>{accessState.label}</strong>
            {accessState.linkStatus ? ` · Bridge: ${accessState.linkStatus}` : ""}
            {expiryLabel ? ` · ${expiryLabel}` : ""}
          </Typography>
          {accessState.readOnly && !accessState.denied ? (
            <Typography variant="caption">{accessState.message}</Typography>
          ) : null}
        </Alert>

        {accessState.pendingCorrectionCount > 0 ? (
          <Alert severity="warning" data-testid="correction-pending-banner">
            Correction đang chờ BTC duyệt ({accessState.pendingCorrectionCount})
          </Alert>
        ) : null}

        {requestNotice ? (
          <Alert severity={requestNotice.includes("thất bại") ? "error" : "success"}>
            {requestNotice}
          </Alert>
        ) : null}

        {shouldShowCorrectionRequest(accessOps) ? (
          <Button
            variant="outlined"
            size="small"
            disabled={requestBusy}
            onClick={handleCorrectionRequest}
            data-testid="referee-request-correction"
          >
            Yêu cầu correction
          </Button>
        ) : null}
      </Stack>

      <RefereeV5Workspace
        showPrototypeBadge={false}
        accessToken={session?.access_token || null}
        stagingFixtureId="staging-doubles"
        tournamentId={tournamentId}
        matchId={matchId}
        readOnly={accessState.readOnly || !accessState.canWrite}
      />
    </Box>
  );
}
