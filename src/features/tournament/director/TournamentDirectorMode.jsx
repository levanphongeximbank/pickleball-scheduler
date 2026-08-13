import { useNavigate, useParams } from "react-router-dom";

import { Alert, Box, Grid } from "@mui/material";

import { hasSupabaseConfig } from "../../../domain/matchLiveSync.js";
import DirectorActions from "./components/DirectorActions.jsx";
import DirectorBracketSync from "./components/DirectorBracketSync.jsx";
import DirectorCourtBoard from "./components/DirectorCourtBoard.jsx";
import DirectorHeader, { DirectorAccessDenied } from "./components/DirectorHeader.jsx";
import DirectorMatchBoard from "./components/DirectorMatchCard.jsx";
import DirectorScorePanel from "./components/DirectorScorePanel.jsx";
import { useDirectorActions } from "./hooks/useDirectorActions.js";
import { useDirectorState } from "./hooks/useDirectorState.js";
import { useDirectorSync } from "./hooks/useDirectorSync.js";

export default function TournamentDirectorMode() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const state = useDirectorState(tournamentId);
  const actions = useDirectorActions(state);
  useDirectorSync({ state, actions });

  const {
    canUseDirector,
    tournamentAccess,
    tournament,
    players,
    courts,
    isDaily,
    initialLoading,
    tournamentLoadError,
    savedEvents,
    activeEvent,
    lockedCourtIds,
    snapshot,
    refereeSettings,
    liveByMatchId,
    liveError,
    waitingMatches,
    assignedMatches,
    onCourtMatches,
    completedMatches,
    message,
    setMessage,
    error,
    setError,
    scoreDialog,
    setScoreDialog,
    scoreA,
    setScoreA,
    scoreB,
    setScoreB,
    scoreNote,
    setScoreNote,
    setActiveEventId,
    refereeDialogMatch,
    setRefereeDialogMatch,
    auditHistoryMatch,
    setAuditHistoryMatch,
    backPath,
  } = state;

  const {
    handleRefereeAssign,
    handleAssignCourt,
    handleStartMatch,
    handleCancelMatch,
    handleToggleCourt,
    handleOpenScore,
    handleDisputeResetLive,
    handleSubmitScore,
    handleCourtRefereeChange,
    buildRefereeCardProps,
    handleOpenRefereeDialog,
    handleOpenAuditHistory,
  } = actions;

  if (tournamentId && !tournamentAccess.ok) {
    return (
      <DirectorAccessDenied
        reason="tenant-access"
        message={tournamentAccess.error || "Không có quyền truy cập giải này."}
      />
    );
  }

  if (!canUseDirector) {
    return <DirectorAccessDenied />;
  }

  if (initialLoading || tournamentAccess.pending) {
    return (
      <Box>
        <Alert severity="info">Đang tải Director Mode...</Alert>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <DirectorAccessDenied
        reason="not-found"
        message={
          tournamentLoadError ||
          (!state.tenantId
            ? "CLB chưa có tenant hợp lệ — không thể tải Director."
            : "Không tìm thấy giải.")
        }
      />
    );
  }

  return (
    <Box>
      <DirectorHeader
        tournament={tournament}
        onBack={() => navigate(backPath)}
        isDaily={isDaily}
        savedEvents={savedEvents}
        activeEvent={activeEvent}
        onEventChange={setActiveEventId}
        snapshot={snapshot}
        message={message}
        error={error}
        onClearMessage={() => setMessage(null)}
        onClearError={() => setError(null)}
        hasSupabaseConfig={hasSupabaseConfig()}
        liveError={liveError}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <DirectorCourtBoard
          snapshot={snapshot}
          courts={courts}
          lockedCourtIds={lockedCourtIds}
          refereeSettings={refereeSettings}
          onToggleCourt={handleToggleCourt}
          onCourtRefereeChange={handleCourtRefereeChange}
          disableManualLock={isDaily}
          lockDisabledReason="Khóa sân thủ công chưa hỗ trợ trong Daily canonical."
        />
      </Grid>

      <DirectorMatchBoard
        isDaily={isDaily}
        waitingMatches={waitingMatches}
        assignedMatches={assignedMatches}
        onCourtMatches={onCourtMatches}
        completedMatches={completedMatches}
        buildRefereeCardProps={buildRefereeCardProps}
        onAssignCourt={handleAssignCourt}
        onStartMatch={handleStartMatch}
        onCancelMatch={handleCancelMatch}
        onOpenScore={handleOpenScore}
        onOpenRefereeDialog={handleOpenRefereeDialog}
        onOpenAuditHistory={handleOpenAuditHistory}
        hasSupabaseConfig={hasSupabaseConfig()}
      />

      {!isDaily && <DirectorBracketSync snapshot={snapshot} />}

      <DirectorActions
        refereeDialogMatch={refereeDialogMatch}
        auditHistoryMatch={auditHistoryMatch}
        activeEvent={activeEvent}
        players={players}
        courts={courts}
        refereeSettings={refereeSettings}
        liveByMatchId={liveByMatchId}
        onCloseRefereeDialog={() => setRefereeDialogMatch(null)}
        onCloseAuditDialog={() => setAuditHistoryMatch(null)}
        onRefereeAssign={handleRefereeAssign}
      />

      <DirectorScorePanel
        scoreDialog={scoreDialog}
        liveByMatchId={liveByMatchId}
        scoreA={scoreA}
        scoreB={scoreB}
        scoreNote={scoreNote}
        onScoreAChange={setScoreA}
        onScoreBChange={setScoreB}
        onScoreNoteChange={setScoreNote}
        onClose={() => setScoreDialog(null)}
        onSubmit={handleSubmitScore}
        onDisputeReset={handleDisputeResetLive}
      />
    </Box>
  );
}
