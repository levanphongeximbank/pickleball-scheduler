import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

import { getDirectorState, lockCourt, unlockCourt } from "../../ai/director.js";
import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { loadCourtsForClub, loadPlayersForClub } from "../../domain/clubStorage.js";
import {
  getTournament,
  setTournamentStatus,
  updateTournament,
} from "../../domain/tournamentService.js";
import { getCourtDisplayName } from "../../models/court.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import {
  assignDailyDirectorMatch,
  assignTournamentMatchToAvailableCourt,
  buildDailyPlayTournamentPatch,
  buildTournamentDirectorSnapshot,
  submitDailyDirectorMatchScore,
  submitTournamentDirectorMatchScore,
  upsertOfficialEvent,
} from "../../tournament/engines/index.js";
import BracketView from "../../components/tournament/BracketView.jsx";
import MatchListPanel from "../../components/tournament/MatchListPanel.jsx";
import RefereeAssignDialog from "../../components/tournament/RefereeAssignDialog.jsx";
import MatchAuditHistoryDialog from "../../components/tournament/MatchAuditHistoryDialog.jsx";
import ScoreLogHistory from "../../components/tournament/ScoreLogHistory.jsx";
import { buildDirectorMatchCardProps } from "../../components/tournament/matchCardProps.js";
import {
  hasSupabaseConfig,
  markMatchLiveProcessed,
  resetMatchLiveForDispute,
  upsertMatchLive,
} from "../../domain/matchLiveSync.js";
import {
  assignCourtRefereeToMatch,
  buildMatchLiveRecord,
  buildRefereeSettingsPatch,
  getRefereeSettings,
  patchRefereeInTournament,
  resolveCourtRefereeForAssignment,
  resolveCourtRefereeName,
  resolveMatchLabels,
  setCourtRefereeAssignment,
} from "../../tournament/engines/refereeEngine.js";
import {
  appendScoreLogAfterDailySubmit,
  appendScoreLogAfterEventSubmit,
  buildDirectorScoreLogEntry,
  buildDisputeResetLogEntry,
  mergeLiveAuditIntoDailySettings,
  mergeLiveAuditIntoEvent,
  patchScoreLogInTournament,
  resolveDirectorScoreLogSource,
} from "../../tournament/engines/scoreHistoryEngine.js";
import { useMatchLiveScores, useRefereeFinalizeQueue } from "../../tournament/useMatchLiveScores.js";

