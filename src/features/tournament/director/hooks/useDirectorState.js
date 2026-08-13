import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getDirectorState } from "../../../../ai/director.js";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { useClub } from "../../../../context/ClubContext.jsx";
import { useAuth } from "../../../../context/AuthContext.jsx";
import { loadCourtsForClub, loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { assertLoadedTournamentAccess } from "../../guards/tournamentAccess.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import { useTenant } from "../../../../context/TenantContext.jsx";
import { TOURNAMENT_MODE } from "../../../../models/tournament/index.js";
import { buildTournamentDirectorSnapshot } from "../../../../tournament/engines/index.js";
import { hasSupabaseConfig } from "../../../../domain/matchLiveSync.js";
import { getRefereeSettings } from "../../../../tournament/engines/refereeEngine.js";
import { useMatchLiveScores } from "../../../../tournament/useMatchLiveScores.js";
import { useDailyPlayCanonicalSession } from "../../../daily-play/canonical/useDailyPlayCanonicalSession.js";
import { useClubPairingCandidatePool } from "../../../pairing-candidates/index.js";
import { shouldShowDirectorBlockingLoad } from "../directorLoadingGate.js";
import { buildDirectorBackPath } from "../services/directorService.js";
import { buildCanonicalDailyDirectorSnapshot } from "../services/dailyDirectorProjection.js";

export function useDirectorState(tournamentId) {
  const [searchParams] = useSearchParams();
  const { activeClubId, activeClub, refreshClubs } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();
  const { currentTenantId } = useTenant();

  const tenantId = activeClub?.tenantId || activeClub?.venueId || null;

  const canUseDirector =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.DIRECTOR_USE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    }) ||
    can(PERMISSIONS.TOURNAMENT_UPDATE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });

  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [scoreDialog, setScoreDialog] = useState(null);
  const [scoreCorrectionMode, setScoreCorrectionMode] = useState(false);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [scoreNote, setScoreNote] = useState("");
  const [activeEventId, setActiveEventId] = useState(searchParams.get("eventId") || "");
  const [refereeDialogMatch, setRefereeDialogMatch] = useState(null);
  const [auditHistoryMatch, setAuditHistoryMatch] = useState(null);

  const { liveByMatchId, error: liveError } = useMatchLiveScores(
    activeClubId,
    tournamentId,
    hasSupabaseConfig()
  );

  // DP-12: explicit tenant from activeClub object — never a clubId string.
  const {
    tournament: loadedTournament,
    loading: tournamentLoading,
    error: tournamentLoadError,
  } = useCanonicalTournament(activeClub, tournamentId, localRevision);

  const [dailyTournamentOverlay, setDailyTournamentOverlay] = useState(null);
  const tournament = dailyTournamentOverlay || loadedTournament;
  const isDaily = tournament?.mode === TOURNAMENT_MODE.DAILY_PLAY;

  useEffect(() => {
    setDailyTournamentOverlay(null);
  }, [loadedTournament]);

  const dailySession = useDailyPlayCanonicalSession({
    tenantId,
    clubId: activeClubId,
    tournamentId,
    enabled: Boolean(isDaily && tenantId && activeClubId && tournamentId),
    pollMs: 15000,
  });

  const pairingPool = useClubPairingCandidatePool(isDaily ? activeClubId : null, {
    revision: 0,
  });

  const tournamentAccess = useMemo(() => {
    if (!rbacEnabled || !isAuthenticated) {
      return { ok: true };
    }
    if (tournamentLoading) {
      return { ok: true, pending: true };
    }
    return assertLoadedTournamentAccess(activeClubId, tournament, {
      tenantId: currentTenantId || tenantId,
    });
  }, [
    activeClubId,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    tenantId,
    tournament,
    tournamentLoading,
  ]);

  const legacyPlayers = useMemo(
    () => (isDaily ? [] : loadPlayersForClub(activeClubId)),
    [activeClubId, isDaily, localRevision]
  );

  const legacyCourts = useMemo(
    () =>
      isDaily
        ? []
        : loadCourtsForClub(activeClubId).filter((court) => court.active !== false),
    [activeClubId, isDaily, localRevision]
  );

  const players = useMemo(
    () => (isDaily ? pairingPool.players || [] : legacyPlayers),
    [isDaily, pairingPool.players, legacyPlayers]
  );
  const courts = useMemo(
    () => (isDaily ? dailySession.courts || [] : legacyCourts),
    [isDaily, dailySession.courts, legacyCourts]
  );

  const savedEvents = tournament?.events || [];
  const activeEvent =
    savedEvents.find((event) => String(event.id) === String(activeEventId)) ||
    savedEvents.find((event) => (event.matches || []).length > 0) ||
    savedEvents[0] ||
    null;

  const lockedCourtIds = useMemo(
    () => (isDaily ? [] : getDirectorState(activeClubId).lockedCourts || []),
    [activeClubId, isDaily, localRevision]
  );

  const snapshot = useMemo(() => {
    if (isDaily) {
      return buildCanonicalDailyDirectorSnapshot({
        tournament,
        session: {
          dailyPlay: dailySession.dailyPlay,
          courts: dailySession.courts,
          courtStates: dailySession.courtStates,
          leases: dailySession.leases,
        },
        players,
      });
    }
    return buildTournamentDirectorSnapshot({
      tournament,
      event: activeEvent,
      courts,
      players,
      lockedCourtIds,
    });
  }, [
    activeEvent,
    courts,
    dailySession.courtStates,
    dailySession.courts,
    dailySession.dailyPlay,
    dailySession.leases,
    isDaily,
    lockedCourtIds,
    players,
    tournament,
  ]);

  const refereeSettings = useMemo(() => getRefereeSettings(tournament), [tournament]);

  useEffect(() => {
    if (!activeEventId && activeEvent?.id) {
      setActiveEventId(activeEvent.id);
    }
  }, [activeEventId, activeEvent?.id]);

  const tournamentRef = useRef(tournament);
  const activeEventRef = useRef(activeEvent);
  const dailySessionRef = useRef(dailySession);

  useEffect(() => {
    tournamentRef.current = tournament;
    activeEventRef.current = activeEvent;
    dailySessionRef.current = dailySession;
  }, [tournament, activeEvent, dailySession]);

  const backPath = buildDirectorBackPath(tournament, tournamentId);
  const waitingMatches = snapshot.matches?.waiting || [];
  const assignedMatches = snapshot.matches?.assigned || [];
  const onCourtMatches = snapshot.matches?.onCourt || snapshot.matches?.playing || [];
  const completedMatches = snapshot.matches?.completed || [];

  const initialLoading = shouldShowDirectorBlockingLoad({
    tournament,
    tournamentLoading,
    accessPending: false,
    isDaily,
    dailyState: dailySession.state,
    dailyLoading: dailySession.loading,
  });

  return {
    activeClubId,
    activeClub,
    tenantId,
    refreshClubs,
    canUseDirector,
    tournamentAccess,
    tournament,
    applyDailyTournamentOverlay: setDailyTournamentOverlay,
    tournamentLoading,
    tournamentLoadError,
    initialLoading,
    players,
    courts,
    isDaily,
    dailySession,
    dailySessionRef,
    savedEvents,
    activeEvent,
    lockedCourtIds,
    snapshot,
    refereeSettings,
    liveByMatchId,
    liveError,
    localRevision,
    setLocalRevision,
    message,
    setMessage,
    error: error || (isDaily ? dailySession.error : null),
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
    activeEventId,
    setActiveEventId,
    refereeDialogMatch,
    setRefereeDialogMatch,
    auditHistoryMatch,
    setAuditHistoryMatch,
    tournamentRef,
    activeEventRef,
    backPath,
    waitingMatches,
    assignedMatches,
    onCourtMatches,
    completedMatches,
    tournamentId,
  };
}
