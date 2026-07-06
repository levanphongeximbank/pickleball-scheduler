import { useCallback } from "react";

import { lockCourt, unlockCourt } from "../../../../ai/director.js";
import { buildDirectorMatchCardProps } from "../../../../components/tournament/matchCardProps.js";
import {
  hasSupabaseConfig,
  markMatchLiveProcessed,
  resetMatchLiveForDispute,
  upsertMatchLive,
} from "../../../../domain/matchLiveSync.js";
import {
  setTournamentStatus,
  updateTournament,
} from "../../../../domain/tournamentService.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../../models/tournament/index.js";
import {
  assignDailyDirectorMatch,
  assignTournamentMatchToAvailableCourt,
  buildDailyPlayTournamentPatch,
  submitDailyDirectorMatchScore,
  submitTournamentDirectorMatchScore,
  upsertOfficialEvent,
} from "../../../../tournament/engines/index.js";
import {
  assignCourtRefereeToMatch,
  buildMatchLiveRecord,
  buildRefereeSettingsPatch,
  patchRefereeInTournament,
  resolveCourtRefereeForAssignment,
  resolveMatchLabels,
  setCourtRefereeAssignment,
} from "../../../../tournament/engines/refereeEngine.js";
import {
  appendScoreLogAfterDailySubmit,
  appendScoreLogAfterEventSubmit,
  buildDirectorScoreLogEntry,
  buildDisputeResetLogEntry,
  patchScoreLogInTournament,
  resolveDirectorScoreLogSource,
} from "../../../../tournament/engines/scoreHistoryEngine.js";