function MiniStandings({ standings = [] }) {
  if (!standings.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chua co bang xep hang.
      </Typography>
    );
  }

  return (
    <Grid container spacing={1}>
      {standings.map((groupStanding) => (
        <Grid key={groupStanding.group} size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 1 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
              Bang {groupStanding.group}
            </Typography>
            {groupStanding.standing.slice(0, 3).map((team, index) => (
              <Typography key={team.id} variant="caption" display="block">
                {index + 1}. {team.name} ({team.matchPoints}d)
              </Typography>
            ))}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

export default function TournamentDirectorMode() {
  const { tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  const refereeSettings = useMemo(
    () => getRefereeSettings(tournament),
    [tournament]
  );

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

  const handleRefereeFinalize = useCallback(async (row) => {
    const currentTournament = tournamentRef.current;
    const currentEvent = activeEventRef.current;
    if (!currentTournament || !row?.matchId) {
      return;
    }

    const scores = { scoreA: row.scoreA, scoreB: row.scoreB };
    const isDailyMode = currentTournament.mode === TOURNAMENT_MODE.DAILY_PLAY;

    if (isDailyMode) {
      const result = submitDailyDirectorMatchScore(currentTournament, row.matchId, scores, {
        allowDraw: false,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.releasedCourtId) {
        unlockCourt(result.releasedCourtId, activeClubId);
      }

      const settingsWithAudit = mergeLiveAuditIntoDailySettings(
        result.settings,
        row.matchId,
        row.auditLog || []
      );

      if (
        persistTournament(buildDailyPlayTournamentPatch(settingsWithAudit), {
          processMatchId: row.matchId,
        })
      ) {
        await markMatchLiveProcessed(row.id);
        setMessage(`Trß╗ìng t├ái ${row.refereeName} ─æ├ú chß╗æt: ${row.scoreA}-${row.scoreB}.`);
      }
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
      setMessage(`Trß╗ìng t├ái ${row.refereeName} ─æ├ú chß╗æt: ${row.scoreA}-${row.scoreB}.`);
    }
  }, [activeClubId]);

  useRefereeFinalizeQueue({
    liveByMatchId,
    onFinalize: handleRefereeFinalize,
    enabled: hasSupabaseConfig(),
  });

  const handleOpenRefereeDialog = (match) => {
    setRefereeDialogMatch(match);
  };

  const handleOpenAuditHistory = (match) => {
    setAuditHistoryMatch(match);
  };

  const buildRefereeCardProps = (match, options = {}) => {
    const liveRow = liveByMatchId[String(match.id)];
    return buildDirectorMatchCardProps(match, {
      ...options,
      liveRow,
      refereeStatus: hasSupabaseConfig() ? { match, liveRow } : null,
    });
  };

  const handleRefereeAssign = async ({ match: assignedMatch, referee }) => {
    const currentTournament = tournamentRef.current;
    const currentEvent = activeEventRef.current;
    if (!currentTournament) {
      return { ok: false, error: "Kh├┤ng t├¼m thß║Ñy giß║úi." };
    }

    if (!hasSupabaseConfig()) {
      return {
        ok: false,
        error: "Cß║ºn cß║Ñu h├¼nh Supabase (VITE_SUPABASE_URL) ─æß╗â d├╣ng chß║┐ ─æß╗Ö trß╗ìng t├ái.",
      };
    }

    const patch = patchRefereeInTournament(currentTournament, {
      eventId: currentEvent?.id,
      matchId: assignedMatch.id,
      referee,
      isDaily,
    });

    if (!patch) {
      return { ok: false, error: "Kh├┤ng cß║¡p nhß║¡t ─æ╞░ß╗úc trß║¡n." };
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
      return { ok: false, error: "Kh├┤ng l╞░u ─æ╞░ß╗úc th├┤ng tin trß╗ìng t├ái." };
    }

    const labels = resolveMatchLabels(assignedMatch, {
      entries: currentEvent?.entries || [],
      players,
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
      return { ok: false, error: syncResult.error || "Kh├┤ng ─æß╗ông bß╗Ö ─æ╞░ß╗úc l├¬n cloud." };
    }

    return { ok: true };
  };

  const tryAutoAssignCourtReferee = async (match, courtId) => {
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
      setMessage(`─É├ú g├ín trß╗ìng t├ái ${rosterEntry.name} cho trß║¡n tr├¬n s├ón.`);
    }
  };

  const handleCourtRefereeChange = (courtId, rosterId) => {
    const patch = buildRefereeSettingsPatch(tournament, {
      courtReferees: setCourtRefereeAssignment(refereeSettings.courtReferees, courtId, rosterId),
    });

    if (persistTournament(patch)) {
      setMessage(rosterId ? "─É├ú g├ín trß╗ìng t├ái cß╗æ ─æß╗ïnh cho s├ón." : "─É├ú bß╗Å trß╗ìng t├ái cß╗æ ─æß╗ïnh khß╗Åi s├ón.");
    }
  };

  const persistTournament = (patch, options = {}) => {
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
  };

  const persistEvent = (nextEvent, options = {}) => {
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
  };

  const handleAssignCourt = async (match) => {
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
        setMessage("─É├ú xß║┐p trß║¡n v├áo s├ón trß╗æng.");
        const assignedMatch = result.settings.matches.find(
          (item) => String(item.id) === String(result.matchId)
        );
        await tryAutoAssignCourtReferee(assignedMatch, result.courtId);
      }
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
      setMessage("─É├ú xß║┐p trß║¡n v├á bß║»t ─æß║ºu trß║¡n ─æß║Ñu.");
      const assignedMatch = result.matches.find(
        (item) => String(item.id) === String(match.id)
      );
      await tryAutoAssignCourtReferee(assignedMatch, result.courtId);
    }
  };

  const handleToggleCourt = (courtId, locked) => {
    if (locked) {
      unlockCourt(courtId, activeClubId);
    } else {
      lockCourt(courtId, activeClubId);
    }
    setLocalRevision((value) => value + 1);
  };

  const handleOpenScore = (match) => {
    const liveRow = liveByMatchId[String(match.id)];
    const useLiveScore =
      liveRow &&
      (liveRow.status === "playing" || liveRow.status === "finalize_requested");

    setScoreDialog(match);
    setScoreA(
      useLiveScore
        ? String(liveRow.scoreA)
        : match.scoreA != null
          ? String(match.scoreA)
          : ""
    );
    setScoreB(
      useLiveScore
        ? String(liveRow.scoreB)
        : match.scoreB != null
          ? String(match.scoreB)
          : ""
    );
    setScoreNote("");
  };

  const handleDisputeResetLive = async (match) => {
    setError(null);
    const liveRow = liveByMatchId[String(match.id)];

    if (!liveRow) {
      setError("Trß║¡n n├áy ch╞░a c├│ ─æiß╗âm live tß╗½ trß╗ìng t├ái.");
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
      setError("Kh├┤ng ghi ─æ╞░ß╗úc lß╗ïch sß╗¡ tranh chß║Ñp.");
      return;
    }

    const persisted = isDaily
      ? persistTournament(logPatch)
      : persistEvent(
          (logPatch.events || []).find((event) => String(event.id) === String(activeEvent?.id)) ||
            activeEvent
        );

    if (persisted) {
      setMessage("─É├ú reset ─æiß╗âm live ΓÇö trß╗ìng t├ái c├│ thß╗â nhß║¡p lß║íi.");
    }
  };

  const handleSubmitScore = async () => {
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
            ? "BTC ─æ├ú ghi ─æ├¿ kß║┐t quß║ú trß╗ìng t├ái."
            : "─É├ú l╞░u kß║┐t quß║ú Daily Play."
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
          ? "BTC ─æ├ú ghi ─æ├¿ kß║┐t quß║ú trß╗ìng t├ái."
          : scoreDialog.isKnockout
            ? "─É├ú l╞░u kß║┐t quß║ú knock-out v├á cß║¡p nhß║¡t bracket."
            : result.bracketAutoGenerated
              ? `─É├ú l╞░u kß║┐t quß║ú v├▓ng bß║úng. Tß╗▒ ─æß╗Öng tß║ío bracket (${result.bracketKnockoutMatchCount} trß║¡n).`
              : "─É├ú l╞░u kß║┐t quß║ú v├▓ng bß║úng."
      );
    }
  };

  const backPath = isDaily
    ? `/tournament/daily/${tournamentId}`
    : tournament?.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT
      ? `/tournament/internal/${tournamentId}`
      : `/tournament/official/${tournamentId}`;

  if (!canUseDirector) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Bß║ín kh├┤ng c├│ quyß╗ün Director Mode cho giß║úi n├áy.
        </Alert>
        <Button component={RouterLink} to="/tournament">
          Quay lß║íi danh s├ích giß║úi
        </Button>
      </Box>
    );
  }

  if (rbacEnabled && isAuthenticated && !canUseDirector) {
    return (
      <Box>
        <Alert severity="error">Kh├┤ng c├│ quyß╗ün Director Mode.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lß║íi danh s├ích giß║úi
        </Button>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error">Khong tim thay giai.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
        </Button>
      </Box>
    );
  }

  const waitingMatches = snapshot.matches?.waiting || [];
  const onCourtMatches = snapshot.matches?.onCourt || [];
  const completedMatches = snapshot.matches?.completed || [];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>
        Quay lai setup
      </Button>

      <Typography variant="h5" fontWeight="bold">
        Director ΓÇö {tournament.name}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        ─Éiß╗üu h├ánh s├ón, trß║¡n chß╗¥/─æang ─æ├ính/xong, BXH nhanh, bracket mini v├á trß╗ìng t├ái live
      </Typography>

      {!hasSupabaseConfig() && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chß║┐ ─æß╗Ö trß╗ìng t├ái cß║ºn Supabase Realtime. Cß║Ñu h├¼nh VITE_SUPABASE_URL trong Settings / .env v├á
          chß║íy script docs/supabase-match-live.sql.
        </Alert>
      )}
      {liveError && hasSupabaseConfig() && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Live score: {liveError}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!isDaily && savedEvents.length > 1 && (
        <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
          <Tabs
            value={activeEvent?.id || false}
            onChange={(_, value) => setActiveEventId(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {savedEvents.map((event) => (
              <Tab key={event.id} value={event.id} label={event.name} />
            ))}
          </Tabs>
        </Paper>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={`Cho: ${snapshot.summary.waiting}`} color="warning" />
        <Chip label={`Dang danh: ${snapshot.summary.onCourt}`} color="success" />
        <Chip label={`Xong: ${snapshot.summary.completed}`} />
        <Chip label={`San ban: ${snapshot.summary.courtsBusy}`} variant="outlined" />
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              San
            </Typography>
            <Stack spacing={1}>
              {snapshot.courtStates.map((court, index) => {
                const locked = court.locked || lockedCourtIds.includes(String(court.id));
                const courtRefereeName = resolveCourtRefereeName(
                  refereeSettings.courtReferees,
                  refereeSettings.roster,
                  court.id
                );
                const courtRefereeId = refereeSettings.courtReferees[String(court.id)] || "";

                return (
                  <Paper key={court.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography fontWeight="bold">
                            {getCourtDisplayName(
                              courts.find((item) => String(item.id) === String(court.id)),
                              index
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {court.status}
                            {court.currentMatchId ? ` ΓÇó ${court.currentMatchId}` : ""}
                            {courtRefereeName ? ` ΓÇó TT: ${courtRefereeName}` : ""}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={locked ? <LockOpenIcon /> : <LockIcon />}
                          onClick={() => handleToggleCourt(court.id, locked)}
                          disabled={Boolean(court.currentMatchId) && !locked}
                        >
                          {locked ? "Mß╗ƒ s├ón" : "Kh├│a s├ón"}
                        </Button>
                      </Stack>
                      {refereeSettings.roster.length > 0 && (
                        <FormControl fullWidth size="small">
                          <InputLabel>Trß╗ìng t├ái s├ón</InputLabel>
                          <Select
                            label="Trß╗ìng t├ái s├ón"
                            value={courtRefereeId}
                            onChange={(event) =>
                              handleCourtRefereeChange(court.id, event.target.value)
                            }
                          >
                            <MenuItem value="">
                              <em>Kh├┤ng g├ín cß╗æ ─æß╗ïnh</em>
                            </MenuItem>
                            {refereeSettings.roster.map((entry) => (
                              <MenuItem key={entry.id} value={entry.id}>
                                {entry.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MatchListPanel
                title="Tran cho"
                matches={waitingMatches}
                emptyText="Khong co tran cho."
                getCardProps={(match) =>
                  buildRefereeCardProps(match, {
                    actionLabel: "Xß║┐p s├ón",
                    onAction: handleAssignCourt,
                  })
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MatchListPanel
                title="Dang danh"
                matches={onCourtMatches}
                emptyText="Khong co tran tren san."
                chipColor="success"
                getCardProps={(match) =>
                  buildRefereeCardProps(match, {
                    actionLabel: "Nhß║¡p ─æiß╗âm",
                    onAction: handleOpenScore,
                    secondaryActionLabel: hasSupabaseConfig()
                      ? match.referee?.token
                        ? "Link trß╗ìng t├ái"
                        : "G├ín trß╗ìng t├ái"
                      : undefined,
                    onSecondaryAction: hasSupabaseConfig() ? handleOpenRefereeDialog : undefined,
                    tertiaryActionLabel: "Lß╗ïch sß╗¡ trß║¡n",
                    onTertiaryAction: handleOpenAuditHistory,
                  })
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MatchListPanel
                title="Da xong"
                matches={completedMatches.slice(0, 8)}
                emptyText="Chua co tran hoan tat."
                getCardProps={(match) =>
                  buildRefereeCardProps(match, {
                    tertiaryActionLabel: "Lß╗ïch sß╗¡ trß║¡n",
                    onTertiaryAction: handleOpenAuditHistory,
                  })
                }
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {!isDaily && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                BXH nhanh
              </Typography>
              <MiniStandings standings={snapshot.standings} />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Bracket mini
              </Typography>
              <BracketView
                progress={snapshot.bracketProgress}
                canReset={false}
              />
            </Paper>
          </Grid>
        </Grid>
      )}

      <RefereeAssignDialog
        open={Boolean(refereeDialogMatch)}
        match={refereeDialogMatch}
        matchLabels={
          refereeDialogMatch
            ? resolveMatchLabels(refereeDialogMatch, {
                entries: activeEvent?.entries || [],
                players,
                courts,
              })
            : null
        }
        existingReferee={refereeDialogMatch?.referee}
        roster={refereeSettings.roster}
        onClose={() => setRefereeDialogMatch(null)}
        onAssign={handleRefereeAssign}
      />

      <MatchAuditHistoryDialog
        open={Boolean(auditHistoryMatch)}
        match={auditHistoryMatch}
        liveRow={auditHistoryMatch ? liveByMatchId[String(auditHistoryMatch.id)] : null}
        onClose={() => setAuditHistoryMatch(null)}
      />

      <Dialog open={Boolean(scoreDialog)} onClose={() => setScoreDialog(null)} fullWidth>
        <DialogTitle>Nhß║¡p ─æiß╗âm</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {(scoreDialog?.entryALabel || scoreDialog?.teamALabel)} vs{" "}
            {(scoreDialog?.entryBLabel || scoreDialog?.teamBLabel)}
          </Typography>

          {scoreDialog?.referee?.name &&
            liveByMatchId[String(scoreDialog.id)] &&
            resolveDirectorScoreLogSource(
              scoreDialog,
              liveByMatchId[String(scoreDialog.id)]
            ) === "director_override" && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Trß║¡n c├│ trß╗ìng t├ái ({scoreDialog.referee.name}). L╞░u ─æiß╗âm ß╗ƒ ─æ├óy sß║╜ ─æ╞░ß╗úc ghi l├á{" "}
                <strong>BTC ghi ─æ├¿</strong>.
              </Alert>
            )}

          <Stack direction="row" spacing={2}>
            <TextField
              label="─Éiß╗âm A"
              type="number"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
              fullWidth
            />
            <TextField
              label="─Éiß╗âm B"
              type="number"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            label="Ghi ch├║ BTC (tuß╗│ chß╗ìn)"
            value={scoreNote}
            onChange={(event) => setScoreNote(event.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 2 }}
            placeholder="VD: Tranh chß║Ñp l╞░ß╗¢i, x├íc nhß║¡n lß║íi ─æiß╗âm"
          />

          <ScoreLogHistory
            match={scoreDialog}
            liveRow={scoreDialog ? liveByMatchId[String(scoreDialog.id)] : null}
            title="Lß╗ïch sß╗¡ thay ─æß╗òi ─æiß╗âm"
          />
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          {scoreDialog && liveByMatchId[String(scoreDialog.id)] && (
            <Button color="warning" onClick={() => handleDisputeResetLive(scoreDialog)}>
              Reset live TT
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setScoreDialog(null)}>Bß╗Å qua</Button>
          <Button variant="contained" onClick={handleSubmitScore}>
            L╞░u ─æiß╗âm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
