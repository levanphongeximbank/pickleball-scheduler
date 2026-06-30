import { useNavigate, useParams } from "react-router-dom";

import { Box, Grid } from "@mui/material";

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
    tournament,
    players,
    courts,
    isDaily,
    savedEvents,
    activeEvent,
    lockedCourtIds,
    snapshot,
    refereeSettings,
    liveByMatchId,
    liveError,
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
    waitingMatches,
    onCourtMatches,
    completedMatches,
  } = state;

  const {
    handleRefereeAssign,
    handleAssignCourt,
    handleToggleCourt,
    handleOpenScore,
    handleDisputeResetLive,
    handleSubmitScore,
    handleCourtRefereeChange,
    buildRefereeCardProps,
    handleOpenRefereeDialog,
    handleOpenAuditHistory,
  } = actions;

  if (!canUseDirector) {
    return <DirectorAccessDenied />;
  }

  if (!tournament) {
    return <DirectorAccessDenied reason="not-found" />;
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
        />

        <DirectorMatchBoard
          waitingMatches={waitingMatches}
          onCourtMatches={onCourtMatches}
          completedMatches={completedMatches}
          buildRefereeCardProps={buildRefereeCardProps}
          onAssignCourt={handleAssignCourt}
          onOpenScore={handleOpenScore}
          onOpenRefereeDialog={handleOpenRefereeDialog}
          onOpenAuditHistory={handleOpenAuditHistory}
          hasSupabaseConfig={hasSupabaseConfig}
        />
      </Grid>

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
