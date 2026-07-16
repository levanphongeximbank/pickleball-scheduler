import { useCallback, useEffect, useMemo, useState } from "react";
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
import { assertTournamentPortalAccess } from "../../domain/tournamentService.js";
import { findTournamentClubId } from "../../features/club/services/clubTournamentBridge.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";
import {
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../../features/team-tournament/services/teamTournamentAthletePoolService.js";
import { useTeamTournamentAthletePool } from "../../features/team-tournament/ui/useTeamTournamentAthletePool.js";
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
  canViewTeamMatchResults,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getStandingsTable,
} from "../../features/team-tournament/engines/teamStandingsEngine.js";
import {
  isTeamTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  refereeRecordDreambreakerPoint,
  refereeStartDreambreaker,
  refereeUndoDreambreakerPoint,
  refereeDreambreakerInjury,
  refereeLockDreambreakerOrders,
} from "../../features/team-tournament/services/teamTournamentService.js";
import { useTeamTournamentPage } from "../../features/team-tournament/ui/useTeamTournamentPage.js";
import RealtimeConnectionStatus from "../../features/team-tournament/ui/RealtimeConnectionStatus.jsx";
import { buildUiCommandScope } from "../../features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import { getRallyScoringHints } from "../../features/team-tournament/engines/rallyScoringEngine.js";
import { RefereeDreambreakerPanel } from "../../components/tournament/team/DreambreakerPanel.jsx";
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
  canSaveLegacyDraft,
} from "../../features/team-tournament/engines/teamRefereeV5BridgeEngine.js";
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
  subMatch,
  teamAName,
  teamBName,
  discipline,
  canEdit,
  onSaveDraft,
  onConfirm,
  onForfeit,
  busy,
}) {
  const isBestOf3 = subMatch.format === MATCH_FORMAT.BEST_OF_3;
  const [scoreA, setScoreA] = useState(subMatch.score?.teamA || 0);
  const [scoreB, setScoreB] = useState(subMatch.score?.teamB || 0);
  const [games, setGames] = useState(
    subMatch.score?.games?.length
      ? subMatch.score.games
      : [{ teamA: 0, teamB: 0 }]
  );
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const editable =
    canEdit &&
    subMatch.hasOfficialLineup &&
    canSaveLegacyDraft(subMatch.scoreOps);

  useEffect(() => {
    setScoreA(subMatch.score?.teamA || 0);
    setScoreB(subMatch.score?.teamB || 0);
    setGames(
      subMatch.score?.games?.length
        ? subMatch.score.games
        : [{ teamA: 0, teamB: 0 }]
    );
  }, [subMatch]);

  function updateGame(index, side, value) {
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
    setGames((current) => [...current, { teamA: 0, teamB: 0 }]);
    setActiveGameIndex(games.length);
  }

  const payload = isBestOf3
    ? { score: { teamA: 0, teamB: 0 }, games }
    : { score: { teamA: scoreA, teamB: scoreB }, games: [] };

  const rallyHints = discipline ? getRallyScoringHints(discipline) : "";

  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
      {rallyHints ? (
        <Chip size="small" label={rallyHints} sx={{ mb: 1.5 }} />
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
            onChange={setScoreA}
          />
          <ScoreStepper
            label={teamBName}
            value={scoreB}
            disabled={!editable || !subMatch.hasOfficialLineup}
            onChange={setScoreB}
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
            onClick={() => onSaveDraft(subMatch.subMatchId, payload)}
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
            onClick={() => onConfirm(subMatch.subMatchId, payload)}
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
              onClick={() => onForfeit(subMatch.subMatchId, payload)}
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
  onDreambreakerInjury,
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
          {matchup.subMatches.map((subMatch) => {
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
              onInjury={
                canManageDreambreaker && onDreambreakerInjury
                  ? (payload) => onDreambreakerInjury(rawMatchup.id, payload)
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
  const [searchParams] = useSearchParams();
  const { activeClubId, clubs = [] } = useClub();
  const { rbacEnabled, isAuthenticated, user } = useAuth();
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

  const {
    tournament,
    teamData,
    version,
    dataVersion,
    reload,
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

  const canView = useMemo(
    () => canViewTeamMatchResults({ permissions }),
    [permissions]
  );

  const reloadTournament = useCallback(() => {
    reload({ silent: true });
    return tournament;
  }, [reload, tournament]);

  useEffect(() => {
    reloadTournament();
  }, [reloadTournament]);

  const access = useMemo(() => {
    if (!tournament) {
      return { allowed: false, error: "Không tìm thấy giải đấu." };
    }

    if (!isTeamTournament(tournament)) {
      return { allowed: false, error: "Giải này không phải giải đồng đội." };
    }

    if (rbacEnabled && isAuthenticated) {
      const tenantCheck = assertTournamentPortalAccess(effectiveClubId, tournamentId, {
        tenantId: currentTenantId,
        user,
        rbacEnabled,
      });
      if (!tenantCheck.ok) {
        return { allowed: false, error: tenantCheck.error };
      }

      if (!canView && !canManage) {
        return {
          allowed: false,
          error: "Bạn không có quyền xem trang trọng tài giải đồng đội.",
        };
      }
    }

    return { allowed: true, error: null };
  }, [
    effectiveClubId,
    canManage,
    canView,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    tournament,
    tournamentId,
  ]);

  const athletePool = useTeamTournamentAthletePool({
    tournament,
    activeClubId: effectiveClubId,
    clubs,
    currentTenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    callerName: "TeamRefereePortal",
    revision: dataVersion,
    enabled: Boolean(effectiveClubId && tournament),
  });
  const players = athletePool.players;

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

  useEffect(() => {
    const matchupId = searchParams.get("matchup");
    if (!matchupId) {
      return;
    }
    const exists =
      scoredMatchups.some((item) => item.id === matchupId) ||
      waitingMatchups.some((item) => item.id === matchupId);
    if (exists) {
      setExpandedMatchupId(matchupId);
      if (scoredMatchups.some((item) => item.id === matchupId)) {
        setStatusFilter(REFEREE_FILTER.ALL);
      }
    }
  }, [searchParams, scoredMatchups, waitingMatchups]);

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

    const result = await saveSubMatchDraft(
      { matchupId, subMatchId, ...payload },
      { expectedVersion: version }
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await reload({ silent: true });
    setMessage("Đã lưu nháp tỷ số.");
  }

  async function handleConfirm(matchupId, subMatchId, payload) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await runMutation({
      method: "confirmSubMatchResult",
      payload: {
        matchupId,
        subMatchId,
        score: payload.score,
        winnerTeamId: payload.winnerTeamId,
      },
      actionScope: buildUiCommandScope("confirm", tournamentId, subMatchId),
      expectedVersion: version,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    let nextMessage = "Đã xác nhận kết quả trận con.";
    if (result.mirrorWarning) {
      nextMessage = `${nextMessage} (${result.mirrorWarning})`;
    }
    setMessage(nextMessage);
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
    const payload = buildForfeitCommandPayload({
      matchupId: forfeitDialog.matchup.id,
      subMatchId,
      forfeitingTeamId,
      resultType,
      reasonCode,
      reasonText,
      subMatchVersion,
    });

    setBusy(true);
    setError(null);
    const result = await runMutation({
      method: "applyForfeit",
      payload,
      actionScope: buildUiCommandScope("forfeit", tournamentId, subMatchId),
      expectedVersion: subMatchVersion ?? version,
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
    setBusy(true);
    const result = await refereeRecordDreambreakerPoint(effectiveClubId, tournamentId, {
      matchupId,
      scoringTeamId,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload({ silent: true });
    if (result.completed) {
      setMessage("Dreambreaker kết thúc.");
    }
  }

  async function handleDreambreakerStart(matchupId) {
    setBusy(true);
    const result = refereeStartDreambreaker(effectiveClubId, tournamentId, { matchupId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload({ silent: true });
  }

  async function handleDreambreakerLock(matchupId) {
    setBusy(true);
    setError(null);
    const result = refereeLockDreambreakerOrders(effectiveClubId, tournamentId, { matchupId });
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
    setBusy(true);
    const result = refereeUndoDreambreakerPoint(effectiveClubId, tournamentId, { matchupId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload({ silent: true });
  }

  async function handleDreambreakerInjury(matchupId, payload) {
    setBusy(true);
    const result = refereeDreambreakerInjury(effectiveClubId, tournamentId, {
      matchupId,
      ...payload,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload({ silent: true });
    setMessage("Đã ghi nhận chấn thương Dreambreaker.");
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
      {athletePool.error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {athletePool.error.message ||
            "Không tải được pool VĐV canonical. Tên VĐV thiếu identity sẽ được đánh dấu rõ."}
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
                onToggle={() => {
                  setExpandedMatchupId((current) =>
                    current === item.matchup.id ? "" : item.matchup.id
                  );
                  setSelectedSubMatchId("");
                }}
                selectedSubMatchId={selectedSubMatchId}
                onSelectSubMatch={setSelectedSubMatchId}
                permissions={permissions}
                onSaveDraft={(subMatchId, payload) =>
                  handleSaveDraft(item.matchup.id, subMatchId, payload)
                }
                onConfirm={(subMatchId, payload) =>
                  handleConfirm(item.matchup.id, subMatchId, payload)
                }
                onForfeit={
                  canManage
                    ? (subMatchId) => {
                        const subMatch = item.matchup.subMatches?.find((sm) => sm.id === subMatchId);
                        setForfeitDialog({
                          matchup: item.matchup,
                          subMatch,
                          teamA: { id: item.matchup.teamAId, name: item.matchup.teamAName },
                          teamB: { id: item.matchup.teamBId, name: item.matchup.teamBName },
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
                onDreambreakerInjury={handleDreambreakerInjury}
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
