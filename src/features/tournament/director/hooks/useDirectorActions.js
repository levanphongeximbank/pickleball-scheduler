import { useCallback, useMemo } from "react";

import { lockCourt, unlockCourt } from "../../../../ai/director.js";
import { buildDirectorMatchCardProps } from "../../../../components/tournament/matchCardProps.js";
import {
  hasSupabaseConfig,
  markMatchLiveProcessed,
  resetMatchLiveForDispute,
  upsertMatchLive,
} from "../../../../domain/matchLiveSync.js";
import {
  setTournamentStatusCommand,
  updateTournamentCommand,
} from "../../services/tournamentCommands.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../../models/tournament/index.js";
import {
  assignTournamentMatchToAvailableCourt,
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
  appendScoreLogAfterEventSubmit,
  buildDirectorScoreLogEntry,
  buildDisputeResetLogEntry,
  patchScoreLogInTournament,
  resolveDirectorScoreLogSource,
} from "../../../../tournament/engines/scoreHistoryEngine.js";
import {
  buildDailyMatchRefereeAssignmentPatch,
  persistDailyRefereeMetadata,
} from "../services/dailyRefereeMetadataPatch.js";
import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  validateScoreInput,
} from "../../../daily-play/canonical/index.js";

const DAILY_LOCK_UNSUPPORTED =
  "Khóa sân thủ công chưa hỗ trợ trong Daily canonical.";

