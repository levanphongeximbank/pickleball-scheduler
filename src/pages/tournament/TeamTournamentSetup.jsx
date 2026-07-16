import { useEffect, useMemo, useState } from "react";

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
  InputLabel,
  MenuItem,
  Select,
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
import { assertTournamentAccess } from "../../domain/tournamentService.js";
import {
  useTeamTournamentAthletePool,
} from "../../features/team-tournament/ui/useTeamTournamentAthletePool.js";
import { TEAM_TOURNAMENT_ATHLETE_SCOPE } from "../../features/team-tournament/services/teamTournamentAthletePoolService.js";
import {
  buildRoundRobinMatchups,
  getTeamData,
  isTeamTournament,
  updateMatchupInTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../features/private-pairing-rules/index.js";
import { canManageTeam } from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getGroupStandingsTables,
  getStandingsTable,
} from "../../features/team-tournament/engines/teamStandingsEngine.js";
import TeamTiebreakConfigPanel from "../../components/tournament/team/TeamTiebreakConfigPanel.jsx";
import TeamAwardsClosePanel from "../../components/tournament/team/TeamAwardsClosePanel.jsx";
import TeamRefereeOpsReadinessPanel from "../../components/tournament/team/TeamRefereeOpsReadinessPanel.jsx";
import TeamRealtimeEnableGatesPanel from "../../components/tournament/team/TeamRealtimeEnableGatesPanel.jsx";
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
  generateTeamKnockoutBracket,
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
import { logTeamRosterHydrationTransition } from "../../features/team-tournament/engines/teamRosterHydrationDiagnostics.js";
import TournamentVprPanel from "../../features/vpr-ranking/components/TournamentVprPanel.jsx";
import TournamentActionBar from "../../components/tournament/TournamentActionBar.jsx";

