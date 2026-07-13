import { useEffect, useMemo, useState } from "react";

import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockIcon from "@mui/icons-material/Lock";
import SportsIcon from "@mui/icons-material/Sports";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { assertTournamentAccess } from "../../domain/tournamentService.js";
import { getTenantPlayers } from "../../features/club/index.js";
import { resolveTenantIdForClub } from "../../features/tenant/guards/tenantGuard.js";
import {
  buildRoundRobinMatchups,
  getTeamData,
  isTeamTournament,
  updateMatchupInTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import { canManageTeam } from "../../features/team-tournament/engines/teamPermissionEngine.js";
import { getStandingsTable } from "../../features/team-tournament/engines/teamStandingsEngine.js";
import { MISSING_LINEUP_POLICY } from "../../features/team-tournament/constants.js";
import { getLineup } from "../../features/team-tournament/models/index.js";
import { resolveLineupVersions } from "../../features/team-tournament/engines/atomicPublishWorkflowEngine.js";
import {
  buildOverrideCommandVersions,
} from "../../features/team-tournament/engines/overrideLineupWorkflowEngine.js";
import { buildForfeitCommandPayload } from "../../features/team-tournament/engines/forfeitWorkflowEngine.js";
import { normalizeMissingLineupPolicy } from "../../features/team-tournament/engines/missingLineupPolicyEngine.js";
import {
  organizerLockDreambreakerOrders,
  organizerSyncDreambreaker,
} from "../../features/team-tournament/services/teamTournamentService.js";
import { useTeamTournamentPage } from "../../features/team-tournament/ui/useTeamTournamentPage.js";
import RealtimeConnectionStatus from "../../features/team-tournament/ui/RealtimeConnectionStatus.jsx";
import { buildUiCommandScope } from "../../features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import TeamRosterPanel from "../../components/tournament/TeamRosterPanel.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import BuildScheduleDialog from "../../components/tournament/team/BuildScheduleDialog.jsx";
import TeamSchedulePreviewDialog from "../../components/tournament/team/TeamSchedulePreviewDialog.jsx";
import TeamDisciplinesPanel from "../../components/tournament/team/TeamDisciplinesPanel.jsx";
import TeamGroupDivisionPanel from "../../components/tournament/team/TeamGroupDivisionPanel.jsx";
import TeamMatchupOperationsCard from "../../components/tournament/team/TeamMatchupOperationsCard.jsx";
import TeamLineupOverrideDialog from "../../components/tournament/team/TeamLineupOverrideDialog.jsx";
import TeamForfeitDialog from "../../components/tournament/team/TeamForfeitDialog.jsx";
import TeamWithdrawTeamDialog from "../../components/tournament/team/TeamWithdrawTeamDialog.jsx";
import TeamStandingsTable from "../../components/tournament/team/TeamStandingsTable.jsx";
import TeamTournamentScheduleDiagram from "../../components/tournament/team/TeamTournamentScheduleDiagram.jsx";
import { countMatchupsWithSubResults } from "../../components/tournament/team/teamStandingsLabels.js";
import { countDreambreakerPendingMatchups } from "../../features/team-tournament/engines/matchupTieEngine.js";
import TeamTournamentWorkflowBar from "../../components/tournament/team/TeamTournamentWorkflowBar.jsx";
import {
  buildCaptainPortalUrl,
  buildRefereePortalUrl,
  copyTextToClipboard,
} from "../../components/tournament/team/copyPortalLink.js";
import { computeTeamTournamentWorkflow } from "../../components/tournament/team/teamTournamentWorkflow.js";
import { MATCHUP_STATUS } from "../../features/team-tournament/constants.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";
import { TEAM_TAB_QUERY } from "../../config/tournamentRoutes.js";
import TournamentVprPanel from "../../features/vpr-ranking/components/TournamentVprPanel.jsx";
import TournamentActionBar from "../../components/tournament/TournamentActionBar.jsx";

function buildVisibleTabs(canManage) {
  const tabs = [{ key: TEAM_TAB_QUERY.teams, label: "Đội" }];
  if (canManage) {
    tabs.push({ key: TEAM_TAB_QUERY.disciplines, label: "Nội dung" });
    tabs.push({ key: TEAM_TAB_QUERY.matchups, label: "Lịch đối đầu" });
  }
  tabs.push({ key: TEAM_TAB_QUERY.standings, label: "BXH" });
  tabs.push({ key: TEAM_TAB_QUERY.diagram, label: "Sơ đồ" });
  return tabs;
}

function useTeamTournamentAccess({ tournament, activeClubId, tournamentId }) {
  const { rbacEnabled, isAuthenticated, can, user } = useAuth();
  const { currentTenantId } = useTenant();

  return useMemo(() => {
    if (!rbacEnabled || !isAuthenticated) {
      return {
        allowed: true,
        canManage: true,
        canViewAll: true,
        viewerPlayerId: null,
      };
    }

    const tenantCheck = assertTournamentAccess(activeClubId, tournamentId, {
      tenantId: currentTenantId,
    });
    if (!tenantCheck.ok) {
      return { allowed: false, error: tenantCheck.error };
    }

    const rolePermissions = getPermissionsForRole(user?.role || "");
    const canManage =
      can(PERMISSIONS.TEAM_MANAGE, {
        clubId: activeClubId,
        venueId: currentTenantId,
        tenantId: currentTenantId,
      }) ||
      can(PERMISSIONS.TOURNAMENT_UPDATE, {
        clubId: activeClubId,
        venueId: currentTenantId,
        tenantId: currentTenantId,
      }) ||
      canManageTeam({ permissions: rolePermissions });

    const canViewAll =
      canManage ||
      can(PERMISSIONS.TEAM_VIEW, {
        clubId: activeClubId,
        venueId: currentTenantId,
        tenantId: currentTenantId,
      }) ||
      can(PERMISSIONS.TOURNAMENT_VIEW, {
        clubId: activeClubId,
        venueId: currentTenantId,
        tenantId: currentTenantId,
      });

    const teamData = getTeamData(tournament);
    const viewerPlayerId = user?.playerId ? String(user.playerId) : null;
    const isCaptain =
      viewerPlayerId &&
      (teamData?.teams || []).some(
        (team) =>
          team.captainPlayerId === viewerPlayerId ||
          (team.deputyPlayerIds || []).includes(viewerPlayerId)
      );

    const allowed = canManage || canViewAll || isCaptain;

    return {
      allowed,
      canManage,
      canViewAll: canViewAll && !canManage,
      isCaptain: Boolean(isCaptain),
      viewerPlayerId: canManage ? null : viewerPlayerId,
      error: allowed ? null : "Bạn không có quyền xem giải đồng đội này.",
    };
  }, [
    activeClubId,
    can,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    tournament,
    tournamentId,
    user,
  ]);
}

export default function TeamTournamentSetup() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClubId, clubs } = useClub();
  const { currentTenantId } = useTenant();

  const {
    loading,
    tournament,
    teamData,
    version,
    serverTime,
    error: loadError,
    reload,
    runMutation,
    patchTeamData,
    dataVersion,
    getLineupOverrideOps,
    connectionState,
    isRealtime,
    isDegraded,
    lastSnapshotAt,
    reconnectRealtime,
    subscriptionError,
    pollingFallbackActive,
  } = useTeamTournamentPage({
    clubId: activeClubId,
    tournamentId,
    pollingEnabled: true,
  });

  const access = useTeamTournamentAccess({ tournament, activeClubId, tournamentId });
  const visibleTabs = useMemo(
    () => buildVisibleTabs(access.canManage),
    [access.canManage]
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulePreviewOpen, setSchedulePreviewOpen] = useState(false);
  const [hubBanner, setHubBanner] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState(null);
  const [forfeitDialog, setForfeitDialog] = useState(null);
  const [withdrawDialog, setWithdrawDialog] = useState(null);
  const requestedTab = searchParams.get("tab") || TEAM_TAB_QUERY.teams;
  const activeTabKey = visibleTabs.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : TEAM_TAB_QUERY.teams;
  const activeTabIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.key === activeTabKey)
  );

  useEffect(() => {
    const qTab = searchParams.get("tab");
    if (qTab && !visibleTabs.some((tab) => tab.key === qTab)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", TEAM_TAB_QUERY.teams);
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams, visibleTabs]);

  const tenantId = useMemo(
    () => tournament?.tenantId || resolveTenantIdForClub(activeClubId) || currentTenantId || "",
    [tournament?.tenantId, activeClubId, currentTenantId]
  );
  const teamDataView = teamData || { teams: [], disciplines: [], matchups: [], standings: [] };
  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId]
  );
  const allTenantPlayers = useMemo(
    () => (tenantId ? getTenantPlayers(tenantId) : []),
    [tenantId, dataVersion]
  );
  const lineupPlayers = useMemo(() => {
    const pool = new Map();
    [...allTenantPlayers, ...players].forEach((player) => {
      pool.set(String(player.id), player);
    });
    return [...pool.values()];
  }, [allTenantPlayers, players]);
  const td = teamData || teamDataView;

  const standings = useMemo(() => getStandingsTable(td), [td]);
  const workflow = useMemo(() => computeTeamTournamentWorkflow(td), [td]);
  const allMatchupsPublished = useMemo(
    () =>
      td.matchups.length > 0 &&
      td.matchups.every((matchup) =>
        [
          MATCHUP_STATUS.PUBLISHED,
          MATCHUP_STATUS.IN_PROGRESS,
          MATCHUP_STATUS.COMPLETED,
        ].includes(matchup.status)
      ),
    [td.matchups]
  );
  const firstPublishedMatchupId = td.matchups.find((matchup) =>
    [MATCHUP_STATUS.PUBLISHED, MATCHUP_STATUS.IN_PROGRESS, MATCHUP_STATUS.COMPLETED].includes(
      matchup.status
    )
  )?.id;

  useEffect(() => {
    const isRandom = searchParams.get("random") === "1";
    const isDraft = searchParams.get("draft") === "1";
    if (isRandom) {
      setHubBanner(
        "Chế độ bốc thăm: khi khóa đội hình, hệ thống random VĐV cho đội chưa nộp."
      );
    } else if (isDraft) {
      setHubBanner(
        "Chế độ draft: đội trưởng chọn VĐV qua portal. Tạo lịch rồi gửi link cho từng đội."
      );
    } else {
      setHubBanner("");
    }
  }, [searchParams]);

  const handleTabChange = (_, index) => {
    const nextKey = visibleTabs[index]?.key;
    if (!nextKey) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextKey);
        return next;
      },
      { replace: true }
    );
  };

  function saveTeamData(nextTeamData) {
    const result = patchTeamData({ teamData: nextTeamData });
    if (!result.ok) {
      setError(result.error || "Không lưu được dữ liệu giải đồng đội.");
      return false;
    }
    reload({ silent: true });
    setMessage("Đã lưu.");
    setError("");
    return true;
  }

  function handleBuildScheduleConfirm(options) {
    if (!access.canManage) {
      return;
    }
    if (td.teams.length < 2) {
      setError("Cần ít nhất 2 đội.");
      return;
    }
    if (td.disciplines.length === 0) {
      setError("Cần ít nhất 1 nội dung thi đấu.");
      return;
    }

    const next = buildRoundRobinMatchups(
      searchParams.get("random") === "1" &&
        td.settings?.missingLineupPolicy !== MISSING_LINEUP_POLICY.RANDOM
        ? {
            ...td,
            settings: {
              ...td.settings,
              missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
            },
          }
        : td,
      options
    );
    if (saveTeamData(next)) {
      setScheduleDialogOpen(false);
      setMessage("Đã tạo lịch vòng tròn. Gửi link portal cho đội trưởng.");
    }
  }

  function handleUpdateMatchup(matchupId, patch) {
    const next = updateMatchupInTournament(td, matchupId, patch);
    saveTeamData(next);
  }

  async function handleLock(matchupId) {
    const matchup = td.matchups.find((item) => item.id === matchupId);
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "lockLineup",
      payload: { matchupId, players: lineupPlayers, now: new Date().toISOString() },
      actionScope: buildUiCommandScope("lock", tournamentId, matchupId),
      expectedVersion: matchup?.version ?? version,
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const detail = "Đã khóa đội hình.";
    if (result.mirrorWarning) {
      setMessage(`${detail} (Cảnh báo mirror blob: ${result.mirrorWarning})`);
    } else {
      setMessage(detail);
    }
  }

  async function handleRandomize(matchupId, teamId) {
    const team = td.teams.find((item) => item.id === teamId);
    const teamName = team?.name || teamId;
    if (
      !window.confirm(
        `Xác nhận random đội hình cho ${teamName}? Hệ thống sẽ chọn VĐV trên server — không thể hoàn tác từ client.`
      )
    ) {
      return;
    }

    const lineup = getLineup(td, matchupId, teamId);
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "randomizeLineup",
      payload: { matchupId, teamId },
      actionScope: buildUiCommandScope("randomize", tournamentId, `${matchupId}:${teamId}`),
      expectedVersion: lineup?.version ?? 1,
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error || "Không random được đội hình.");
      return;
    }
    setMessage(`Đã random đội hình cho ${teamName}.`);
  }

  async function handlePublish(matchupId) {
    const matchup = td.matchups.find((item) => item.id === matchupId);
    const { lineupAVersion, lineupBVersion } = resolveLineupVersions(td, matchup);

    if (
      !window.confirm(
        "Xác nhận công bố đội hình? Hệ thống sẽ publish đồng thời cả hai đội trong một lệnh server — không thể hoàn tác từ client."
      )
    ) {
      return;
    }

    if (lineupAVersion == null || lineupBVersion == null) {
      setError("Thiếu version đội hình — tải lại trang rồi thử lại.");
      return;
    }

    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "publishLineups",
      payload: { matchupId },
      actionScope: buildUiCommandScope("publish", tournamentId, matchupId),
      expectedVersion: matchup?.version ?? version,
      commandOptions: {
        expectedLineupAVersion: lineupAVersion,
        expectedLineupBVersion: lineupBVersion,
      },
    });
    setMutationBusy(false);
    if (!result.ok) {
      if (String(result.code || "").includes("version")) {
        setError(`${result.error || "Xung đột version."} — dữ liệu đã thay đổi, vui lòng tải lại.`);
      } else {
        setError(result.error);
      }
      return;
    }
    setMessage("Đã công bố đội hình. Trọng tài có thể nhập điểm.");
  }

  async function handleRequestOverride(matchupId, teamId) {
    setError("");
    setMutationBusy(true);
    const opsResult = await getLineupOverrideOps(matchupId, teamId);
    setMutationBusy(false);

    if (!opsResult.ok) {
      setError(opsResult.error || "Không kiểm tra được quyền override.");
      return;
    }

    const overrideOps = opsResult.data?.overrideOps;
    if (overrideOps?.canOverride !== true) {
      setError(overrideOps?.blockMessage || "Không thể thay đổi lineup cho đội này.");
      return;
    }

    const matchup = td.matchups.find((item) => item.id === matchupId);
    const team = td.teams.find((item) => item.id === teamId);
    const lineup = getLineup(td, matchupId, teamId);
    setOverrideDialog({
      matchup,
      team,
      lineup,
      overrideOps,
    });
  }

  async function handleOverrideConfirm({ reason, selections }) {
    if (!overrideDialog) {
      return;
    }
    const { matchup, team, lineup, overrideOps } = overrideDialog;
    const versions = buildOverrideCommandVersions({
      matchup: {
        ...matchup,
        version: overrideOps.matchupVersion ?? matchup.version,
      },
      lineup: {
        ...lineup,
        version: overrideOps.lineupVersion ?? lineup?.version,
      },
    });

    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "overrideLineup",
      payload: {
        matchupId: matchup.id,
        teamId: team.id,
        selections,
        reason,
      },
      actionScope: buildUiCommandScope("override", tournamentId, `${matchup.id}:${team.id}`),
      expectedVersion: versions.expectedMatchupVersion,
      commandOptions: {
        expectedMatchupVersion: versions.expectedMatchupVersion,
        expectedLineupVersion: versions.expectedLineupVersion,
      },
    });
    setMutationBusy(false);

    if (!result.ok) {
      if (result.isVersionConflict) {
        setError(`${result.error} — vui lòng tải lại trang.`);
      } else {
        setError(result.error || "Không override được lineup.");
      }
      return;
    }

    setOverrideDialog(null);
    setMessage(`Đã thay đổi lineup ${team.name || team.id}. Cần công bố lại trước khi đội trưởng/trọng tài thấy.`);
  }

  function handleRequestForfeit(matchupId) {
    const matchup = td.matchups.find((item) => item.id === matchupId);
    if (!matchup) {
      return;
    }
    setForfeitDialog({
      matchup,
      teamA: td.teams.find((team) => team.id === matchup.teamAId),
      teamB: td.teams.find((team) => team.id === matchup.teamBId),
      forfeitOps: null,
    });
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

    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "applyForfeit",
      payload,
      actionScope: buildUiCommandScope("forfeit", tournamentId, subMatchId),
      expectedVersion: subMatchVersion ?? version,
    });
    setMutationBusy(false);

    if (!result.ok) {
      setError(result.error || "Không ghi nhận được forfeit.");
      return;
    }

    setForfeitDialog(null);
    setMessage("Đã ghi nhận thua kỹ thuật. BXH đã được cập nhật.");
  }

  async function handleProvisionReferee(payload) {
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "provisionRefereeMatch",
      payload,
      actionScope: buildUiCommandScope("provision-ref", tournamentId, payload.subMatchId),
      expectedVersion: payload.expectedSubMatchVersion ?? version,
      commandOptions: { expectedSubMatchVersion: payload.expectedSubMatchVersion },
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error || result.code || "Không tạo được phiên trọng tài.");
      return;
    }
    setMessage("Đã tạo phiên Referee V5.");
  }

  async function handleResyncReferee(payload) {
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "resyncRefereeLink",
      payload,
      actionScope: buildUiCommandScope("resync-ref", tournamentId, payload.subMatchId),
      expectedVersion: version,
      commandOptions: { expectedLinkVersion: payload.expectedLinkVersion },
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error || result.code || "Không resync được liên kết.");
      return;
    }
    setMessage("Đã resync snapshot Referee V5.");
  }

  async function handleRevokeReferee(payload) {
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "revokeRefereeLink",
      payload,
      actionScope: buildUiCommandScope("revoke-ref", tournamentId, payload.subMatchId),
      expectedVersion: version,
      commandOptions: { expectedLinkVersion: payload.expectedLinkVersion },
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error || result.code || "Không revoke được liên kết.");
      return;
    }
    setMessage("Đã revoke liên kết Referee V5.");
  }

  function handleRequestWithdraw(teamId) {
    const team = td.teams.find((item) => item.id === teamId);
    if (!team || team.withdrawn) {
      setError("Đội không hợp lệ hoặc đã rút giải.");
      return;
    }
    setWithdrawDialog({ team });
  }

  async function handleWithdrawConfirm({ teamId, reason, reasonCode }) {
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "withdrawTeam",
      payload: { teamId, reason, reasonCode },
      actionScope: buildUiCommandScope("withdraw", tournamentId, teamId),
      expectedVersion: version,
    });
    setMutationBusy(false);

    if (!result.ok) {
      setError(result.error || "Không rút giải được.");
      return;
    }

    setWithdrawDialog(null);
    setMessage("Đã ghi nhận đội rút giải và cập nhật các trận còn lại.");
  }

  async function handleSyncDreambreaker() {
    setError("");
    const result = await organizerSyncDreambreaker(activeClubId, tournamentId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reload({ silent: true });
    setMessage(
      result.changed
        ? "Đã đồng bộ Dreambreaker — đội trưởng có thể nộp thứ tự."
        : "Dreambreaker đã đồng bộ (không có thay đổi)."
    );
  }

  async function handleLockDreambreaker(matchupId) {
    setError("");
    const result = await organizerLockDreambreakerOrders(activeClubId, tournamentId, {
      matchupId,
    });
    if (!result.ok) {
      setError(result.error || "Không khóa được thứ tự Dreambreaker.");
      return;
    }
    reload({ silent: true });
    const detail = (result.logs || []).join(" ") || "Đã khóa thứ tự Dreambreaker.";
    if (result.warning) {
      setError(result.warning);
    }
    setMessage(detail);
  }

  async function handleCopyCaptainLink() {
    const ok = await copyTextToClipboard(buildCaptainPortalUrl(tournamentId));
    if (ok) {
      setMessage("Đã sao chép link portal đội trưởng.");
    } else {
      setError("Không sao chép được link.");
    }
  }

  if (loading) {
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
          <Alert severity="warning">{access.error}</Alert>
          <Button component={RouterLink} to="/tournament" variant="contained">
            Về trang Giải đấu
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <TournamentSetupShell
      tournament={tournament}
      description="Giải đồng đội — quản lý đội, nội dung, lịch đối đầu và BXH"
      onBack={() => navigate("/tournament")}
      headerActions={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!access.canManage ? <Chip label="Chỉ xem" variant="outlined" size="small" /> : null}
          {access.canManage ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyCaptainLink}
            >
              Link đội trưởng
            </Button>
          ) : null}
          {access.isCaptain || access.canManage ? (
            <Button
              component={RouterLink}
              to={`/team-portal/${tournamentId}`}
              variant="outlined"
              size="small"
              startIcon={<SportsIcon />}
            >
              Portal đội trưởng
            </Button>
          ) : null}
          <Button
            component={RouterLink}
            to={`/team-referee/${tournamentId}`}
            variant="outlined"
            size="small"
            startIcon={<SportsIcon />}
          >
            Trọng tài
          </Button>
        </Stack>
      }
      alerts={
        <>
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
          {hubBanner ? <Alert severity="info" sx={{ mb: 2 }}>{hubBanner}</Alert> : null}
          {message ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage("")}>{message}</Alert> : null}
          {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert> : null}
        </>
      }
    >
      <Stack spacing={2}>
        <TeamTournamentWorkflowBar teamData={td} />

        {access.canManage ? (
          <TournamentVprPanel
            clubId={activeClubId}
            tournament={tournament}
            onUpdated={() => reload({ silent: true })}
          />
        ) : null}

        <Tabs value={activeTabIndex} onChange={handleTabChange}>
          {visibleTabs.map((tabItem) => (
            <Tab key={tabItem.key} label={tabItem.label} />
          ))}
        </Tabs>

        {activeTabKey === TEAM_TAB_QUERY.teams ? (
          <Stack spacing={2}>
            <TeamRosterPanel
              clubId={activeClubId}
              tournamentId={tournamentId}
              teamData={td}
              clubPlayers={players}
              allTenantPlayers={allTenantPlayers}
              clubs={clubs}
              canManage={access.canManage}
              canViewAll={access.canViewAll}
              viewerPlayerId={access.viewerPlayerId}
              onUpdated={() => reload({ silent: true })}
              onError={setError}
              onMessage={setMessage}
            />
            {access.canManage ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {td.teams
                  .filter((team) => !team.withdrawn)
                  .map((team) => (
                    <Button
                      key={`withdraw-${team.id}`}
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => handleRequestWithdraw(team.id)}
                      disabled={mutationBusy}
                    >
                      Rút giải — {team.name}
                    </Button>
                  ))}
              </Stack>
            ) : null}
            {access.canManage ? (
              <TeamGroupDivisionPanel
                teamData={td}
                clubPlayers={players}
                canManage={access.canManage}
                onSave={saveTeamData}
                onError={setError}
                onMessage={setMessage}
              />
            ) : null}
          </Stack>
        ) : null}

        {access.canManage && activeTabKey === TEAM_TAB_QUERY.disciplines ? (
          <TeamDisciplinesPanel
            teamData={td}
            canManage={access.canManage}
            onSave={saveTeamData}
            onError={setError}
          />
        ) : null}

        {access.canManage && activeTabKey === TEAM_TAB_QUERY.matchups ? (
          <Stack spacing={2}>
            {allMatchupsPublished ? (
              <Alert severity="success">
                Đã khóa và công bố đội hình. Mở portal trọng tài để nhập điểm từng trận con.
                {firstPublishedMatchupId ? (
                  <Button
                    component={RouterLink}
                    to={buildRefereePortalUrl(tournamentId, firstPublishedMatchupId)}
                    size="small"
                    variant="outlined"
                    startIcon={<SportsIcon />}
                    sx={{ mt: 1, display: "block", width: "fit-content" }}
                  >
                    Mở portal trọng tài
                  </Button>
                ) : null}
              </Alert>
            ) : (
              <Alert severity="info">
                Khi bấm &quot;Khóa đội hình&quot;, đội trưởng chưa nộp sẽ được hệ thống tự sắp xếp VĐV
                theo từng nội dung (giới tính, đôi/mixed). Sau đó bấm &quot;Công bố&quot; để trọng tài
                nhập điểm.
              </Alert>
            )}
            {td.groups?.length > 0 ? (
              <Alert severity="info">
                Đã chia {td.groups.length} bảng — lịch vòng tròn chỉ tạo trận trong từng bảng.
              </Alert>
            ) : null}
            {td.matchups.length === 0 ? (
              <Alert severity="info">
                Chưa có lượt đối đầu. Tạo lịch sau khi có ít nhất 2 đội và 1 nội dung.
              </Alert>
            ) : (
              td.matchups.map((matchup) => {
                const teamA = td.teams.find((team) => team.id === matchup.teamAId);
                const teamB = td.teams.find((team) => team.id === matchup.teamBId);
                return (
                  <TeamMatchupOperationsCard
                    key={matchup.id}
                    matchup={matchup}
                    teamData={td}
                    teamA={teamA}
                    teamB={teamB}
                    tournamentId={tournamentId}
                    canManage={access.canManage}
                    mutationBusy={mutationBusy}
                    serverTime={serverTime}
                    missingLineupPolicy={normalizeMissingLineupPolicy(
                      td.settings?.missingLineupPolicy
                    )}
                    onLock={handleLock}
                    onRandomize={handleRandomize}
                    onPublish={handlePublish}
                    onRequestOverride={access.canManage ? handleRequestOverride : undefined}
                    onRequestForfeit={access.canManage ? handleRequestForfeit : undefined}
                    onUpdateMatchup={handleUpdateMatchup}
                    onMessage={setMessage}
                    onError={setError}
                    onSyncDreambreaker={handleSyncDreambreaker}
                    onLockDreambreaker={handleLockDreambreaker}
                    onProvisionReferee={handleProvisionReferee}
                    onResyncReferee={handleResyncReferee}
                    onRevokeReferee={handleRevokeReferee}
                  />
                );
              })
            )}
            <TournamentActionBar>
              {(td.matchups.length > 0) ? (
                <Button variant="outlined" onClick={() => setSchedulePreviewOpen(true)}>
                  Xem sơ đồ trước
                </Button>
              ) : null}
              <Button
                variant={td.matchups.length > 0 ? "outlined" : "contained"}
                onClick={() => setScheduleDialogOpen(true)}
              >
                {td.matchups.length > 0 ? "Tạo lại lịch vòng tròn" : "Tạo lịch vòng tròn"}
              </Button>
            </TournamentActionBar>
            {workflow.hints[0] && !allMatchupsPublished ? (
              <Alert severity="info">{workflow.hints[0]}</Alert>
            ) : null}
          </Stack>
        ) : null}

        {activeTabKey === TEAM_TAB_QUERY.standings ? (
          <TeamStandingsTable
            standings={standings}
            tournamentName={tournament?.name || ""}
            formatPreset={td.settings?.formatPreset}
            tiebreakOrder={td.settings?.tiebreakOrder}
            matchupsDone={countMatchupsWithSubResults(td.matchups)}
            matchupsTotal={td.matchups.length}
            dreambreakerPending={countDreambreakerPendingMatchups(td)}
            scheduleLabel={td.groups?.length > 0 ? "Vòng tròn theo bảng" : "Vòng tròn"}
          />
        ) : null}

        {activeTabKey === TEAM_TAB_QUERY.diagram ? (
          <TeamTournamentScheduleDiagram
            teamData={td}
            tournamentName={tournament?.name || ""}
          />
        ) : null}
      </Stack>

      <BuildScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onConfirm={handleBuildScheduleConfirm}
        teamData={td}
        hasExistingResults={countMatchupsWithSubResults(td.matchups) > 0}
        onPreview={() => {
          setScheduleDialogOpen(false);
          setSchedulePreviewOpen(true);
        }}
      />

      <TeamSchedulePreviewDialog
        open={schedulePreviewOpen}
        onClose={() => setSchedulePreviewOpen(false)}
        teamData={td}
        tournamentName={tournament?.name || ""}
      />

      <TeamLineupOverrideDialog
        open={Boolean(overrideDialog)}
        onClose={() => setOverrideDialog(null)}
        team={overrideDialog?.team}
        teamData={td}
        matchup={overrideDialog?.matchup}
        lineup={overrideDialog?.lineup}
        players={lineupPlayers}
        overrideOps={overrideDialog?.overrideOps}
        busy={mutationBusy}
        onConfirm={handleOverrideConfirm}
      />

      <TeamForfeitDialog
        open={Boolean(forfeitDialog)}
        onClose={() => setForfeitDialog(null)}
        teamData={td}
        matchup={forfeitDialog?.matchup}
        teamA={forfeitDialog?.teamA}
        teamB={forfeitDialog?.teamB}
        forfeitOps={forfeitDialog?.forfeitOps}
        busy={mutationBusy}
        onConfirm={handleForfeitConfirm}
      />

      <TeamWithdrawTeamDialog
        open={Boolean(withdrawDialog)}
        onClose={() => setWithdrawDialog(null)}
        team={withdrawDialog?.team}
        busy={mutationBusy}
        onConfirm={handleWithdrawConfirm}
      />
    </TournamentSetupShell>
  );
}
