import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import SaveIcon from "@mui/icons-material/Save";
import SportsIcon from "@mui/icons-material/Sports";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { findTournamentClubId } from "../../features/club/services/clubTournamentBridge.js";
import { resolveTeamRefereeCloudPageAccess } from "../../features/team-tournament/ui/teamTournamentCloudAccess.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";
import { hydrateTeamRoster } from "../../features/team-tournament/engines/teamRosterHydration.js";
import {
  collectRefereeCompetitionAthletesFromTeamData,
  projectRefereeCompetitionAthletePlayers,
} from "../../features/team-tournament/engines/refereeCompetitionAthleteProjection.js";
import { getRefereeCompetitionAthleteDirectory } from "../../features/team-tournament/services/refereeCompetitionAthleteDirectoryService.js";
import {
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../../features/team-tournament/constants.js";
import {
  buildRefereeMatchupView,
  canEditSubMatchResult,
  listRefereeMatchupSummaries,
  MATCH_FORMAT,
} from "../../features/team-tournament/engines/teamRefereeEngine.js";
import { isRepublishPending } from "../../features/team-tournament/engines/overrideLineupWorkflowEngine.js";
import {
  canManageTeamMatchResult,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getStandingsTable,
} from "../../features/team-tournament/engines/teamStandingsEngine.js";
import {
  refereeRecordDreambreakerPoint,
  refereeStartDreambreaker,
  refereeUndoDreambreakerPoint,
  refereeLockDreambreakerOrders,
} from "../../features/team-tournament/services/teamTournamentService.js";
import { useTeamTournamentPage } from "../../features/team-tournament/ui/useTeamTournamentPage.js";
import RealtimeConnectionStatus from "../../features/team-tournament/ui/RealtimeConnectionStatus.jsx";
import { buildUiCommandScope } from "../../features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import {
  getStageScoringHints,
  resolveStageScoringMode,
} from "../../features/team-tournament/engines/rallyScoringEngine.js";
import { STAGE_SCORING_MODE } from "../../features/team-tournament/engines/teamStageScoringPolicy.js";
import { RefereeDreambreakerPanel } from "../../components/tournament/team/DreambreakerPanel.jsx";
import {
  buildRefereeDreambreakerPointCommand,
  buildRefereeDreambreakerStartCommand,
  buildRefereeDreambreakerUndoCommand,
} from "../../features/team-tournament/engines/dreambreakerEngine.js";
import { isDreambreakerSubMatch } from "../../features/team-tournament/engines/forfeitEngine.js";
import {
  computeMatchupTieProgress,
  countDreambreakerPendingMatchups,
} from "../../features/team-tournament/engines/matchupTieEngine.js";
import { findTeam } from "../../features/team-tournament/models/index.js";
import {
  formatTeamTournamentDateTime,
  getMatchupStatusMeta,
  getSubMatchStatusMeta,
} from "../../components/tournament/team/teamTournamentLabels.js";
import TeamStandingsTable from "../../components/tournament/team/TeamStandingsTable.jsx";
import TeamForfeitDialog from "../../components/tournament/team/TeamForfeitDialog.jsx";
import { buildForfeitCommandPayload } from "../../features/team-tournament/engines/forfeitWorkflowEngine.js";
import {
  resolveLegacyScorePanelEditable,
} from "../../features/team-tournament/engines/teamRefereeV5BridgeEngine.js";
import {
  availableMatchupIdsKey,
  bindScoreActionIds,
  buildMatchupQuerySearchParams,
  buildSubMatchScoreFingerprint,
  collectAvailableMatchupIds,
  freezeBaseVersionOnFirstEdit,
  normalizeScoreStateFromSubMatch,
  rebaseScorePanelAfterSuccessfulWrite,
  reconcileExpandedMatchupId,
  resolveInitialExpandedMatchupId,
  resolveScorePanelServerSync,
} from "../../features/team-tournament/engines/teamRefereePortalUiState.js";
import { resolveSubMatchRevision } from "../../features/team-tournament/engines/subMatchRevisionContract.js";
import { countMatchupsWithSubResults } from "../../components/tournament/team/teamStandingsLabels.js";

const REFEREE_FILTER = {
  ALL: "all",
  WAITING: "waiting",
  READY: "ready",
  DONE: "done",
};

const WAITING_MATCHUP_STATUSES = new Set([
  MATCHUP_STATUS.SCHEDULED,
  MATCHUP_STATUS.LINEUP_OPEN,
  MATCHUP_STATUS.LOCKED,
]);

function getRefereeBucket(status) {
  if (WAITING_MATCHUP_STATUSES.has(status)) {
    return REFEREE_FILTER.WAITING;
  }
  if (status === MATCHUP_STATUS.COMPLETED) {
    return REFEREE_FILTER.DONE;
  }
  return REFEREE_FILTER.READY;
}