function buildVisibleTabs(canManage) {
  const tabs = [{ key: TEAM_TAB_QUERY.teams, label: "Đội" }];
  if (canManage) {
    tabs.push({ key: TEAM_TAB_QUERY.disciplines, label: "Nội dung" });
    tabs.push({ key: TEAM_TAB_QUERY.matchups, label: "Lịch đối đầu" });
  }
  tabs.push({ key: TEAM_TAB_QUERY.standings, label: "BXH" });
  if (canManage) {
    tabs.push({ key: TEAM_TAB_QUERY.awards, label: "Trao giải" });
  }
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

  // Create flow stamps ?club= so detail survives activeClub refresh/coerce.
  // tournament.clubId (after load) + ?club= are SSOT — never prefer stale activeClubId.
  const clubFromQuery = String(searchParams.get("club") || "").trim();
  const loadClubId = clubFromQuery || activeClubId;

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
    persistSetupTeamData,
    rosterSetupRevision,
    getLineupOverrideOps,
    connectionState,
    isRealtime,
    isDegraded,
    lastSnapshotAt,
    reconnectRealtime,
    subscriptionError,
    pollingFallbackActive,
  } = useTeamTournamentPage({
    clubId: loadClubId,
    tournamentId,
    pollingEnabled: true,
  });

  const effectiveClubId = String(
    tournament?.clubId || loadClubId || activeClubId || ""
  ).trim();

  const access = useTeamTournamentAccess({
    tournament,
    activeClubId: effectiveClubId || activeClubId,
    tournamentId,
  });
  const visibleTabs = useMemo(
    () => buildVisibleTabs(access.canManage),
    [access.canManage]
  );

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulePreviewOpen, setSchedulePreviewOpen] = useState(false);
  const [knockoutDialogOpen, setKnockoutDialogOpen] = useState(false);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [knockoutBusy, setKnockoutBusy] = useState(false);
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

  const teamDataView = teamData || { teams: [], disciplines: [], matchups: [], standings: [] };

  const clubPool = useTeamTournamentAthletePool({
    tournament,
    clubFromQuery,
    activeClubId,
    clubs,
    currentTenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    callerName: "TeamTournamentSetup.club",
    revision: rosterSetupRevision,
  });
  const tenantPool = useTeamTournamentAthletePool({
    tournament,
    clubFromQuery,
    activeClubId,
    clubs,
    currentTenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT,
    callerName: "TeamTournamentSetup.tenant",
    revision: rosterSetupRevision,
    enabled: Boolean(clubPool.tenantId),
  });

  const players = clubPool.players;
  const allTenantPlayers = tenantPool.players;
  const playersLoadError = clubPool.error || tenantPool.error;
  const playersEmptyMessage = clubPool.emptyMessage || tenantPool.emptyMessage;
  const candidateDiagnostics = clubPool.diagnostics || tenantPool.diagnostics;
  const lineupPlayers = useMemo(() => {
    const pool = new Map();
    [...allTenantPlayers, ...players].forEach((player) => {
      pool.set(String(player.id), player);
    });
    return [...pool.values()];
  }, [allTenantPlayers, players]);
  const td = teamData || teamDataView;

  const standings = useMemo(() => getStandingsTable(td), [td]);
  const groupStandings = useMemo(() => getGroupStandingsTables(td), [td]);
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
    logTeamRosterHydrationTransition("TeamTournamentSetup.tabChange", {
      tournamentId,
      clubId: effectiveClubId || activeClubId,
      activeTab: nextKey,
      setupVersion: version,
      rosterSetupRevision,
      setupReady: Boolean(tournament && td),
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextKey);
        return next;
      },
      { replace: true }
    );
  };

  async function saveTeamData(nextTeamData, options = {}) {
    const result = persistSetupTeamData
      ? await persistSetupTeamData(nextTeamData, options)
      : patchTeamData({ teamData: nextTeamData });
    if (!result.ok) {
      setError(result.error || "Không lưu được dữ liệu giải đồng đội.");
      return false;
    }
    setMessage("Đã lưu.");
    setError("");
    return true;
  }

  async function handleBuildScheduleConfirm(options) {
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

    const prepared = await prepareLivePrivatePairingOptions({
      tournament: tournament || null,
      clubId: effectiveClubId || activeClubId || null,
      clubFromQuery,
      activeClubId,
      tournamentId: tournamentId || null,
      tenantId:
        tournament?.tenantId ||
        clubPool.tenantId ||
        tenantPool.tenantId ||
        currentTenantId ||
        null,
      eventId: tournamentId ? `event-${tournamentId}` : null,
      competitionClass: COMPETITION_CLASS.INTERNAL,
    });

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không tạo được lịch theo quy tắc riêng.");
      return;
    }

    const scheduleOptions = {
      ...options,
      ...prepared.pairingOptions,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      clubId: effectiveClubId || activeClubId || null,
      tournamentId: tournamentId || null,
    };

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
      scheduleOptions
    );

    if (next?.ok === false || next?.privatePairingError) {
      setError(
        next.privatePairingError?.message ||
          "Không tạo được lịch / trận đối đầu thỏa hard rules."
      );
      return;
    }

    if (
      await saveTeamData(next, {
        confirmDestructive: td.matchups.length > 0,
      })
    ) {
      setScheduleDialogOpen(false);
      setMessage("Đã tạo lịch vòng tròn. Gửi link portal cho đội trưởng.");
    }
  }

  function handleGenerateKnockout() {
    const clubIdForOps = effectiveClubId || activeClubId;
    if (!access.canManage || !clubIdForOps || !tournamentId) {
      return;
    }
    setKnockoutBusy(true);
    setError("");
    try {
      const result = generateTeamKnockoutBracket(clubIdForOps, tournamentId, {
        qualifiersPerGroup: Number(qualifiersPerGroup) || 2,
      });
      if (!result.ok) {
        setError(result.error || "Không tạo được nhánh knockout.");
        return;
      }
      setKnockoutDialogOpen(false);
      reload({ silent: true });
      const qualifiedCount = (result.qualified || []).length;
      setMessage(
        `Đã tạo nhánh knockout (${result.knockoutMatchCount || 0} trận) — ${qualifiedCount} đội vượt qua vòng bảng.`
      );
    } finally {
      setKnockoutBusy(false);
    }
  }

  async function handleUpdateMatchup(matchupId, patch) {
    const next = updateMatchupInTournament(td, matchupId, patch);
    await saveTeamData(next);
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
    const result = await organizerSyncDreambreaker(
      effectiveClubId || activeClubId,
      tournamentId
    );
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
    const result = await organizerLockDreambreakerOrders(
      effectiveClubId || activeClubId,
      tournamentId,
      {
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
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => reload()}>
              Thử lại
            </Button>
            <Button component={RouterLink} to="/tournament/create" variant="outlined">
              Tạo giải đồng đội mới
            </Button>
            <Button component={RouterLink} to="/tournament" variant="text">
              Về trang Giải đấu
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  if (!tournament || !isTeamTournament(tournament)) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error">
            {loadError ||
              `Không tìm thấy giải đồng đội này trên CLB/blob hiện tại. Preview thường lưu dữ liệu theo trình duyệt — ID cũ (\`${tournamentId}\`) có thể đã mất sau khi redeploy hoặc đổi CLB. Hãy tạo lại giải trên Preview hiện tại.`}
          </Alert>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => reload()}>
              Thử lại
            </Button>
            <Button component={RouterLink} to="/tournament/create" variant="outlined">
              Tạo giải đồng đội mới
            </Button>
            <Button component={RouterLink} to="/tournament" variant="text">
              Về trang Giải đấu
            </Button>
          </Stack>
        </Stack>
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
          {playersLoadError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {playersLoadError.message}
            </Alert>
          ) : null}
          {!playersLoadError && playersEmptyMessage ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {playersEmptyMessage}
            </Alert>
          ) : null}
          {candidateDiagnostics ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Candidate diagnostics: sourceCount={candidateDiagnostics.sourceCount},
              membershipCount={candidateDiagnostics.membershipCount},
              activeMembershipCount={candidateDiagnostics.activeMembershipCount},
              eligibleCount={candidateDiagnostics.eligibleCount},
              WRONG_SCOPE={candidateDiagnostics.wrongScopeCount},
              MEMBERSHIP_INACTIVE={candidateDiagnostics.membershipInactiveCount},
              MISSING_IDENTITY_LINK={candidateDiagnostics.missingIdentityCount}
            </Alert>
          ) : null}
          {message ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage("")}>{message}</Alert> : null}
          {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert> : null}
        </>
      }
    >
      <Stack spacing={2}>
        <TeamTournamentWorkflowBar teamData={td} />

        {access.canManage ? (
          <TournamentVprPanel
            clubId={effectiveClubId || activeClubId}
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
              clubId={effectiveClubId || activeClubId}
              tournamentId={tournamentId}
              tournament={tournament}
              teamData={td}
              clubPlayers={players}
              allTenantPlayers={allTenantPlayers}
              clubs={clubs}
              tenantId={
                tournament?.tenantId ||
                clubPool.tenantId ||
                tenantPool.tenantId ||
                currentTenantId
              }
              clubFromQuery={clubFromQuery}
              activeClubId={activeClubId}
              canManage={access.canManage}
              canViewAll={access.canViewAll}
              viewerPlayerId={access.viewerPlayerId}
              setupVersion={version ?? 0}
              athletePoolLoadingInitial={
                clubPool.loadingInitial ||
                (Boolean(clubPool.tenantId) && tenantPool.loadingInitial)
              }
              athletePoolRefreshing={
                clubPool.refreshing ||
                (Boolean(clubPool.tenantId) && tenantPool.refreshing)
              }
              athletePoolError={clubPool.error || tenantPool.error}
              setupReady={Boolean(tournament && td)}
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
                clubId={effectiveClubId || activeClubId}
                tournamentId={tournamentId}
                tournament={tournament}
                tenantId={
                  tournament?.tenantId ||
                  clubPool.tenantId ||
                  tenantPool.tenantId ||
                  currentTenantId
                }
                clubFromQuery={clubFromQuery}
                activeClubId={activeClubId}
                competitionClass={COMPETITION_CLASS.INTERNAL}
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
            <TeamRefereeOpsReadinessPanel
              teamData={td}
              canManage={access.canManage}
              environmentHint="staging"
            />
            <TeamRealtimeEnableGatesPanel canManage={access.canManage} />
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
              {(td.groups?.length > 0) ? (
                <Button
                  variant="outlined"
                  onClick={() => setKnockoutDialogOpen(true)}
                >
                  Tạo nhánh knockout
                </Button>
              ) : null}
            </TournamentActionBar>
            {workflow.hints[0] && !allMatchupsPublished ? (
              <Alert severity="info">{workflow.hints[0]}</Alert>
            ) : null}
          </Stack>
        ) : null}

        {activeTabKey === TEAM_TAB_QUERY.standings ? (
          <Stack spacing={2}>
            <TeamTiebreakConfigPanel
              clubId={effectiveClubId || activeClubId}
              tournamentId={tournamentId}
              teamData={td}
              canManage={access.canManage}
              onUpdated={() => reload({ silent: true })}
              onError={setError}
              onMessage={setMessage}
            />
            {(td.groups || []).length > 0
              ? groupStandings.map((group) => (
                  <TeamStandingsTable
                    key={group.groupId || "all"}
                    title={`BXH ${group.groupName}`}
                    compact
                    standings={group.standing}
                    tournamentName={tournament?.name || ""}
                    formatPreset={td.settings?.formatPreset}
                    tiebreakOrder={td.settings?.tiebreakOrder}
                    matchupsDone={countMatchupsWithSubResults(td.matchups)}
                    matchupsTotal={td.matchups.length}
                    dreambreakerPending={countDreambreakerPendingMatchups(td)}
                    scheduleLabel="Vòng bảng"
                  />
                ))
              : (
                  <TeamStandingsTable
                    standings={standings}
                    tournamentName={tournament?.name || ""}
                    formatPreset={td.settings?.formatPreset}
                    tiebreakOrder={td.settings?.tiebreakOrder}
                    matchupsDone={countMatchupsWithSubResults(td.matchups)}
                    matchupsTotal={td.matchups.length}
                    dreambreakerPending={countDreambreakerPendingMatchups(td)}
                    scheduleLabel="Vòng tròn"
                  />
                )}
          </Stack>
        ) : null}

        {access.canManage && activeTabKey === TEAM_TAB_QUERY.awards ? (
          <TeamAwardsClosePanel
            clubId={effectiveClubId || activeClubId}
            tournamentId={tournamentId}
            teamData={td}
            tournamentName={tournament?.name || ""}
            canManage={access.canManage}
            onUpdated={() => reload({ silent: true })}
            onError={setError}
            onMessage={setMessage}
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

      <Dialog
        open={knockoutDialogOpen}
        onClose={() => !knockoutBusy && setKnockoutDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Tạo nhánh knockout</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Chỉ áp dụng nhóm → knockout. Giữ nguyên lịch vòng tròn bảng.
            </Alert>
            <FormControl fullWidth size="small">
              <InputLabel id="s2d-qualifiers">Số đội vượt qua mỗi bảng</InputLabel>
              <Select
                labelId="s2d-qualifiers"
                label="Số đội vượt qua mỗi bảng"
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Number(e.target.value))}
              >
                <MenuItem value={1}>1 đội / bảng</MenuItem>
                <MenuItem value={2}>2 đội / bảng</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKnockoutDialogOpen(false)} disabled={knockoutBusy}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateKnockout}
            disabled={knockoutBusy}
          >
            Tạo knockout
          </Button>
        </DialogActions>
      </Dialog>

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
