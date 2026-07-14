import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { assertTournamentPortalAccess } from "../../domain/tournamentService.js";
import { guardRecordTenant } from "../../features/tenant/guards/tenantGuard.js";
import { findTournamentClubId } from "../../features/club/services/clubTournamentBridge.js";
import { LINEUP_STATUS, MATCHUP_STATUS } from "../../features/team-tournament/constants.js";
import { CaptainDreambreakerPanel } from "../../components/tournament/team/DreambreakerPanel.jsx";
import { listDreambreakerMatchups } from "../../features/team-tournament/engines/dreambreakerEngine.js";
import { isMlpFormat } from "../../features/team-tournament/engines/mlpPresetEngine.js";
import CaptainPortalSummary from "../../components/tournament/team/CaptainPortalSummary.jsx";
import {
  formatTeamTournamentDateTime,
  getLineupStatusMeta,
} from "../../components/tournament/team/teamTournamentLabels.js";
import {
  canCaptainEditAfterOverride,
  resolveLineupDisplayStatus,
} from "../../features/team-tournament/engines/overrideLineupWorkflowEngine.js";
import {
  buildOfficialPairings,
  getVisibleLineup,
} from "../../features/team-tournament/engines/lineupEngine.js";
import {
  filterEligiblePlayersForDiscipline,
  validateLineupSelections,
} from "../../features/team-tournament/engines/lineupValidationEngine.js";
import {
  findTeamForCaptain,
  getOpponentTeamId,
  isTeamCaptain,
  listMatchupsForTeam,
  partitionMatchupsForPortal,
  resolveCaptainViewerPlayerId,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getTeamData,
  isTeamTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import TeamSubstitutionPanel from "../../components/tournament/TeamSubstitutionPanel.jsx";
import { findTeam, getLineup } from "../../features/team-tournament/models/index.js";
import { captainSubmitDreambreakerOrder } from "../../features/team-tournament/services/teamTournamentService.js";
import { useTeamTournamentPage } from "../../features/team-tournament/ui/useTeamTournamentPage.js";
import RealtimeConnectionStatus from "../../features/team-tournament/ui/RealtimeConnectionStatus.jsx";
import { useLineupDeadlineClock } from "../../features/team-tournament/ui/useLineupDeadlineClock.js";
import {
  DEADLINE_STATUS,
  matchupNeedsLineupAction,
  resolveMatchupLineupPermissions,
} from "../../features/team-tournament/services/lineupDeadlineService.js";
import { buildUiCommandScope } from "../../features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import { resolveEffectiveTenantId } from "../../features/tenant/services/tenantService.js";
import { fetchProfileByUserId } from "../../auth/profileService.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";


function canEditLineup(lineup) {
  if (!lineup) {
    return true;
  }
  if (!canCaptainEditAfterOverride(lineup)) {
    return false;
  }
  return (
    lineup.status === LINEUP_STATUS.NOT_SUBMITTED ||
    lineup.status === LINEUP_STATUS.DRAFT ||
    lineup.status === LINEUP_STATUS.SUBMITTED
  );
}

function useResolvedCaptainPlayerId(user) {
  const direct = resolveCaptainViewerPlayerId(user);
  const [profileState, setProfileState] = useState({ playerId: null, resolving: false });

  useEffect(() => {
    if (direct) {
      setProfileState({ playerId: null, resolving: false });
      return undefined;
    }

    const userId = String(user?.id || "").trim();
    if (!userId) {
      setProfileState({ playerId: null, resolving: false });
      return undefined;
    }

    let cancelled = false;
    setProfileState({ playerId: null, resolving: true });
    fetchProfileByUserId(userId).then((result) => {
      if (cancelled) {
        return;
      }
      const playerId = result.ok
        ? result.user?.playerId || result.profile?.player_id || null
        : null;
      setProfileState({
        playerId: playerId ? String(playerId).trim() : null,
        resolving: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [direct, user?.id, user?.playerId, user?.player_id]);

  if (direct) {
    return { playerId: direct, resolving: false };
  }

  return {
    playerId: profileState.playerId,
    resolving: profileState.resolving,
  };
}

function useCaptainPortalAccess({ tournament, teamData, effectiveClubId, tournamentId, viewerPlayerId }) {
  const { rbacEnabled, isAuthenticated, user } = useAuth();
  const { currentTenantId } = useTenant();

  return useMemo(() => {
    if (!tournament) {
      return { allowed: false, error: "Không tìm thấy giải đấu." };
    }

    const tenantForAccess =
      currentTenantId || resolveEffectiveTenantId(user) || tournament?.tenantId || null;

    if (rbacEnabled && isAuthenticated) {
      if (tenantForAccess && tournament?.tenantId) {
        const tenantCheck = guardRecordTenant(tournament, tenantForAccess, {
          user,
          rbacEnabled,
        });
        if (!tenantCheck.ok) {
          return { allowed: false, error: tenantCheck.error };
        }
      } else if (!tournament) {
        const tenantCheck = assertTournamentPortalAccess(effectiveClubId, tournamentId, {
          tenantId: tenantForAccess,
          user,
          rbacEnabled,
        });
        if (!tenantCheck.ok) {
          return { allowed: false, error: tenantCheck.error };
        }
      }
    }

    const resolvedTeamData = teamData || getTeamData(tournament);
    const captainTeam = viewerPlayerId
      ? findTeamForCaptain(resolvedTeamData, viewerPlayerId)
      : null;

    if (!captainTeam && rbacEnabled && isAuthenticated) {
      return {
        allowed: false,
        error: "Chỉ đội trưởng hoặc đội phó mới truy cập được trang này.",
      };
    }

    if (!captainTeam && (!rbacEnabled || !isAuthenticated)) {
      const fallbackTeam = teamData?.teams?.[0] || null;
      return {
        allowed: Boolean(fallbackTeam),
        captainTeam: fallbackTeam,
        viewerPlayerId: fallbackTeam?.captainPlayerId || null,
        error: fallbackTeam ? null : "Chưa có đội nào trong giải.",
      };
    }

    return {
      allowed: true,
      captainTeam,
      viewerPlayerId,
      error: null,
    };
  }, [
    effectiveClubId,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    teamData,
    tournament,
    tournamentId,
    user,
    viewerPlayerId,
  ]);
}

function buildInitialSelections(teamData, matchupId, teamId) {
  const lineup = getLineup(teamData, matchupId, teamId);
  const selections = {};

  for (const discipline of teamData.disciplines) {
    selections[discipline.id] = [...(lineup?.selections?.[discipline.id] || [])];
  }

  return selections;
}

function playerName(players, playerId) {
  const player = players.find((item) => String(item.id) === String(playerId));
  return player?.name || playerId;
}

function deadlineBlockedMessage(permissions) {
  if (permissions.deadlineStatus === DEADLINE_STATUS.LOCKED) {
    return "Đội hình đã khóa, không thể chỉnh sửa.";
  }
  if (
    permissions.deadlineStatus === DEADLINE_STATUS.AT ||
    permissions.deadlineStatus === DEADLINE_STATUS.PAST
  ) {
    return "Đã quá hạn nộp đội hình.";
  }
  return "Không thể chỉnh sửa đội hình.";
}

function MatchupLineupCard({
  matchup,
  team,
  teamData,
  players,
  tournamentId,
  dataVersion,
  tournamentVersion,
  runMutation,
  getVisibleLineups,
  useCloudVisibleLineups,
  isCloudPrimary,
  serverClock,
  onSaved,
}) {
  const opponentId = getOpponentTeamId(matchup, team.id);
  const opponent = findTeam(teamData, opponentId);
  const ownLineup = getLineup(teamData, matchup.id, team.id);
  const lineupStatus = ownLineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
  const statusMeta = getLineupStatusMeta(lineupStatus);
  const overrideDisplay = resolveLineupDisplayStatus(ownLineup, matchup);

  const permissions = useMemo(
    () =>
      resolveMatchupLineupPermissions({
        matchup,
        lineup: ownLineup,
        isCloudPrimary,
        serverClock,
      }),
    [matchup, ownLineup, isCloudPrimary, serverClock]
  );

  const { countdown: matchupCountdown } = useLineupDeadlineClock({
    serverTime: serverClock?.source ?? null,
    lineupDeadline: permissions.lineupDeadline,
    onDeadlineElapsed: onSaved,
  });

  const canSaveDraft = permissions.canSaveDraft === true;
  const canSubmitLineup = permissions.canSubmit === true;
  const editable = (canSaveDraft || canSubmitLineup) && canEditLineup(ownLineup);
  const isPublished = matchup.status === MATCHUP_STATUS.PUBLISHED;

  const [selections, setSelections] = useState(() =>
    buildInitialSelections(teamData, matchup.id, team.id)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cloudVisible, setCloudVisible] = useState(null);

  useEffect(() => {
    setSelections(buildInitialSelections(teamData, matchup.id, team.id));
  }, [teamData, matchup.id, team.id, ownLineup?.status, dataVersion]);

  useEffect(() => {
    if (!useCloudVisibleLineups || !getVisibleLineups) {
      setCloudVisible(null);
      return;
    }
    let cancelled = false;
    getVisibleLineups(matchup.id).then((result) => {
      if (!cancelled && result.ok) {
        setCloudVisible(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getVisibleLineups, matchup.id, useCloudVisibleLineups, dataVersion]);

  const allowReuse = teamData.settings?.allowPlayerReusePerMatchup === true;
  const visible =
    useCloudVisibleLineups && cloudVisible?.lineups
      ? {
          ok: true,
          ownLineup: cloudVisible.lineups.own ?? cloudVisible.lineups.ownLineup,
          opponentLineup:
            cloudVisible.lineups.opponent ?? cloudVisible.lineups.opponentLineup,
          submissionStatus: cloudVisible.lineups,
        }
      : getVisibleLineup(teamData, {
          matchupId: matchup.id,
          viewerTeamId: team.id,
          isOrganizer: false,
        });
  const pairings = isPublished
    ? buildOfficialPairings(teamData, matchup.id)
    : null;

  function getUsedPlayerIds(excludeDisciplineId = null) {
    const used = new Set();
    for (const [disciplineId, playerIds] of Object.entries(selections)) {
      if (disciplineId === excludeDisciplineId) {
        continue;
      }
      playerIds.forEach((playerId) => used.add(String(playerId)));
    }
    return used;
  }

  function handlePlayerChange(disciplineId, slotIndex, playerId, playerCount) {
    setSelections((current) => {
      const next = { ...current };
      const slots = Array.from({ length: playerCount }, (_, index) =>
        current[disciplineId]?.[index] || ""
      );
      slots[slotIndex] = playerId;
      next[disciplineId] = slots.filter(Boolean);
      return next;
    });
    setError("");
  }

  async function handleSaveDraft() {
    if (!canSaveDraft) {
      setError(deadlineBlockedMessage(permissions));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");

    const draftCheck = validateLineupSelections({
      teamData,
      teamId: team.id,
      selections,
      players,
      partial: true,
    });

    if (!draftCheck.ok) {
      setError(draftCheck.errors.join(" "));
      setBusy(false);
      return;
    }

    const result = await runMutation({
      method: "saveDraftLineup",
      payload: {
        matchupId: matchup.id,
        teamId: team.id,
        selections,
      },
      actionScope: buildUiCommandScope("save-draft", tournamentId, `${matchup.id}:${team.id}`),
      expectedVersion: tournamentVersion,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Không lưu được nháp.");
      return;
    }

    setMessage("Đã lưu nháp đội hình.");
    onSaved();
  }

  async function handleSubmit() {
    if (!canSubmitLineup) {
      setError(deadlineBlockedMessage(permissions));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");

    const validation = validateLineupSelections({
      teamData,
      teamId: team.id,
      selections,
      players,
    });

    if (!validation.ok) {
      setError(validation.errors.join(" "));
      setBusy(false);
      return;
    }

    const result = await runMutation({
      method: "submitLineup",
      payload: {
        matchupId: matchup.id,
        teamId: team.id,
        selections,
      },
      actionScope: buildUiCommandScope("submit", tournamentId, `${matchup.id}:${team.id}`),
      expectedVersion: tournamentVersion,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Không nộp được đội hình.");
      return;
    }

    setMessage(
      "Đã nộp đội hình. BTC sẽ khóa và công bố — bạn sẽ thấy cặp đấu chính thức sau khi công bố."
    );
    onSaved();
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              vs {opponent?.name || "Đối thủ"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Giờ thi đấu: {formatTeamTournamentDateTime(matchup.scheduledAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hạn nộp: {formatTeamTournamentDateTime(permissions.lineupDeadline || matchup.lineupLockAt)}
            </Typography>
            {matchupCountdown && permissions.deadlineStatus === DEADLINE_STATUS.BEFORE ? (
              <Typography variant="body2" color="info.main" fontWeight={600}>
                {matchupCountdown}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {permissions.deadlineStatus && permissions.deadlineStatus !== DEADLINE_STATUS.BEFORE ? (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={
                  permissions.deadlineStatus === DEADLINE_STATUS.LOCKED
                    ? "Đã khóa"
                    : "Hết hạn nộp"
                }
              />
            ) : null}
            <Chip label={statusMeta.label} color={statusMeta.color} />
            {overrideDisplay ? (
              <Chip
                label={overrideDisplay.label}
                color={overrideDisplay.color}
                variant="outlined"
              />
            ) : null}
          </Stack>
        </Stack>

        {overrideDisplay ? (
          <Alert severity="warning">
            BTC đã thay đổi đội hình của bạn
            {ownLineup?.overrideReason ? `: ${ownLineup.overrideReason}` : "."}
            {" "}
            Chờ công bố lại — bạn không thể tự sửa và chưa thấy đối thủ mới.
          </Alert>
        ) : null}

        {message ? <Alert severity="success">{message}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        {!editable ? (
          <Alert severity="info" icon={<LockIcon />}>
            {overrideDisplay
              ? "Đội hình đã bị BTC thay đổi — chờ công bố lại."
              : deadlineBlockedMessage(permissions)}
          </Alert>
        ) : null}

        {teamData.disciplines.map((discipline) => {
          const usedPlayerIds = getUsedPlayerIds(discipline.id);
          const eligible = filterEligiblePlayersForDiscipline({
            team,
            discipline,
            players,
            usedPlayerIds,
            allowReuse,
          });
          const selectedIds = Array.from({ length: discipline.playerCount }, (_, index) =>
            selections[discipline.id]?.[index] || ""
          );
          const slots = Array.from({ length: discipline.playerCount }, (_, index) => index);

          return (
            <Box key={discipline.id}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {discipline.name}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                {slots.map((slotIndex) => (
                  <FormControl
                    key={`${discipline.id}-${slotIndex}`}
                    size="small"
                    sx={{ minWidth: 180 }}
                    disabled={!editable || busy}
                  >
                    <InputLabel>{`VĐV ${slotIndex + 1}`}</InputLabel>
                    <Select
                      label={`VĐV ${slotIndex + 1}`}
                      value={selectedIds[slotIndex] || ""}
                      onChange={(event) =>
                        handlePlayerChange(
                          discipline.id,
                          slotIndex,
                          event.target.value,
                          discipline.playerCount
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>— Chọn —</em>
                      </MenuItem>
                      {eligible.map((player) => (
                        <MenuItem key={player.id} value={player.id}>
                          {player.name}
                        </MenuItem>
                      ))}
                      {selectedIds[slotIndex] &&
                      !eligible.some((player) => player.id === selectedIds[slotIndex]) ? (
                        <MenuItem value={selectedIds[slotIndex]}>
                          {playerName(players, selectedIds[slotIndex])}
                        </MenuItem>
                      ) : null}
                    </Select>
                  </FormControl>
                ))}
              </Stack>
            </Box>
          );
        })}

        {editable ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSaveDraft}
              disabled={busy || !canSaveDraft}
            >
              Lưu nháp
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={busy || !canSubmitLineup}
            >
              Xác nhận nộp
            </Button>
          </Stack>
        ) : null}

        {!isPublished && visible.ok && !visible.opponentLineup ? (
          <Alert severity="warning" icon={<VisibilityIcon />}>
            Đội hình đối phương sẽ hiển thị sau khi BTC công bố.
          </Alert>
        ) : null}

        {isPublished && pairings?.ok ? (
          <Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Cặp đấu chính thức
            </Typography>
            <Stack spacing={1}>
              {pairings.pairings.map((pairing) => {
                const isTeamA = team.id === matchup.teamAId;
                const ownPlayerIds = isTeamA ? pairing.teamAPlayerIds : pairing.teamBPlayerIds;
                const opponentPlayerIds = isTeamA
                  ? pairing.teamBPlayerIds
                  : pairing.teamAPlayerIds;

                return (
                  <Paper key={pairing.subMatchId} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {pairing.disciplineName}
                    </Typography>
                    <Typography variant="body2">
                      {team.name}:{" "}
                      {ownPlayerIds.map((id) => playerName(players, id)).join(" / ") || "—"}
                    </Typography>
                    <Typography variant="body2">
                      {opponent?.name}:{" "}
                      {opponentPlayerIds.map((id) => playerName(players, id)).join(" / ") || "—"}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function TeamPortal() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { activeClubId } = useClub();
  const { user } = useAuth();
  const captainIdentity = useResolvedCaptainPlayerId(user);
  const viewerPlayerId = captainIdentity.playerId;

  const resolvedClubId = useMemo(
    () => findTournamentClubId(tournamentId) || activeClubId,
    [tournamentId, activeClubId]
  );

  const {
    loading,
    tournament,
    teamData: hookTeamData,
    version,
    error: loadError,
    dataVersion,
    versionConflict,
    reload,
    runMutation,
    getVisibleLineups,
    isCloudPrimary,
    serverTime,
    lineupDeadline,
    deadlineStatus,
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

  const handleDeadlineElapsed = useCallback(() => {
    reload({ silent: true });
  }, [reload]);

  const { serverClock, countdown: primaryCountdown } = useLineupDeadlineClock({
    serverTime,
    lineupDeadline,
    onDeadlineElapsed: handleDeadlineElapsed,
  });

  const effectiveClubId = tournament?.clubId || resolvedClubId;

  const access = useCaptainPortalAccess({
    tournament,
    teamData: hookTeamData,
    effectiveClubId,
    tournamentId,
    viewerPlayerId,
  });

  const teamData = useMemo(() => {
    const raw = hookTeamData || {
      teams: [],
      disciplines: [],
      matchups: [],
      lineups: {},
    };
    return raw;
  }, [hookTeamData]);

  const players = useMemo(
    () => (effectiveClubId ? loadPlayersForClub(effectiveClubId) : []),
    [effectiveClubId, dataVersion]
  );

  const permissions = useMemo(
    () => getPermissionsForRole(user?.role || ""),
    [user?.role]
  );

  const [subMessage, setSubMessage] = useState(null);
  const [subError, setSubError] = useState(null);

  const matchups = useMemo(() => {
    if (!access.captainTeam) {
      return { upcoming: [], past: [], pending: [], done: [] };
    }

    const teamMatchups = listMatchupsForTeam(teamData, access.captainTeam.id);
    const partitioned = partitionMatchupsForPortal(teamMatchups);
    const teamId = access.captainTeam.id;

    const needsAction = (matchup) => {
      const lineup = getLineup(teamData, matchup.id, teamId);
      const status = lineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
      const permissions = resolveMatchupLineupPermissions({
        matchup,
        lineup,
        isCloudPrimary,
        serverClock,
      });
      return matchupNeedsLineupAction({ permissions, lineupStatus: status });
    };

    return {
      ...partitioned,
      pending: partitioned.upcoming.filter(needsAction),
      done: partitioned.upcoming.filter((matchup) => !needsAction(matchup)),
    };
  }, [access.captainTeam, isCloudPrimary, serverClock, teamData]);

  const dreambreakerMatchups = useMemo(() => {
    if (!access.captainTeam) {
      return [];
    }
    return listDreambreakerMatchups(teamData, { teamId: access.captainTeam.id });
  }, [access.captainTeam, teamData]);

  const [dbBusy, setDbBusy] = useState(false);
  const [dbMessage, setDbMessage] = useState(null);

  async function handleDreambreakerSubmit(matchupId, order) {
    setDbBusy(true);
    setDbMessage(null);
    const result = captainSubmitDreambreakerOrder(effectiveClubId, tournamentId, {
      matchupId,
      teamId: access.captainTeam.id,
      order,
    });
    setDbBusy(false);
    if (!result.ok) {
      setDbMessage({ type: "error", text: result.error });
      return;
    }
    await reload({ silent: true });
    setDbMessage({ type: "success", text: "Đã nộp thứ tự Dreambreaker." });
  }

  if (loading || (tournament && captainIdentity.resolving)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Đang tải giải đồng đội…</Alert>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error">{loadError}</Alert>
          <Button variant="contained" onClick={() => reload()}>
            Thử lại
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!tournament || !isTeamTournament(tournament)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Không tìm thấy giải đồng đội.</Alert>
      </Box>
    );
  }

  if (!access.allowed) {
    return (
      <Box sx={{ p: 3, maxWidth: 480 }}>
        <Stack spacing={2}>
          <LockIcon color="warning" fontSize="large" />
          <Typography variant="h6" fontWeight={700}>
            Không có quyền truy cập
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {access.error}
          </Typography>
          <Button component={RouterLink} to="/tournament" variant="contained">
            Về trang Giải đấu
          </Button>
        </Stack>
      </Box>
    );
  }

  const captainRoleLabel = isTeamCaptain(access.captainTeam, access.viewerPlayerId)
    ? access.captainTeam.captainPlayerId === access.viewerPlayerId
      ? "Đội trưởng"
      : "Đội phó"
    : "";

  const lineupCardProps = {
    tournamentId,
    dataVersion,
    tournamentVersion: version,
    runMutation,
    getVisibleLineups,
    useCloudVisibleLineups: isCloudPrimary,
    isCloudPrimary,
    serverClock,
    onSaved: handleDeadlineElapsed,
  };

  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <TournamentSetupShell
        tournament={tournament}
        description="Chọn VĐV cho từng nội dung (MLP: mỗi VĐV 2 trận/tie). Lưu nháp hoặc nộp trước giờ khóa."
        onBack={() => navigate("/tournament")}
        backLabel="Quay lại"
        headerActions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label="Portal đội trưởng" color="primary" size="small" />
            {access.captainTeam ? (
              <Chip label={access.captainTeam.name} variant="outlined" size="small" />
            ) : null}
            {captainRoleLabel ? <Chip label={captainRoleLabel} size="small" /> : null}
          </Stack>
        }
      >
      <Stack spacing={2}>
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
        {versionConflict ? (
          <Alert severity="warning">
            Dữ liệu đã được cập nhật từ thiết bị khác. Vui lòng kiểm tra lại trước khi gửi.
          </Alert>
        ) : null}

        <Stack direction="row" justifyContent="flex-end">
          <Button size="small" onClick={() => reload()} disabled={loading}>
            Tải lại
          </Button>
        </Stack>

        <CaptainPortalSummary
          teamData={teamData}
          teamId={access.captainTeam?.id}
          upcomingMatchups={matchups.upcoming}
          serverClock={serverClock}
          primaryCountdown={primaryCountdown}
          deadlineStatus={deadlineStatus}
          isCloudPrimary={isCloudPrimary}
        />

        {access.captainTeam ? (
          <>
            {subMessage ? (
              <Alert severity="success" onClose={() => setSubMessage(null)}>
                {subMessage}
              </Alert>
            ) : null}
            {subError ? (
              <Alert severity="error" onClose={() => setSubError(null)}>
                {subError}
              </Alert>
            ) : null}
            <TeamSubstitutionPanel
              clubId={effectiveClubId}
              tournamentId={tournamentId}
              team={access.captainTeam}
              teamData={teamData}
              players={players}
              permissions={permissions}
              mode="captain"
              dense
              onUpdated={() => reload()}
              onError={(text) => setSubError(text)}
              onMessage={(text) => {
                setSubError(null);
                setSubMessage(text);
              }}
            />
          </>
        ) : null}

        {dbMessage ? (
          <Alert severity={dbMessage.type} onClose={() => setDbMessage(null)}>
            {dbMessage.text}
          </Alert>
        ) : null}

        {dreambreakerMatchups.length > 0 ? (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Dreambreaker (2–2) — nộp thứ tự VĐV
            </Typography>
            {dreambreakerMatchups.map((matchup) => {
              const opponentId = getOpponentTeamId(matchup, access.captainTeam.id);
              const opponentName = findTeam(teamData, opponentId)?.name || "";
              return (
                <CaptainDreambreakerPanel
                  key={`db-${matchup.id}`}
                  matchup={matchup}
                  teamData={teamData}
                  teamId={access.captainTeam.id}
                  players={players}
                  opponentName={opponentName}
                  onSubmit={(order) => handleDreambreakerSubmit(matchup.id, order)}
                  busy={dbBusy}
                />
              );
            })}
          </Stack>
        ) : null}

        {isMlpFormat(teamData) ? (
          <Alert severity="info">
            MLP: mỗi VĐV tham gia 1 trận đồng giới + 1 trận mixed trong mỗi lượt đối đầu.
          </Alert>
        ) : null}

        {matchups.upcoming.length === 0 && matchups.past.length === 0 ? (
          <Alert severity="info">Chưa có lịch đối đầu cho đội của bạn.</Alert>
        ) : (
          <>
            {matchups.pending.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Cần nộp đội hình ({matchups.pending.length})
                </Typography>
                {matchups.pending.map((matchup) => (
                  <MatchupLineupCard
                    key={`pending-${matchup.id}-${getLineup(teamData, matchup.id, access.captainTeam.id)?.status || "none"}`}
                    matchup={matchup}
                    team={access.captainTeam}
                    teamData={teamData}
                    players={players}
                    {...lineupCardProps}
                  />
                ))}
              </Stack>
            ) : null}

            {matchups.done.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                  Đã nộp — chờ BTC ({matchups.done.length})
                </Typography>
                {matchups.done.map((matchup) => (
                  <MatchupLineupCard
                    key={`done-${matchup.id}-${getLineup(teamData, matchup.id, access.captainTeam.id)?.status || "none"}`}
                    matchup={matchup}
                    team={access.captainTeam}
                    teamData={teamData}
                    players={players}
                    {...lineupCardProps}
                  />
                ))}
              </Stack>
            ) : null}

            {matchups.pending.length === 0 && matchups.done.length === 0 && matchups.upcoming.length > 0 ? (
              <Alert severity="info">Không còn lượt đối đầu sắp tới cần thao tác.</Alert>
            ) : null}

            {matchups.past.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                  Đã qua ({matchups.past.length})
                </Typography>
                {matchups.past.map((matchup) => (
                  <MatchupLineupCard
                    key={`past-${matchup.id}-${getLineup(teamData, matchup.id, access.captainTeam.id)?.status || "none"}`}
                    matchup={matchup}
                    team={access.captainTeam}
                    teamData={teamData}
                    players={players}
                    {...lineupCardProps}
                  />
                ))}
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
      </TournamentSetupShell>
    </Box>
  );
}
