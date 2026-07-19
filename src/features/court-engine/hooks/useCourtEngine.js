import { useCallback, useEffect, useMemo, useState } from "react";

import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { loadCourtsForClubScoped } from "../../../domain/courtService.js";
import { loadStaffForVenue } from "../../../data/staff.js";
import {
  isCourtEngineCloudEnabled,
  isCourtEngineMigrated,
  migrateLocalCourtEngineToCloud,
  pullCourtEngineFromCloud,
} from "../storage/courtEngineCloudStore.js";
import { subscribeCourtEngineCloud } from "../storage/courtEngineRealtime.js";
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
import { buildLocalCivilWindow } from "../services/courtEngineAvailabilityGuard.js";
import { resolveVenueTimezoneForClub } from "../../../domain/civilTime.js";

function resolveSessionAvailabilityWindow(session, clubId) {
  const duration = Number(session?.config?.defaultMatchMinutes) || 20;
  const tz = resolveVenueTimezoneForClub(clubId);
  if (!tz.ok) {
    return { ok: false, error: tz.error, code: tz.code };
  }
  const built = buildLocalCivilWindow(duration, new Date(), tz.timezone);
  if (!built.ok) {
    return { ok: false, error: built.error, code: built.code };
  }
  return {
    ok: true,
    date: built.date,
    startTime: built.startTime,
    endTime: built.endTime,
    timezone: tz.timezone,
  };
}

export function useCourtEngine() {
  const { activeClubId, activeClub, revision } = useClub();
  const { currentTenantId } = useTenant();
  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cloudHydrated, setCloudHydrated] = useState(false);

  const storageOptions = useMemo(
    () => ({ tenantId: currentTenantId }),
    [currentTenantId]
  );

  const bump = useCallback(() => setLocalRevision((v) => v + 1), []);

  const session = useMemo(() => {
    void revision;
    void localRevision;
    void cloudHydrated;
    return getActiveSession(activeClubId, storageOptions);
  }, [activeClubId, revision, localRevision, cloudHydrated, storageOptions]);

  const players = useMemo(() => {
    void revision;
    void localRevision;
    return loadPlayersForClub(activeClubId);
  }, [activeClubId, revision, localRevision]);

  const courts = useMemo(() => {
    void revision;
    void localRevision;
    // Phase 2F: CE session is club-keyed — never load venue-union courts into this session.
    return loadCourtsForClubScoped(activeClubId, currentTenantId);
  }, [activeClubId, currentTenantId, revision, localRevision]);

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
    if (!activeClubId || !currentTenantId || !isCourtEngineCloudEnabled()) {
      setCloudHydrated(true);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      if (!isCourtEngineMigrated(activeClubId, currentTenantId)) {
        void migrateLocalCourtEngineToCloud(activeClubId, currentTenantId).then((result) => {
          if (!cancelled && result.ok && result.migrated) {
            setMessage("Đã đồng bộ dữ liệu Court Engine lên cloud.");
          }
        });
      }

      const pull = await pullCourtEngineFromCloud(activeClubId, currentTenantId);
      if (!cancelled) {
        if (pull.ok && pull.found) {
          bump();
        }
        setCloudHydrated(true);
      }
    }

    void hydrate();

    const unsubscribeRealtime = subscribeCourtEngineCloud(activeClubId, currentTenantId, () => {
      bump();
    });

    const pollMs = () => (document.hidden ? 30000 : 15000);

    let pollTimer = null;
    const schedulePoll = () => {
      window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(async () => {
        const pull = await pullCourtEngineFromCloud(activeClubId, currentTenantId);
        if (pull.ok && pull.found) {
          bump();
        }
        schedulePoll();
      }, pollMs());
    };

    schedulePoll();

    const onVisibility = () => {
      if (!document.hidden) {
        void pullCourtEngineFromCloud(activeClubId, currentTenantId).then((pull) => {
          if (pull.ok && pull.found) {
            bump();
          }
        });
      }
      schedulePoll();
    };

    document.addEventListener("visibilitychange", onVisibility);

    const onConflict = () => {
      setError("Dữ liệu đã được cập nhật bởi người khác — đang tải lại...");
      void pullCourtEngineFromCloud(activeClubId, currentTenantId).then((pull) => {
        if (pull.ok) {
          bump();
          setError(null);
        }
      });
    };

    window.addEventListener("court-engine:version-conflict", onConflict);

    return () => {
      cancelled = true;
      unsubscribeRealtime();
      window.clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("court-engine:version-conflict", onConflict);
    };
  }, [activeClubId, currentTenantId, bump]);

  useEffect(() => {
    if (!session && activeClubId && cloudHydrated) {
      createSession(activeClubId, {
        tenantId: currentTenantId,
        name: `Phiên ${new Date().toLocaleDateString("vi-VN")}`,
      });
      bump();
    }
  }, [session, activeClubId, currentTenantId, cloudHydrated, bump]);

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
        if (!activeClubId) {
          setError("Thiếu clubId — không thể ghép sân (Venue & Court).");
          return;
        }
        const window = resolveSessionAvailabilityWindow(session, activeClubId);
        if (!window.ok) {
          setError(window.error);
          return;
        }
        const result = previewAutoAssign(session, {
          courts,
          players,
          refereeList,
          clubId: activeClubId,
          date: window.date,
          startTime: window.startTime,
          endTime: window.endTime,
        });
        if (result.ok === false) {
          setError(result.error || result.warnings?.[0] || "Không ghép được sân.");
          setPreview(null);
          return;
        }
        setPreview(result);
        logAutoAssignPreview(activeClubId, session, result);
        bump();
      },
      confirmAutoAssign: () => {
        if (!session || !preview?.assignments?.length) return;
        if (!activeClubId) {
          setError("Thiếu clubId — không thể xác nhận assignment.");
          return;
        }
        const window = resolveSessionAvailabilityWindow(session, activeClubId);
        if (!window.ok) {
          setError(window.error);
          return;
        }
        const result = confirmAutoAssign(
          activeClubId,
          session,
          preview.assignments,
          null,
          {
            date: window.date,
            startTime: window.startTime,
            endTime: window.endTime,
          }
        );
        handleResult(result, `Đã xác nhận ${preview.assignments.length} trận.`);
        if (result?.ok) {
          setPreview(null);
        }
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
      transfer: (assignmentId, toCourtId, reason) => {
        if (!session) return;
        if (!activeClubId) {
          setError("Thiếu clubId — không thể chuyển sân.");
          return;
        }
        const window = resolveSessionAvailabilityWindow(session, activeClubId);
        if (!window.ok) {
          setError(window.error);
          return;
        }
        return handleResult(
          performTransfer(activeClubId, session, assignmentId, toCourtId, {
            reason,
            clubId: activeClubId,
            date: window.date,
            startTime: window.startTime,
            endTime: window.endTime,
          }),
          "Chuyển sân thành công."
        );
      },
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
