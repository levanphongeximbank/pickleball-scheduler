import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getDirectorState } from "../../../../ai/director.js";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { useClub } from "../../../../context/ClubContext.jsx";
import { useAuth } from "../../../../context/AuthContext.jsx";
import { loadCourtsForClub, loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { getTournament } from "../../../../domain/tournamentService.js";
import { TOURNAMENT_MODE } from "../../../../models/tournament/index.js";
import { buildTournamentDirectorSnapshot } from "../../../../tournament/engines/index.js";
import { hasSupabaseConfig } from "../../../../domain/matchLiveSync.js";
import { getRefereeSettings } from "../../../../tournament/engines/refereeEngine.js";
import { useMatchLiveScores } from "../../../../tournament/useMatchLiveScores.js";
import { buildDirectorBackPath } from "../services/directorService.js";

export function useDirectorState(tournamentId) {
  const [searchParams] = useSearchParams();
  const { activeClubId, activeClub, refreshClubs } = useClub();
  const { can, rbacEnabled, isAuthenticated } = useAuth();

  const canUseDirector =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.TOURNAMENT_DIRECTOR, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    }) ||
    can(PERMISSIONS.TOURNAMENT_MANAGE, {
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
    });

  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [scoreDialog, setScoreDialog] = useState(null);
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

  const tournament = useMemo(
    () => getTournament(activeClubId, tournamentId),
    [activeClubId, tournamentId, localRevision]
  );

  const players = useMemo(
    () => loadPlayersForClub(activeClubId),
    [activeClubId, localRevision]
  );

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId).filter((court) => court.active !== false),
    [activeClubId, localRevision]
  );

  const isDaily = tournament?.mode === TOURNAMENT_MODE.DAILY_PLAY;
  const savedEvents = tournament?.events || [];
  const activeEvent =
    savedEvents.find((event) => String(event.id) === String(activeEventId)) ||
    savedEvents.find((event) => (event.matches || []).length > 0) ||
    savedEvents[0] ||
    null;

  const lockedCourtIds = useMemo(
    () => getDirectorState(activeClubId).lockedCourts || [],
    [activeClubId, localRevision]
  );

  const snapshot = useMemo(
    () =>
      buildTournamentDirectorSnapshot({
        tournament,
        event: activeEvent,
        courts,
        players,
        lockedCourtIds,
      }),
    [tournament, activeEvent, courts, players, lockedCourtIds]
  );

  const refereeSettings = useMemo(() => getRefereeSettings(tournament), [tournament]);

  useEffect(() => {
    if (!activeEventId && activeEvent?.id) {
      setActiveEventId(activeEvent.id);
    }
  }, [activeEventId, activeEvent?.id]);

  const tournamentRef = useRef(tournament);
  const activeEventRef = useRef(activeEvent);

  useEffect(() => {
    tournamentRef.current = tournament;
    activeEventRef.current = activeEvent;
  }, [tournament, activeEvent]);

  const backPath = buildDirectorBackPath(tournament, tournamentId);
  const waitingMatches = snapshot.matches?.waiting || [];
  const onCourtMatches = snapshot.matches?.onCourt || [];
  const completedMatches = snapshot.matches?.completed || [];

  return {
    activeClubId,
    refreshClubs,
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
    localRevision,
    setLocalRevision,
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
    onCourtMatches,
    completedMatches,
    tournamentId,
  };
}