function ScoreStepper({ label, value, disabled, onChange }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        flex: 1,
        textAlign: "center",
        borderRadius: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h3" fontWeight="bold" sx={{ my: 1, lineHeight: 1 }}>
        {value}
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="center">
        <IconButton
          color="primary"
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          sx={{ bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
        >
          <AddIcon />
        </IconButton>
        <IconButton
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <RemoveIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}

function SubMatchScorePanel({
  matchupId,
  subMatch,
  teamAName,
  teamBName,
  discipline,
  teamData = null,
  matchup = null,
  canEdit,
  onSaveDraft,
  onConfirm,
  onForfeit,
  busy,
}) {
  const isBestOf3 = subMatch.format === MATCH_FORMAT.BEST_OF_3;
  const initial = normalizeScoreStateFromSubMatch(subMatch);
  const [scoreA, setScoreA] = useState(initial.scoreA);
  const [scoreB, setScoreB] = useState(initial.scoreB);
  const [games, setGames] = useState(initial.games);
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [serverConflict, setServerConflict] = useState(false);
  const [baseSubMatchVersion, setBaseSubMatchVersion] = useState(() =>
    resolveSubMatchRevision(subMatch)
  );
  const fingerprintRef = useRef(buildSubMatchScoreFingerprint(subMatch));
  const editable = resolveLegacyScorePanelEditable({
    canEdit,
    hasOfficialLineup: subMatch.hasOfficialLineup,
    scoreOps: subMatch.scoreOps,
    subMatch,
  });

  useEffect(() => {
    const sync = resolveScorePanelServerSync({
      dirty,
      previousFingerprint: fingerprintRef.current,
      subMatch,
    });
    fingerprintRef.current = sync.nextFingerprint;
    if (sync.action === "rehydrate" && sync.nextState) {
      setScoreA(sync.nextState.scoreA);
      setScoreB(sync.nextState.scoreB);
      setGames(sync.nextState.games);
      setDirty(false);
      setServerConflict(false);
      setBaseSubMatchVersion(resolveSubMatchRevision(subMatch));
      return;
    }
    if (sync.action === "conflict") {
      setServerConflict(true);
    }
    // Dirty: keep local score + frozen baseSubMatchVersion (do not rebase).
  }, [subMatch, dirty]);

  function markDirty() {
    setBaseSubMatchVersion((prev) =>
      freezeBaseVersionOnFirstEdit({
        wasDirty: dirty,
        previousBaseVersion: prev,
        serverVersion: resolveSubMatchRevision(subMatch),
      })
    );
    setDirty(true);
    setServerConflict(false);
  }

  function updateGame(index, side, value) {
    markDirty();
    setGames((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index
          ? { ...game, [side]: Math.max(0, value) }
          : game
      )
    );
  }

  function addGame() {
    if (games.length >= 3) {
      return;
    }
    markDirty();
    setGames((current) => [...current, { teamA: 0, teamB: 0 }]);
    setActiveGameIndex(games.length);
  }

  function setScoreADirty(value) {
    markDirty();
    setScoreA(value);
  }

  function setScoreBDirty(value) {
    markDirty();
    setScoreB(value);
  }

  const payload = isBestOf3
    ? { score: { teamA: 0, teamB: 0 }, games }
    : { score: { teamA: scoreA, teamB: scoreB }, games: [] };

  const scoringHints = getStageScoringHints({ discipline, teamData, matchup });
  const isTraditionalScoring =
    resolveStageScoringMode({ discipline, teamData, matchup }) ===
    STAGE_SCORING_MODE.TRADITIONAL;

  async function runBoundWrite(action) {
    const binding = bindScoreActionIds({
      panelMatchupId: matchupId,
      panelSubMatchId: subMatch.subMatchId,
      requestedMatchupId: matchupId,
      requestedSubMatchId: subMatch.subMatchId,
    });
    if (!binding.ok) {
      return { ok: false, error: binding.error };
    }
    const expectedVersion = dirty
      ? baseSubMatchVersion
      : resolveSubMatchRevision(subMatch);
    const result = await action(binding.matchupId, binding.subMatchId, {
      ...payload,
      expectedVersion,
    });
    if (result?.ok) {
      const nextVersion =
        result.version != null && Number.isFinite(Number(result.version))
          ? Number(result.version)
          : Number(expectedVersion) + 1;
      const rebased = rebaseScorePanelAfterSuccessfulWrite({
        ...subMatch,
        score: payload.score?.games?.length
          ? { teamA: 0, teamB: 0, games: payload.games }
          : { teamA: payload.score?.teamA || 0, teamB: payload.score?.teamB || 0, games: [] },
        version: nextVersion,
      });
      setScoreA(rebased.scoreA);
      setScoreB(rebased.scoreB);
      setGames(rebased.games);
      fingerprintRef.current = rebased.fingerprint;
      setBaseSubMatchVersion(rebased.baseSubMatchVersion);
      setDirty(false);
      setServerConflict(false);
    }
    return result;
  }

  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
      {scoringHints ? (
        <Chip size="small" label={scoringHints} sx={{ mb: 1.5 }} />
      ) : null}
      {isTraditionalScoring ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1.5 }}
        >
          Chế độ Truyền thống: quyền giao bóng được enforce trên Referee V5 / CORE-16.
        </Typography>
      ) : null}
      {!subMatch.hasOfficialLineup && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Thiếu đội hình chính thức — không thể nhập tỷ số.
        </Alert>
      )}
      {subMatch.scoreOps?.blockCode ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {subMatch.scoreOps.blockMessage || "Trận con đang dùng Referee V5 — legacy score entry bị khóa."}
          {subMatch.scoreOps.refereeRoute ? (
            <Button
              size="small"
              sx={{ ml: 1 }}
              component={RouterLink}
              to={subMatch.scoreOps.refereeRoute}
            >
              Mở Referee V5
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {serverConflict ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Máy chủ đã cập nhật tỷ số trong khi bạn đang nhập. Giữ nguyên bản nhập hiện tại — lưu nháp
          hoặc tải lại trang nếu muốn dùng bản máy chủ.
        </Alert>
      ) : null}

      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && !canEdit && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Kết quả đã xác nhận. Chỉ BTC/admin mới được sửa.
        </Alert>
      )}

      {isBestOf3 ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {games.map((_, index) => (
              <Chip
                key={`game-tab-${index}`}
                label={`Game ${index + 1}`}
                color={activeGameIndex === index ? "primary" : "default"}
                onClick={() => setActiveGameIndex(index)}
                sx={{ minHeight: 36 }}
              />
            ))}
            {games.length < 3 && editable && (
              <Chip
                label="+ Game"
                variant="outlined"
                onClick={addGame}
                sx={{ minHeight: 36 }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <ScoreStepper
              label={teamAName}
              value={games[activeGameIndex]?.teamA || 0}
              disabled={!editable || !subMatch.hasOfficialLineup}
              onChange={(value) => updateGame(activeGameIndex, "teamA", value)}
            />
            <ScoreStepper
              label={teamBName}
              value={games[activeGameIndex]?.teamB || 0}
              disabled={!editable || !subMatch.hasOfficialLineup}
              onChange={(value) => updateGame(activeGameIndex, "teamB", value)}
            />
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.5}>
          <ScoreStepper
            label={teamAName}
            value={scoreA}
            disabled={!editable || !subMatch.hasOfficialLineup}
            onChange={setScoreADirty}
          />
          <ScoreStepper
            label={teamBName}
            value={scoreB}
            disabled={!editable || !subMatch.hasOfficialLineup}
            onChange={setScoreBDirty}
          />
        </Stack>
      )}

      {editable && subMatch.hasOfficialLineup && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SaveIcon />}
            disabled={busy}
            onClick={() => runBoundWrite(onSaveDraft)}
            sx={{ minHeight: 48 }}
          >
            Lưu nháp
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            disabled={busy}
            onClick={() => runBoundWrite(onConfirm)}
            sx={{ minHeight: 48 }}
          >
            Xác nhận KQ
          </Button>
          {onForfeit ? (
            <Button
              fullWidth
              variant="outlined"
              color="warning"
              disabled={busy}
              onClick={() =>
                onForfeit(matchupId, subMatch.subMatchId, payload)
              }
              sx={{ minHeight: 48 }}
            >
              Forfeit / Chấn thương
            </Button>
          ) : null}
        </Stack>
      )}

      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && subMatch.winnerTeamId && (
        <Typography variant="body2" color="success.main" sx={{ mt: 1.5, fontWeight: 600 }}>
          Thắng:{" "}
          {subMatch.winnerTeamId === subMatch.teamAId ? teamAName : teamBName}
        </Typography>
      )}
    </Box>
  );
}

