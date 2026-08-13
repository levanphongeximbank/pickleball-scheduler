import { useCallback } from "react";

import { unlockCourt } from "../../../../ai/director.js";
import { hasSupabaseConfig, markMatchLiveProcessed } from "../../../../domain/matchLiveSync.js";
import { TOURNAMENT_MODE } from "../../../../models/tournament/index.js";
import { submitTournamentDirectorMatchScore } from "../../../../tournament/engines/index.js";
import { mergeLiveAuditIntoEvent } from "../../../../tournament/engines/scoreHistoryEngine.js";
import { useRefereeFinalizeQueue } from "../../../../tournament/useMatchLiveScores.js";

export function useDirectorSync({ state, actions }) {
  const {
    activeClubId,
    isDaily,
    dailySession,
    liveByMatchId,
    tournamentRef,
    activeEventRef,
    setError,
    setMessage,
  } = state;
  const { persistEvent } = actions;

  const handleRefereeFinalize = useCallback(
    async (row) => {
      const currentTournament = tournamentRef.current;
      const currentEvent = activeEventRef.current;
      if (!currentTournament || !row?.matchId) {
        return;
      }

      const scores = { scoreA: row.scoreA, scoreB: row.scoreB };
      const isDailyMode =
        isDaily || currentTournament.mode === TOURNAMENT_MODE.DAILY_PLAY;

      if (isDailyMode) {
        const result = await dailySession.submitScore(row.matchId, scores.scoreA, scores.scoreB);
        if (!result?.ok) {
          if (result?.error) setError(result.error);
          return;
        }
        await markMatchLiveProcessed(row.id);
        setMessage(`Trọng tài ${row.refereeName} đã chốt: ${row.scoreA}-${row.scoreB}.`);
        return;
      }

      if (!currentEvent) {
        return;
      }

      const result = submitTournamentDirectorMatchScore(currentEvent, row.matchId, scores, {
        allowDraw: false,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.releasedCourtId) {
        unlockCourt(result.releasedCourtId, activeClubId);
      }

      const eventWithAudit = mergeLiveAuditIntoEvent(
        result.event,
        row.matchId,
        row.auditLog || []
      );

      if (persistEvent(eventWithAudit, { processMatchId: row.matchId })) {
        await markMatchLiveProcessed(row.id);
        setMessage(`Trọng tài ${row.refereeName} đã chốt: ${row.scoreA}-${row.scoreB}.`);
      }
    },
    [
      activeClubId,
      activeEventRef,
      dailySession,
      isDaily,
      persistEvent,
      setError,
      setMessage,
      tournamentRef,
    ]
  );

  useRefereeFinalizeQueue({
    liveByMatchId,
    onFinalize: handleRefereeFinalize,
    enabled: hasSupabaseConfig(),
  });
}