export function useDirectorActions(state) {
  const {
    activeClubId,
    activeClub,
    tenantId,
    refreshClubs,
    tournament,
    applyDailyTournamentOverlay,
    courts,
    players,
    isDaily,
    dailySession,
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
    scoreCorrectionMode,
    setScoreCorrectionMode,
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

  const sessionCompleted =
    isDaily && String(tournament?.status) === "completed";

  const denyCompleted = useCallback(() => {
    if (!sessionCompleted) return false;
    setError(DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.SESSION_ALREADY_COMPLETED]);
    return true;
  }, [sessionCompleted, setError]);

  const clubScope = useMemo(
    () =>
      activeClub || {
        id: activeClubId,
        clubId: activeClubId,
        tenantId,
        venueId: tenantId,
      },
    [activeClub, activeClubId, tenantId]
  );

  const persistTournament = useCallback(
    async (patch, options = {}) => {
      if (isDaily && options.allowDailyCriticalPayload !== true) {
        setError("Daily Director không ghi payload giải cho thao tác vòng đời trận.");
        return false;
      }

      const result = await updateTournamentCommand(clubScope, tournamentId, patch, {
        ...options,
        tenantId,
        directorMode: true,
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }

      if (options.processMatchId && result.lifecycleOk === false) {
        setError(
          result.lifecycleError ||
            "Đã lưu kết quả nhưng cập nhật Elo/điểm mùa thất bại."
        );
      }

      if (tournament?.status !== TOURNAMENT_STATUS.ACTIVE) {
        await setTournamentStatusCommand(clubScope, tournamentId, TOURNAMENT_STATUS.ACTIVE, {
          directorMode: true,
          tenantId,
        });
      }

      if (!isDaily) {
        setLocalRevision((value) => value + 1);
        refreshClubs();
      }
      return {
        ok: true,
        tournament: result.tournament,
        lifecycleOk: result.lifecycleOk !== false,
        lifecycleError: result.lifecycleError || null,
      };
    },
    [
      clubScope,
      isDaily,
      refreshClubs,
      setError,
      setLocalRevision,
      tenantId,
      tournament?.status,
      tournamentId,
    ]
  );

  const persistEvent = useCallback(
    async (nextEvent, options = {}) => {
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

  const persistDailyReferee = useCallback(
    async (metadataPatch) => {
      const result = await persistDailyRefereeMetadata({
        clubOrScope: clubScope,
        tournamentId,
        metadataPatch,
        tenantId,
      });
      if (!result.ok) {
        setError(result.error || "Không lưu được thông tin trọng tài.");
        return false;
      }
      if (result.tournament) {
        applyDailyTournamentOverlay?.(result.tournament);
      }
      return result;
    },
    [applyDailyTournamentOverlay, clubScope, setError, tenantId, tournamentId]
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

      let persisted;
      if (isDaily) {
        const metadataPatch = buildDailyMatchRefereeAssignmentPatch(
          assignedMatch.id,
          referee
        );
        persisted = await persistDailyReferee(metadataPatch);
      } else {
        const patch = patchRefereeInTournament(currentTournament, {
          eventId: currentEvent?.id,
          matchId: assignedMatch.id,
          referee,
          isDaily: false,
        });
        if (!patch) {
          return { ok: false, error: "Không cập nhật được trận." };
        }
        const nextEvent = (patch.events || []).find(
          (event) => String(event.id) === String(currentEvent?.id)
        );
        persisted = nextEvent ? await persistEvent(nextEvent) : false;
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
        match: { ...assignedMatch, referee },
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
      persistDailyReferee,
      persistEvent,
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
        if (denyCompleted()) return;
        const result = await dailySession.assignCourt(match.id);
        if (!result?.ok) {
          if (result?.error) setError(result.error);
          return;
        }
        setMessage("Đã xếp trận vào sân (assigned). Bấm Bắt đầu trận để chơi.");
        const assignedMatch = (result.dailyPlay?.matches || dailySession.dailyPlay?.matches || []).find(
          (item) => String(item.id) === String(match.id)
        );
        await tryAutoAssignCourtReferee(assignedMatch || match, assignedMatch?.courtId);
        return;
      }

      if (!activeEvent?.matches?.length) {
        setError("Giải chưa có lịch trận. Quay lại setup để tạo bảng đấu.");
        return;
      }

      if (!activeClubId) {
        setError("Thiếu clubId — không thể xếp sân (Venue & Court).");
        return;
      }

      const courtSchedule = tournament?.courtSchedule || {};
      const result = assignTournamentMatchToAvailableCourt({
        matches: activeEvent.matches,
        courts,
        matchId: match.id,
        lockedCourtIds,
        clubId: activeClubId,
        date: courtSchedule.date || null,
        startTime: courtSchedule.startTime || null,
        endTime: courtSchedule.endTime || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (await persistEvent({ ...activeEvent, matches: result.matches })) {
        setMessage("Đã xếp trận và bắt đầu trận đấu.");
        const assignedMatch = result.matches.find((item) => String(item.id) === String(match.id));
        await tryAutoAssignCourtReferee(assignedMatch, result.courtId);
      }
    },
    [
      activeClubId,
      activeEvent,
      courts,
      dailySession,
      denyCompleted,
      isDaily,
      lockedCourtIds,
      persistEvent,
      setError,
      setMessage,
      tournament,
      tryAutoAssignCourtReferee,
    ]
  );

  const handleStartMatch = useCallback(
    async (match) => {
      if (!isDaily) return;
      if (denyCompleted()) return;
      setError(null);
      const result = await dailySession.startMatch(match.id);
      if (result?.ok) {
        setMessage("Đã bắt đầu trận.");
        return;
      }
      if (result?.error) setError(result.error);
    },
    [dailySession, denyCompleted, isDaily, setError, setMessage]
  );

  const handleCancelMatch = useCallback(
    async (match) => {
      if (!isDaily) return;
      if (denyCompleted()) return;
      setError(null);
      const result = await dailySession.cancelMatch(match.id);
      if (result?.ok) {
        setMessage("Đã hủy trận và giải phóng sân/VĐV.");
        return;
      }
      if (result?.error) setError(result.error);
    },
    [dailySession, denyCompleted, isDaily, setError, setMessage]
  );

  const handleChangeCourt = useCallback(
    async (match, courtId) => {
      if (!isDaily) return;
      if (denyCompleted()) return;
      setError(null);
      const result = await dailySession.changeCourt(match.id, courtId);
      if (result?.ok) {
        setMessage("Đã đổi sân.");
        return;
      }
      if (result?.error) setError(result.error);
    },
    [dailySession, denyCompleted, isDaily, setError, setMessage]
  );

  const handleToggleCourt = useCallback(
    (courtId, locked) => {
      if (isDaily) {
        setError(DAILY_LOCK_UNSUPPORTED);
        return;
      }
      if (locked) {
        unlockCourt(courtId, activeClubId);
      } else {
        lockCourt(courtId, activeClubId);
      }
      setLocalRevision((value) => value + 1);
    },
    [activeClubId, isDaily, setError, setLocalRevision]
  );

  const handleOpenScore = useCallback(
    (match) => {
      const liveRow = liveByMatchId[String(match.id)];
      const useLiveScore =
        liveRow && (liveRow.status === "playing" || liveRow.status === "finalize_requested");

      setScoreCorrectionMode(false);
      setScoreDialog(match);
      setScoreA(
        useLiveScore ? String(liveRow.scoreA) : match.scoreA != null ? String(match.scoreA) : ""
      );
      setScoreB(
        useLiveScore ? String(liveRow.scoreB) : match.scoreB != null ? String(match.scoreB) : ""
      );
      setScoreNote("");
    },
    [liveByMatchId, setScoreA, setScoreB, setScoreCorrectionMode, setScoreDialog, setScoreNote]
  );

  const handleOpenCorrectScore = useCallback(
    (match) => {
      setScoreCorrectionMode(true);
      setScoreDialog(match);
      setScoreA(match.scoreA != null ? String(match.scoreA) : "");
      setScoreB(match.scoreB != null ? String(match.scoreB) : "");
      setScoreNote("");
    },
    [setScoreA, setScoreB, setScoreCorrectionMode, setScoreDialog, setScoreNote]
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

      if (isDaily) {
        setMessage("Đã reset điểm live — trọng tài có thể nhập lại.");
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
        isDaily: false,
      });

      if (!logPatch) {
        setError("Không ghi được lịch sử tranh chấp.");
        return;
      }

      const persisted = await persistEvent(
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
      const parsed = validateScoreInput(scoreA, scoreB);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      if (scoreCorrectionMode) {
        if (String(scoreDialog.status) !== "completed") {
          setError(DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.MATCH_NOT_COMPLETED]);
          return;
        }
        const result = await dailySession.correctScore(
          scoreDialog.id,
          scoreA,
          scoreB,
          scoreNote
        );
        if (!result?.ok) {
          if (result?.error) setError(result.error);
          return;
        }
        setScoreDialog(null);
        setScoreCorrectionMode(false);
        setMessage("Đã sửa điểm trận hoàn tất.");
        return;
      }
      if (denyCompleted()) return;
      const result = await dailySession.submitScore(scoreDialog.id, scoreA, scoreB);
      if (!result?.ok) {
        if (result?.error) setError(result.error);
        return;
      }
      if (liveRow) {
        await markMatchLiveProcessed(liveRow.id);
      }
      setScoreDialog(null);
      setScoreCorrectionMode(false);
      setMessage(
        logEntry.action === "admin_override" || logEntry.source === "director_override"
          ? "BTC đã ghi đè kết quả trọng tài."
          : "Đã lưu kết quả Daily Play."
      );
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

    if (await persistEvent(eventWithLog, { processMatchId: scoreDialog.id })) {
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
    dailySession,
    denyCompleted,
    isDaily,
    liveByMatchId,
    persistEvent,
    scoreA,
    scoreB,
    scoreCorrectionMode,
    scoreDialog,
    scoreNote,
    setError,
    setScoreCorrectionMode,
    setMessage,
    setScoreDialog,
  ]);

  const handleCourtRefereeChange = useCallback(
    async (courtId, rosterId) => {
      const nextCourtReferees = setCourtRefereeAssignment(
        refereeSettings.courtReferees,
        courtId,
        rosterId
      );
      if (isDaily) {
        const persisted = await persistDailyReferee({ courtReferees: nextCourtReferees });
        if (persisted) {
          setMessage(
            rosterId ? "Đã gán trọng tài cố định cho sân." : "Đã bỏ trọng tài cố định khỏi sân."
          );
        }
        return;
      }

      const patch = buildRefereeSettingsPatch(tournament, {
        courtReferees: nextCourtReferees,
      });

      if (await persistTournament(patch)) {
        setMessage(
          rosterId ? "Đã gán trọng tài cố định cho sân." : "Đã bỏ trọng tài cố định khỏi sân."
        );
      }
    },
    [
      isDaily,
      persistDailyReferee,
      persistTournament,
      refereeSettings.courtReferees,
      setMessage,
      tournament,
    ]
  );

  const buildRefereeCardProps = useCallback(
    (match, options = {}) => {
      const liveRow = liveByMatchId[String(match.id)];
      const { showRefereeStatus = true, ...cardOptions } = options;

      return buildDirectorMatchCardProps(match, {
        ...cardOptions,
        courts,
        players,
        liveRow,
        showRefereeStatus,
        refereeStatus:
          showRefereeStatus && hasSupabaseConfig() ? { match, liveRow } : null,
      });
    },
    [courts, liveByMatchId, players]
  );

  return {
    persistTournament,
    persistEvent,
    handleRefereeAssign,
    handleAssignCourt,
    handleStartMatch,
    handleCancelMatch,
    handleChangeCourt,
    handleToggleCourt,
    handleOpenScore,
    handleOpenCorrectScore,
    handleDisputeResetLive,
    handleSubmitScore,
    handleCourtRefereeChange,
    buildRefereeCardProps,
    handleOpenRefereeDialog: setRefereeDialogMatch,
    handleOpenAuditHistory: setAuditHistoryMatch,
  };
}
