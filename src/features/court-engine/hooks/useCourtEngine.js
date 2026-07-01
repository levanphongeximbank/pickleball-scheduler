import { useCallback, useEffect, useMemo, useState } from "react";

import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { loadCourtsForClub, loadPlayersForClub } from "../../../domain/clubStorage.js";
import { loadStaffForVenue } from "../../../data/staff.js";
import {
  createSession,
  getActiveSession,
  openSession,
  closeSession,
  getSessionSummary,
  previewAutoAssign,
  confirmAutoAssign,
  performCheckIn,
  performCancelCheckIn,
  performNoShow,
  performAddToQueue,
  performRemoveFromQueue,
  performSetPriority,
  performSetQueueLocked,
  performStartMatch,
  performPauseMatch,
  performResumeMatch,
  performEndMatch,
  performTransfer,
  performCourtLock,
  performCourtMaintenance,
  performAssignReferee,
  performReleaseReferee,
  logAutoAssignPreview,
  buildRefereeRosterFromStaff,
  getActiveQueueEntries,
  getMatchElapsedMinutes,
  resolveTimerStatus,
} from "../services/courtEngineService.js";
import { SESSION_STATUS } from "../constants/statuses.js";

export function useCourtEngine() {
  const { activeClubId, activeClub, revision } = useClub();
  const { currentTenantId } = useTenant();
  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const bump = useCallback(() => setLocalRevision((v) => v + 1), []);

  const session = useMemo(() => {
    void revision;
    void localRevision;
    return getActiveSession(activeClubId);
  }, [activeClubId, revision, localRevision]);

  const players = useMemo(() => {
    void revision;
    void localRevision;
    return loadPlayersForClub(activeClubId);
  }, [activeClubId, revision, localRevision]);

  const courts = useMemo(() => {
    void revision;
    void localRevision;
    return loadCourtsForClub(activeClubId).filter((court) => court.active !== false);
  }, [activeClubId, revision, localRevision]);

  const refereeList = useMemo(() => {
    const venueId = activeClub?.venueId || currentTenantId;
    if (!venueId) {
      return [];
    }
    return buildRefereeRosterFromStaff(loadStaffForVenue(venueId));
  }, [activeClub?.venueId, currentTenantId]);

  const summary = useMemo(
    () => (session ? getSessionSummary(session) : null),
    [session]
  );

  const queueEntries = useMemo(
    () => (session ? getActiveQueueEntries(session) : []),
    [session]
  );

  const playersById = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  );

  useEffect(() => {
    if (!session && activeClubId) {
      createSession(activeClubId, {
        tenantId: currentTenantId,
        name: `Phiên ${new Date().toLocaleDateString("vi-VN")}`,
      });
      bump();
    }
  }, [session, activeClubId, currentTenantId, bump]);

  const handleResult = useCallback(
    (result, successMessage) => {
      if (!result?.ok) {
        setError(result?.error || "Thao tác thất bại.");
        return false;
      }
      if (successMessage) {
        setMessage(successMessage);
      }
      bump();
      return true;
    },
    [bump]
  );

  const ensureOpenSession = useCallback(() => {
    if (!session) {
      setError("Chưa có session.");
      return false;
    }
    if (session.status !== SESSION_STATUS.OPEN) {
      const result = openSession(activeClubId, session.id);
      handleResult(result, "Đã mở session.");
    }
    return true;
  }, [session, activeClubId, handleResult]);

  return {
    session,
    players,
    courts,
    refereeList,
    summary,
    queueEntries,
    playersById,
    message,
    error,
    preview,
    setMessage,
    setError,
    setPreview,
    bump,
    handleResult,
    ensureOpenSession,
    actions: {
      openSession: () =>
        session &&
        handleResult(openSession(activeClubId, session.id), "Session đã mở."),
      closeSession: () =>
        session &&
        handleResult(closeSession(activeClubId, session.id), "Session đã đóng."),
      checkIn: (playerId) =>
        session &&
        handleResult(performCheckIn(activeClubId, session, playerId), "Check-in thành công."),
      cancelCheckIn: (playerId) =>
        session &&
        handleResult(performCancelCheckIn(activeClubId, session, playerId), "Đã hủy check-in."),
      noShow: (playerId) =>
        session &&
        handleResult(performNoShow(activeClubId, session, playerId), "Đã đánh dấu vắng mặt."),
      addToQueue: (playerId) =>
        session &&
        handleResult(performAddToQueue(activeClubId, session, playerId), "Đã thêm vào queue."),
      removeFromQueue: (playerId) =>
        session &&
        handleResult(performRemoveFromQueue(activeClubId, session, playerId), "Đã xóa khỏi queue."),
      setPriority: (playerId, priority) =>
        session &&
        handleResult(performSetPriority(activeClubId, session, playerId, priority), "Đã ưu tiên."),
      setQueueLocked: (playerId, locked) =>
        session &&
        handleResult(performSetQueueLocked(activeClubId, session, playerId, locked)),
      previewAutoAssign: () => {
        if (!session) return;
        const result = previewAutoAssign(session, { courts, players, refereeList });
        setPreview(result);
        logAutoAssignPreview(activeClubId, session, result);
        bump();
      },
      confirmAutoAssign: () => {
        if (!session || !preview?.assignments?.length) return;
        handleResult(
          confirmAutoAssign(activeClubId, session, preview.assignments),
          `Đã xác nhận ${preview.assignments.length} trận.`
        );
        setPreview(null);
      },
      startMatch: (assignmentId) =>
        session &&
        handleResult(performStartMatch(activeClubId, session, assignmentId), "Trận đã bắt đầu."),
      pauseMatch: (assignmentId) =>
        session &&
        handleResult(performPauseMatch(activeClubId, session, assignmentId), "Trận đã pause."),
      resumeMatch: (assignmentId) =>
        session &&
        handleResult(performResumeMatch(activeClubId, session, assignmentId), "Trận đã resume."),
      endMatch: (assignmentId) =>
        session &&
        handleResult(performEndMatch(activeClubId, session, assignmentId), "Trận đã kết thúc."),
      transfer: (assignmentId, toCourtId, reason) =>
        session &&
        handleResult(
          performTransfer(activeClubId, session, assignmentId, toCourtId, { reason }),
          "Chuyển sân thành công."
        ),
      lockCourt: (courtId, locked) =>
        session && handleResult(performCourtLock(activeClubId, session, courtId, locked)),
      maintenanceCourt: (courtId, maintenance) =>
        session &&
        handleResult(performCourtMaintenance(activeClubId, session, courtId, maintenance)),
      assignReferee: (payload) =>
        session &&
        handleResult(performAssignReferee(activeClubId, session, payload), "Đã gán trọng tài."),
      releaseReferee: (courtId) =>
        session && handleResult(performReleaseReferee(activeClubId, session, courtId)),
    },
    utils: {
      getMatchElapsedMinutes,
      resolveTimerStatus,
    },
  };
}