export function useDirectorActions(state) {
  const {
    activeClubId,
    refreshClubs,
    tournament,
    courts,
    isDaily,
    savedEvents,
    activeEvent,
    lockedCourtIds,
    refereeSettings,
    liveByMatchId,
    setLocalRevision,
    setMessage,
    setError,
    scoreDialog,
    setScoreDialog,
    scoreA,
    setScoreA,
    scoreB,
    setScoreB,
    scoreNote,
    setScoreNote,
    setRefereeDialogMatch,
    setAuditHistoryMatch,
    tournamentRef,
    activeEventRef,
    tournamentId,
  } = state;

  const persistTournament = useCallback(
    (patch, options = {}) => {
      const result = updateTournament(activeClubId, tournamentId, patch, {
        ...options,
        directorMode: true,
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }

      if (tournament?.status !== TOURNAMENT_STATUS.ACTIVE) {
        setTournamentStatus(activeClubId, tournamentId, TOURNAMENT_STATUS.ACTIVE, {
          directorMode: true,
        });
      }

      setLocalRevision((value) => value + 1);
      refreshClubs();
      return true;
    },
    [activeClubId, tournamentId, tournament?.status, refreshClubs, setError, setLocalRevision]
  );

  const persistEvent = useCallback(
    (nextEvent, options = {}) => {
      if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
        return persistTournament(
          {
            events: upsertOfficialEvent(savedEvents, nextEvent),
          },
          {
            processMatchId: options.processMatchId || null,
            processEventId: activeEvent?.id || null,
          }
        );
      }

      return persistTournament(
        { events: [nextEvent] },
        {
          processMatchId: options.processMatchId || null,
          processEventId: activeEvent?.id || null,
        }
      );
    },
    [tournament, savedEvents, activeEvent?.id, persistTournament]
  );

  const handleRefereeAssign = useCallback(
    async ({ match: assignedMatch, referee }) => {
      const currentTournament = tournamentRef.current;
      const currentEvent = activeEventRef.current;
      if (!currentTournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }

      if (!hasSupabaseConfig()) {
        return {
          ok: false,
          error: "Cần cấu hình Supabase (VITE_SUPABASE_URL) để dùng chế độ trọng tài.",
        };
      }

      const patch = patchRefereeInTournament(currentTournament, {
        eventId: currentEvent?.id,
        matchId: assignedMatch.id,
        referee,
        isDaily,
      });

      if (!patch) {
        return { ok: false, error: "Không cập nhật được trận." };
      }

      let persisted;
      if (isDaily) {
        persisted = persistTournament(patch);
      } else {
        const nextEvent = (patch.events || []).find(
          (event) => String(event.id) === String(currentEvent?.id)
        );
        persisted = nextEvent ? persistEvent(nextEvent) : false;
      }

      if (!persisted) {
        return { ok: false, error: "Không lưu được thông tin trọng tài." };
      }

      const labels = resolveMatchLabels(assignedMatch, {
        entries: currentEvent?.entries || [],
        players: state.players,
        courts,
      });

      const liveRecord = buildMatchLiveRecord({
        clubId: activeClubId,
        tournamentId,
        eventId: currentEvent?.id,
        match: assignedMatch,
        labels,
        isDaily,
        tournamentName: currentTournament.name,
      });

      const syncResult = await upsertMatchLive(liveRecord);
      if (!syncResult.ok) {
        return { ok: false, error: syncResult.error || "Không đồng bộ được lên cloud." };
      }

      return { ok: true };
    },
    [
      activeClubId,
      courts,
      isDaily,
      persistEvent,
      persistTournament,
      state.players,
      tournamentId,
      tournamentRef,
      activeEventRef,
    ]
  );

  const tryAutoAssignCourtReferee = useCallback(
    async (match, courtId) => {
      if (!match || !courtId || !hasSupabaseConfig() || match.referee?.token) {
        return;
      }

      const rosterEntry = resolveCourtRefereeForAssignment(tournamentRef.current, courtId);
      if (!rosterEntry) {
        return;
      }

      const assigned = assignCourtRefereeToMatch(match, rosterEntry);
      if (!assigned) {
        return;
      }

      const result = await handleRefereeAssign(assigned);
      if (result?.ok) {
        setMessage(`Đã gán trọng tài ${rosterEntry.name} cho trận trên sân.`);
      }
    },
    [handleRefereeAssign, setMessage, tournamentRef]
  );

  const handleAssignCourt = useCallback(
    async (match) => {
      setError(null);

      if (isDaily) {
        const result = assignDailyDirectorMatch({
          tournament,
          courts,
          matchId: match.id,
          lockedCourtIds,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        if (persistTournament(buildDailyPlayTournamentPatch(result.settings))) {
          setMessage("Đã xếp trận vào sân trống.");
          const assignedMatch = result.settings.matches.find(
            (item) => String(item.id) === String(result.matchId)
          );
          await tryAutoAssignCourtReferee(assignedMatch, result.courtId);
        }
        return;
      }

      if (!activeEvent?.matches?.length) {
        setError("Giải chưa có lịch trận. Quay lại setup để tạo bảng đấu.");
        return;
      }

      const result = assignTournamentMatchToAvailableCourt({
        matches: activeEvent.matches,
        courts,
        matchId: match.id,
        lockedCourtIds,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (persistEvent({ ...activeEvent, matches: result.matches })) {
        setMessage("Đã xếp trận và bắt đầu trận đấu.");
        const assignedMatch = result.matches.find((item) => String(item.id) === String(match.id));
        await tryAutoAssignCourtReferee(assignedMatch, result.courtId);
      }
    },
    [
      activeEvent,
      courts,
      isDaily,
      lockedCourtIds,
      persistEvent,
      persistTournament,
      setError,
      setMessage,
      tournament,
      tryAutoAssignCourtReferee,
    ]
  );

  const handleToggleCourt = useCallback(
    (courtId, locked) => {
      if (locked) {
        unlockCourt(courtId, activeClubId);
      } else {
        lockCourt(courtId, activeClubId);
      }
      setLocalRevision((value) => value + 1);
    },
    [activeClubId, setLocalRevision]
  );

  const handleOpenScore = useCallback(
    (match) => {
      const liveRow = liveByMatchId[String(match.id)];
      const useLiveScore =
        liveRow && (liveRow.status === "playing" || liveRow.status === "finalize_requested");

      setScoreDialog(match);
      setScoreA(
        useLiveScore ? String(liveRow.scoreA) : match.scoreA != null ? String(match.scoreA) : ""
      );
      setScoreB(
        useLiveScore ? String(liveRow.scoreB) : match.scoreB != null ? String(match.scoreB) : ""
      );
      setScoreNote("");
    },
    [liveByMatchId, setScoreA, setScoreB, setScoreDialog, setScoreNote]
  );

  const handleDisputeResetLive = useCallback(
    async (match) => {
      setError(null);
      const liveRow = liveByMatchId[String(match.id)];

      if (!liveRow) {
        setError("Trận này chưa có điểm live từ trọng tài.");
        return;
      }

      const resetResult = await resetMatchLiveForDispute(liveRow.id, { actorName: "BTC" });
      if (!resetResult.ok) {
        setError(resetResult.error);
        return;
      }

      const logPatch = patchScoreLogInTournament(tournament, {
        eventId: activeEvent?.id,
        matchId: match.id,
        entry:
          resetResult.resetEntry ||
          buildDisputeResetLogEntry("BTC", "", {
            matchId: match.id,
            refereeToken: liveRow.refereeToken,
            oldScoreA: liveRow.scoreA,
            oldScoreB: liveRow.scoreB,
          }),
        isDaily,
      });

      if (!logPatch) {
        setError("Không ghi được lịch sử tranh chấp.");
        return;
      }

      const persisted = isDaily
        ? persistTournament(logPatch)
        : persistEvent(
            (logPatch.events || []).find((event) => String(event.id) === String(activeEvent?.id)) ||
              activeEvent
          );

      if (persisted) {
        setMessage("Đã reset điểm live — trọng tài có thể nhập lại.");
      }
    },
    [
      activeEvent,
      isDaily,
      liveByMatchId,
      persistEvent,
      persistTournament,
      setError,
      setMessage,
      tournament,
    ]
  );

  const handleSubmitScore = useCallback(async () => {
    if (!scoreDialog) {
      return;
    }

    setError(null);

    const liveRow = liveByMatchId[String(scoreDialog.id)];
    const logEntry = buildDirectorScoreLogEntry({
      scoreA,
      scoreB,
      source: resolveDirectorScoreLogSource(scoreDialog, liveRow),
      note: scoreNote,
      matchId: scoreDialog.id,
      refereeToken: scoreDialog.referee?.token || liveRow?.refereeToken || "",
      oldScoreA: liveRow?.scoreA ?? scoreDialog.scoreA ?? 0,
      oldScoreB: liveRow?.scoreB ?? scoreDialog.scoreB ?? 0,
    });

    if (isDaily) {
      const result = submitDailyDirectorMatchScore(
        tournament,
        scoreDialog.id,
        { scoreA, scoreB },
        { allowDraw: false }
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.releasedCourtId) {
        unlockCourt(result.releasedCourtId, activeClubId);
      }

      const settingsWithLog = appendScoreLogAfterDailySubmit(
        result.settings,
        scoreDialog.id,
        logEntry
      );

      if (
        persistTournament(buildDailyPlayTournamentPatch(settingsWithLog), {
          processMatchId: scoreDialog.id,
        })
      ) {
        if (liveRow) {
          await markMatchLiveProcessed(liveRow.id);
        }
        setScoreDialog(null);
        setMessage(
          logEntry.action === "admin_override" || logEntry.source === "director_override"
            ? "BTC đã ghi đè kết quả trọng tài."
            : "Đã lưu kết quả Daily Play."
        );
      }
      return;
    }

    const result = submitTournamentDirectorMatchScore(
      activeEvent,
      scoreDialog.id,
      { scoreA, scoreB },
      { allowDraw: false }
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.releasedCourtId) {
      unlockCourt(result.releasedCourtId, activeClubId);
    }

    const eventWithLog = appendScoreLogAfterEventSubmit(result.event, scoreDialog.id, logEntry);

    if (persistEvent(eventWithLog, { processMatchId: scoreDialog.id })) {
      if (liveRow) {
        await markMatchLiveProcessed(liveRow.id);
      }
      setScoreDialog(null);
      setMessage(
        logEntry.action === "admin_override" || logEntry.source === "director_override"
          ? "BTC đã ghi đè kết quả trọng tài."
          : scoreDialog.isKnockout
            ? "Đã lưu kết quả knock-out và cập nhật bracket."
            : result.bracketAutoGenerated
              ? `Đã lưu kết quả vòng bảng. Tự động tạo bracket (${result.bracketKnockoutMatchCount} trận).`
              : "Đã lưu kết quả vòng bảng."
      );
    }
  }, [
    activeClubId,
    activeEvent,
    isDaily,
    liveByMatchId,
    persistEvent,
    persistTournament,
    scoreA,
    scoreB,
    scoreDialog,
    scoreNote,
    setError,
    setMessage,
    setScoreDialog,
    tournament,
  ]);

  const handleCourtRefereeChange = useCallback(
    (courtId, rosterId) => {
      const patch = buildRefereeSettingsPatch(tournament, {
        courtReferees: setCourtRefereeAssignment(refereeSettings.courtReferees, courtId, rosterId),
      });

      if (persistTournament(patch)) {
        setMessage(
          rosterId ? "Đã gán trọng tài cố định cho sân." : "Đã bỏ trọng tài cố định khỏi sân."
        );
      }
    },
    [persistTournament, refereeSettings.courtReferees, setMessage, tournament]
  );

  const buildRefereeCardProps = useCallback(
    (match, options = {}) => {
      const liveRow = liveByMatchId[String(match.id)];
      const { showRefereeStatus = true, ...cardOptions } = options;

      return buildDirectorMatchCardProps(match, {
        ...cardOptions,
        courts,
        liveRow,
        showRefereeStatus,
        refereeStatus:
          showRefereeStatus && hasSupabaseConfig() ? { match, liveRow } : null,
      });
    },
    [courts, liveByMatchId]
  );

  return {
    persistTournament,
    persistEvent,
    handleRefereeAssign,
    handleAssignCourt,
    handleToggleCourt,
    handleOpenScore,
    handleDisputeResetLive,
    handleSubmitScore,
    handleCourtRefereeChange,
    buildRefereeCardProps,
    handleOpenRefereeDialog: setRefereeDialogMatch,
    handleOpenAuditHistory: setAuditHistoryMatch,
  };
}