function WaitingMatchupCard({ matchup }) {
  const statusMeta = getMatchupStatusMeta(matchup.status);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {matchup.teamAName} vs {matchup.teamBName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatTeamTournamentDateTime(matchup.scheduledAt)}
              {matchup.courtLabel ? ` · Sân ${matchup.courtLabel}` : ""}
            </Typography>
          </Box>
          <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
        </Stack>
        <Alert severity="info" sx={{ py: 0.5 }}>
          Chờ BTC công bố đội hình trước khi nhập điểm.
        </Alert>
      </Stack>
    </Paper>
  );
}

function MatchupCard({
  matchup,
  expanded,
  onToggle,
  selectedSubMatchId,
  onSelectSubMatch,
  permissions,
  onSaveDraft,
  onConfirm,
  onForfeit,
  busy,
  teamData,
  players = [],
  canManageDreambreaker = false,
  onDreambreakerStart,
  onDreambreakerLock,
  onDreambreakerPoint,
  onDreambreakerUndo,
}) {
  const statusChip = getMatchupStatusMeta(matchup.status);
  const rawMatchup = teamData?.matchups?.find((item) => item.id === matchup.id);
  const tieProgress = rawMatchup
    ? computeMatchupTieProgress(teamData, rawMatchup)
    : null;
  const showDreambreaker =
    Boolean(rawMatchup?.dreambreaker) || Boolean(tieProgress?.needsDreambreaker);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box
        sx={{
          p: 2,
          cursor: "pointer",
          "&:active": { bgcolor: "action.selected" },
        }}
        onClick={onToggle}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1, pr: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {matchup.teamAName} vs {matchup.teamBName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatTeamTournamentDateTime(matchup.scheduledAt)}
              {matchup.courtLabel ? ` · Sân ${matchup.courtLabel}` : ""}
            </Typography>
            {matchup.result && (
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
                Chung cuộc: {matchup.teamAName} {matchup.result.teamAWins}–
                {matchup.result.teamBWins} {matchup.teamBName}
              </Typography>
            )}
          </Box>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Chip size="small" label={statusChip.label} color={statusChip.color} />
            <IconButton size="small" aria-label={expanded ? "Thu gọn" : "Mở rộng"}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {matchup.subMatches
            .filter((subMatch) => !isDreambreakerSubMatch(teamData, subMatch, rawMatchup))
            .map((subMatch) => {
            const statusMeta = getSubMatchStatusMeta(subMatch.status);
            const isOpen = selectedSubMatchId === subMatch.subMatchId;

            return (
              <Box key={subMatch.subMatchId} sx={{ mb: 2 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: isOpen ? "primary.main" : "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ cursor: "pointer" }}
                    onClick={() => onSelectSubMatch(subMatch.subMatchId)}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {subMatch.disciplineName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {subMatch.teamAPlayerNames.join(" / ")} vs{" "}
                        {subMatch.teamBPlayerNames.join(" / ")}
                      </Typography>
                      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {subMatch.score?.teamA} – {subMatch.score?.teamB}
                          {subMatch.format === MATCH_FORMAT.BEST_OF_3 &&
                            subMatch.score?.games?.length > 0 &&
                            ` (${subMatch.score.games.map((g) => `${g.teamA}-${g.teamB}`).join(", ")})`}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
                  </Stack>

                  {isOpen && (
                    <SubMatchScorePanel
                      key={`${matchup.id}:${subMatch.subMatchId}`}
                      matchupId={matchup.id}
                      subMatch={{
                        ...subMatch,
                        teamAId: matchup.teamAId,
                        teamBId: matchup.teamBId,
                      }}
                      teamAName={matchup.teamAName}
                      teamBName={matchup.teamBName}
                      discipline={teamData?.disciplines?.find(
                        (item) => item.id === subMatch.disciplineId
                      )}
                      teamData={teamData}
                      matchup={rawMatchup || matchup}
                      canEdit={
                        canManageTeamMatchResult({ permissions }) &&
                        canEditSubMatchResult(
                          { status: subMatch.status },
                          { permissions }
                        )
                      }
                      onSaveDraft={onSaveDraft}
                      onConfirm={onConfirm}
                      onForfeit={onForfeit}
                      busy={busy}
                    />
                  )}
                </Paper>
              </Box>
            );
          })}
          {showDreambreaker && rawMatchup ? (
            <RefereeDreambreakerPanel
              matchup={rawMatchup}
              teamData={teamData}
              players={players}
              busy={busy}
              onPoint={
                canManageDreambreaker && onDreambreakerPoint
                  ? (scoringTeamId) => onDreambreakerPoint(rawMatchup.id, scoringTeamId)
                  : undefined
              }
              onUndo={
                canManageDreambreaker && onDreambreakerUndo
                  ? () => onDreambreakerUndo(rawMatchup.id)
                  : undefined
              }
              onStart={
                canManageDreambreaker && onDreambreakerStart
                  ? () => onDreambreakerStart(rawMatchup.id)
                  : undefined
              }
              onLock={
                canManageDreambreaker && onDreambreakerLock
                  ? () => onDreambreakerLock(rawMatchup.id)
                  : undefined
              }
            />
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function TeamRefereePortal() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClubId } = useClub();
  const { rbacEnabled, isAuthenticated, user, can } = useAuth();
  const { currentTenantId } = useTenant();

  const resolvedClubId = useMemo(
    () => findTournamentClubId(tournamentId) || activeClubId,
    [tournamentId, activeClubId]
  );

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedMatchupId, setExpandedMatchupId] = useState("");
  const [selectedSubMatchId, setSelectedSubMatchId] = useState("");
  const [statusFilter, setStatusFilter] = useState(REFEREE_FILTER.ALL);
  const [forfeitDialog, setForfeitDialog] = useState(null);
  const queryInitRef = useRef({ applied: false, queryId: null });

  const {
    loading,
    tournament,
    teamData,
    reload,
    error: loadError,
    runMutation,
    saveSubMatchDraft,
    connectionState,
    isRealtime,
    isDegraded,
    lastSnapshotAt,
    reconnectRealtime,
    subscriptionError,
    pollingFallbackActive,
  } = useTeamTournamentPage({
    clubId: resolvedClubId,
    tournamentId,
    pollingEnabled: true,
    pageMode: "refereePortal",
  });

  const effectiveClubId = tournament?.clubId || resolvedClubId;

  const permissions = useMemo(
    () => getPermissionsForRole(user?.role || ""),
    [user?.role]
  );

  const canManage = useMemo(
    () => canManageTeamMatchResult({ permissions }),
    [permissions]
  );

  const access = useMemo(
    () =>
      resolveTeamRefereeCloudPageAccess({
        loading,
        loadError,
        tournament,
        clubId: effectiveClubId,
        currentTenantId,
        user,
        rbacEnabled,
        isAuthenticated,
        can,
      }),
    [
      can,
      currentTenantId,
      effectiveClubId,
      isAuthenticated,
      loadError,
      loading,
      rbacEnabled,
      tournament,
      user,
    ]
  );

  // Competition-scoped athlete directory: keyed by tournament id, fetched once
  // per tournament (not per poll). Referee accounts must never enumerate club
  // members — a soft failure falls back to canonical rosterAthletes.
  const [competitionAthletes, setCompetitionAthletes] = useState([]);
  const [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  const directoryTournamentId = String(tournament?.id || tournamentId || "").trim();

  useEffect(() => {
    if (!directoryTournamentId) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const result = await getRefereeCompetitionAthleteDirectory({
        tournamentId: directoryTournamentId,
      });
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setDirectoryUnavailable(false);
        if (result.athletes.length > 0) {
          setCompetitionAthletes(result.athletes);
        }
        return;
      }
      // Soft error: keep last-good athletes and fall back to canonical roster.
      setDirectoryUnavailable(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [directoryTournamentId]);

  const players = useMemo(() => {
    const merged = new Map(
      collectRefereeCompetitionAthletesFromTeamData(teamData).map((row) => [
        row.athleteId,
        row,
      ])
    );
    for (const row of competitionAthletes) {
      merged.set(row.athleteId, row);
    }
    return projectRefereeCompetitionAthletePlayers([...merged.values()]);
  }, [competitionAthletes, teamData]);

  const hydratedTeams = useMemo(() => {
    if (!teamData?.teams) return [];
    return teamData.teams.map((team) =>
      hydrateTeamRoster({ team, athletePool: players })
    );
  }, [teamData, players]);

  const dreambreakerPendingCount = useMemo(
    () => (teamData ? countDreambreakerPendingMatchups(teamData) : 0),
    [teamData]
  );

  const scoredMatchups = useMemo(
    () => (teamData ? listRefereeMatchupSummaries(teamData, players) : []),
    [teamData, players]
  );

  const waitingMatchups = useMemo(() => {
    if (!teamData) {
      return [];
    }
    return (teamData.matchups || [])
      .filter((matchup) => WAITING_MATCHUP_STATUSES.has(matchup.status))
      .map((matchup) => ({
        id: matchup.id,
        status: matchup.status,
        scheduledAt: matchup.scheduledAt,
        courtLabel: matchup.courtLabel,
        teamAName: findTeam(teamData, matchup.teamAId)?.name || matchup.teamAId,
        teamBName: findTeam(teamData, matchup.teamBId)?.name || matchup.teamBId,
      }));
  }, [teamData]);

  const availableIds = useMemo(
    () => collectAvailableMatchupIds(scoredMatchups, waitingMatchups),
    [scoredMatchups, waitingMatchups]
  );
  const availableIdsStableKey = useMemo(
    () => availableMatchupIdsKey(availableIds),
    [availableIds]
  );

  const filteredItems = useMemo(() => {
    const scored = scoredMatchups.map((matchup) => ({
      type: "scored",
      bucket: getRefereeBucket(matchup.status),
      matchup,
    }));
    const waiting = waitingMatchups.map((matchup) => ({
      type: "waiting",
      bucket: REFEREE_FILTER.WAITING,
      matchup,
    }));
    const all = [...waiting, ...scored];

    if (statusFilter === REFEREE_FILTER.ALL) {
      return all;
    }
    return all.filter((item) => item.bucket === statusFilter);
  }, [scoredMatchups, waitingMatchups, statusFilter]);

  const queryMatchupId = searchParams.get("matchup");

  useEffect(() => {
    if (!availableIdsStableKey) {
      return;
    }
    const ids = availableIdsStableKey.split("|").filter(Boolean);
    const queryChanged = queryMatchupId !== queryInitRef.current.queryId;

    if (queryChanged) {
      queryInitRef.current = { applied: false, queryId: queryMatchupId };
    }

    if (!queryInitRef.current.applied) {
      const initial = resolveInitialExpandedMatchupId({
        queryMatchupId,
        availableIds: ids,
      });
      if (initial) {
        setExpandedMatchupId(initial);
        setStatusFilter(REFEREE_FILTER.ALL);
      }
      queryInitRef.current.applied = true;
      return;
    }

    setExpandedMatchupId((current) =>
      reconcileExpandedMatchupId({
        expandedMatchupId: current,
        availableIds: ids,
      })
    );
  }, [availableIdsStableKey, queryMatchupId]);

  const handleToggleMatchup = useCallback(
    (matchupId) => {
      const next = expandedMatchupId === matchupId ? "" : matchupId;
      setExpandedMatchupId(next);
      setSelectedSubMatchId("");
      queryInitRef.current = { applied: true, queryId: next || null };
      setSearchParams(buildMatchupQuerySearchParams(searchParams, next), {
        replace: true,
      });
    },
    [expandedMatchupId, searchParams, setSearchParams]
  );

  const standings = useMemo(
    () => (teamData ? getStandingsTable(teamData) : []),
    [teamData]
  );

  const activeMatchupView = useMemo(() => {
    if (!teamData || !expandedMatchupId) {
      return null;
    }
    return buildRefereeMatchupView(teamData, expandedMatchupId, players);
  }, [teamData, expandedMatchupId, players]);

  const activeMatchup = activeMatchupView?.ok ? activeMatchupView.matchup : null;
  const activeMatchupError =
    activeMatchupView && !activeMatchupView.ok ? activeMatchupView.error : null;

  async function handleSaveDraft(matchupId, subMatchId, payload) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const expectedVersion = Number(payload?.expectedVersion);
    if (!Number.isFinite(expectedVersion)) {
      setBusy(false);
      const fail = {
        ok: false,
        error: "Thiếu subMatch.version (expectedVersion) để lưu nháp.",
      };
      setError(fail.error);
      return fail;
    }

    const result = await saveSubMatchDraft(
      { matchupId, subMatchId, ...payload },
      { expectedVersion }
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    await reload({ silent: true });
    setMessage("Đã lưu nháp tỷ số.");
    return result;
  }

  async function handleConfirm(matchupId, subMatchId, payload) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const expectedVersion = Number(payload?.expectedVersion);
    if (!Number.isFinite(expectedVersion)) {
      setBusy(false);
      const fail = {
        ok: false,
        error: "Thiếu subMatch.version (expectedVersion) để xác nhận.",
      };
      setError(fail.error);
      return fail;
    }

    const result = await runMutation({
      method: "confirmSubMatchResult",
      payload: {
        matchupId,
        subMatchId,
        score: payload.score,
        winnerTeamId: payload.winnerTeamId,
      },
      actionScope: buildUiCommandScope("confirm", tournamentId, subMatchId),
      expectedVersion,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    let nextMessage = "Đã xác nhận kết quả trận con.";
    if (result.mirrorWarning) {
      nextMessage = `${nextMessage} (${result.mirrorWarning})`;
    }
    setMessage(nextMessage);
    return result;
  }

  async function handleForfeitConfirm({
    subMatchId,
    subMatchVersion,
    forfeitingTeamId,
    resultType,
    reasonCode,
    reasonText,
  }) {
    if (!forfeitDialog?.matchup) {
      return;
    }
    const expectedVersion = Number(
      subMatchVersion ?? resolveSubMatchRevision(forfeitDialog.subMatch)
    );
    if (!Number.isFinite(expectedVersion)) {
      setError("Thiếu subMatch.version (expectedVersion) để forfeit.");
      return;
    }
    const payload = buildForfeitCommandPayload({
      matchupId: forfeitDialog.matchup.id,
      subMatchId,
      forfeitingTeamId,
      resultType,
      reasonCode,
      reasonText,
      subMatchVersion: expectedVersion,
    });

    setBusy(true);
    setError(null);
    const result = await runMutation({
      method: "applyForfeit",
      payload,
      actionScope: buildUiCommandScope("forfeit", tournamentId, subMatchId),
      expectedVersion,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForfeitDialog(null);
    setMessage("Đã ghi nhận thua kỹ thuật.");
  }

  async function handleDreambreakerPoint(matchupId, scoringTeamId) {
    const matchup = (teamData?.matchups || []).find((item) => item.id === matchupId);
    const command = buildRefereeDreambreakerPointCommand(matchup, scoringTeamId);
    if (!command.ok) {
      setError(command.error);
      return;
    }
    setBusy(true);
    try {
      const result = await refereeRecordDreambreakerPoint(effectiveClubId, tournamentId, {
        matchupId: command.payload.matchupId,
        scoringTeamId: command.payload.scoringTeamId,
        expectedVersion: command.payload.expectedVersion,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload({ silent: true });
      if (result.completed) {
        setMessage("Dreambreaker kết thúc.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDreambreakerStart(matchupId) {
    const matchup = (teamData?.matchups || []).find((item) => item.id === matchupId);
    const command = buildRefereeDreambreakerStartCommand(matchup);
    if (!command.ok) {
      setError(command.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await refereeStartDreambreaker(effectiveClubId, tournamentId, {
        matchupId: command.payload.matchupId,
        expectedVersion: command.payload.expectedVersion,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleDreambreakerLock(matchupId) {
    setBusy(true);
    setError(null);
    const result = await refereeLockDreambreakerOrders(effectiveClubId, tournamentId, { matchupId });
    setBusy(false);
    if (result.tournament) {
      await reload({ silent: true });
    }
    const detail = (result.logs || []).join(" ") || "Đã khóa thứ tự Dreambreaker.";
    if (result.warning) {
      setError(result.warning);
    }
    setMessage(detail);
  }

  async function handleDreambreakerUndo(matchupId) {
    const matchup = (teamData?.matchups || []).find((item) => item.id === matchupId);
    const command = buildRefereeDreambreakerUndoCommand(matchup);
    if (!command.ok) {
      setError(command.error);
      return;
    }
    setBusy(true);
    try {
      const result = await refereeUndoDreambreakerPoint(effectiveClubId, tournamentId, {
        matchupId: command.payload.matchupId,
        expectedVersion: command.payload.expectedVersion,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  // First paint only — after hydrate, background reloads must never blank the
  // scored UI.
  if (access.pending || (loading && !tournament)) {
    return (
      <Box sx={{ p: 2, maxWidth: 640, mx: "auto" }}>
        <Alert severity="info">Đang tải trang trọng tài…</Alert>
      </Box>
    );
  }

  if (!access.allowed) {
    return (
      <Box sx={{ p: 2, maxWidth: 640, mx: "auto" }}>
        <Alert severity="error">{access.error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 640,
        mx: "auto",
        px: 1.5,
        py: 2,
        pb: 10,
        minHeight: "100dvh",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to={`/tournament/team/${tournamentId}`}
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Giải
        </Button>
        <SportsIcon color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Trọng tài
        </Typography>
        <Chip
          size="small"
          label={canManage ? "Nhập điểm" : "Chỉ xem"}
          color={canManage ? "primary" : "default"}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tournament?.name}
      </Typography>

      <RealtimeConnectionStatus
        variant="banner"
        connectionState={connectionState}
        isRealtime={isRealtime}
        isDegraded={isDegraded}
        pollingFallbackActive={pollingFallbackActive}
        lastSnapshotAt={lastSnapshotAt}
        subscriptionError={subscriptionError}
        onReconnect={reconnectRealtime}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {hydratedTeams.some((team) => team.unresolvedCount > 0) ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Một số VĐV chưa resolve được từ danh bạ VĐV của giải — tên hiển thị kèm
          diagnostic, không fallback blob.
          {directoryUnavailable
            ? " (Danh bạ VĐV theo giải chưa khả dụng — đang dùng roster canonical.)"
            : ""}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {[
          { key: REFEREE_FILTER.ALL, label: "Tất cả" },
          { key: REFEREE_FILTER.WAITING, label: "Chờ công bố" },
          { key: REFEREE_FILTER.READY, label: "Sẵn sàng" },
          { key: REFEREE_FILTER.DONE, label: "Hoàn tất" },
        ].map((filter) => (
          <Chip
            key={filter.key}
            label={filter.label}
            color={statusFilter === filter.key ? "primary" : "default"}
            variant={statusFilter === filter.key ? "filled" : "outlined"}
            onClick={() => setStatusFilter(filter.key)}
            sx={{ cursor: "pointer" }}
          />
        ))}
      </Stack>

      {dreambreakerPendingCount > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {dreambreakerPendingCount} tie hòa 2–2 chờ Dreambreaker — mở lượt đối đầu bên dưới để
          nộp thứ tự / bắt đầu trận quyết định.
        </Alert>
      ) : null}

      {filteredItems.length === 0 ? (
        <Alert severity="info">
          {statusFilter === REFEREE_FILTER.WAITING
            ? "Không có trận đang chờ công bố đội hình."
            : statusFilter === REFEREE_FILTER.READY
              ? "Chưa có trận sẵn sàng nhập điểm. BTC cần khóa và công bố đội hình trước."
              : "Chưa có lượt đối đầu phù hợp bộ lọc."}
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {filteredItems.map((item) =>
            item.type === "waiting" ? (
              <WaitingMatchupCard key={item.matchup.id} matchup={item.matchup} />
            ) : (
              <Stack key={item.matchup.id} spacing={1}>
                {expandedMatchupId === item.matchup.id && activeMatchupError ? (
                  <Alert severity="warning">{activeMatchupError}</Alert>
                ) : null}
                {expandedMatchupId === item.matchup.id &&
                isRepublishPending(item.matchup) &&
                !activeMatchupError ? (
                  <Alert severity="warning">
                    Lineup đã thay đổi — chờ BTC công bố lại trước khi dùng đội hình mới.
                  </Alert>
                ) : null}
                <MatchupCard
                key={item.matchup.id}
                matchup={
                  expandedMatchupId === item.matchup.id && activeMatchup
                    ? activeMatchup
                    : item.matchup
                }
                expanded={expandedMatchupId === item.matchup.id}
                onToggle={() => handleToggleMatchup(item.matchup.id)}
                selectedSubMatchId={selectedSubMatchId}
                onSelectSubMatch={setSelectedSubMatchId}
                permissions={permissions}
                onSaveDraft={handleSaveDraft}
                onConfirm={handleConfirm}
                onForfeit={
                  canManage
                    ? (panelMatchupId, subMatchId) => {
                        const sourceMatchup =
                          (teamData?.matchups || []).find((m) => m.id === panelMatchupId) ||
                          item.matchup;
                        const subMatch = sourceMatchup.subMatches?.find(
                          (sm) => sm.id === subMatchId || sm.subMatchId === subMatchId
                        );
                        const viewSub =
                          (expandedMatchupId === item.matchup.id && activeMatchup
                            ? activeMatchup.subMatches
                            : null
                          )?.find(
                            (sm) => sm.subMatchId === subMatchId || sm.id === subMatchId
                          ) || null;
                        setForfeitDialog({
                          matchup: {
                            ...sourceMatchup,
                            teamAName: item.matchup.teamAName,
                            teamBName: item.matchup.teamBName,
                          },
                          subMatch: {
                            ...(subMatch || {}),
                            ...(viewSub || {}),
                            version: resolveSubMatchRevision(viewSub || subMatch),
                          },
                          teamA: {
                            id: sourceMatchup.teamAId,
                            name: item.matchup.teamAName,
                          },
                          teamB: {
                            id: sourceMatchup.teamBId,
                            name: item.matchup.teamBName,
                          },
                          forfeitOps: subMatch?.forfeitOps || null,
                        });
                      }
                    : null
                }
                teamData={teamData}
                players={players}
                canManageDreambreaker={canManage}
                onDreambreakerStart={handleDreambreakerStart}
                onDreambreakerLock={handleDreambreakerLock}
                onDreambreakerPoint={handleDreambreakerPoint}
                onDreambreakerUndo={handleDreambreakerUndo}
                busy={busy}
              />
              </Stack>
            )
          )}
        </Stack>
      )}

      {teamData ? (
        <Box sx={{ mt: 3 }}>
          <TeamStandingsTable
            standings={standings}
            tournamentName={tournament?.name || ""}
            formatPreset={teamData.settings?.formatPreset}
            tiebreakOrder={teamData.settings?.tiebreakOrder}
            matchupsDone={countMatchupsWithSubResults(teamData.matchups)}
            matchupsTotal={teamData.matchups.length}
            dreambreakerPending={countDreambreakerPendingMatchups(teamData)}
            scheduleLabel={teamData.groups?.length > 0 ? "Vòng tròn theo bảng" : "Vòng tròn"}
          />
        </Box>
      ) : null}

      <TeamForfeitDialog
        open={Boolean(forfeitDialog)}
        onClose={() => setForfeitDialog(null)}
        teamData={teamData}
        matchup={forfeitDialog?.matchup}
        teamA={forfeitDialog?.teamA}
        teamB={forfeitDialog?.teamB}
        subMatch={forfeitDialog?.subMatch}
        forfeitOps={forfeitDialog?.forfeitOps}
        busy={busy}
        onConfirm={handleForfeitConfirm}
      />
    </Box>
  );
}
