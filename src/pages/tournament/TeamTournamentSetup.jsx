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
import {
  organizerLockDreambreakerOrders,
  organizerSyncDreambreaker,
} from "../../features/team-tournament/services/teamTournamentService.js";
import { useTeamTournamentPage } from "../../features/team-tournament/ui/useTeamTournamentPage.js";
import { buildUiCommandScope } from "../../features/team-tournament/ui/teamTournamentUiCommandKeys.js";
import TeamRosterPanel from "../../components/tournament/TeamRosterPanel.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import BuildScheduleDialog from "../../components/tournament/team/BuildScheduleDialog.jsx";
import TeamSchedulePreviewDialog from "../../components/tournament/team/TeamSchedulePreviewDialog.jsx";
import TeamDisciplinesPanel from "../../components/tournament/team/TeamDisciplinesPanel.jsx";
import TeamGroupDivisionPanel from "../../components/tournament/team/TeamGroupDivisionPanel.jsx";
import TeamMatchupOperationsCard from "../../components/tournament/team/TeamMatchupOperationsCard.jsx";
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
    error: loadError,
    versionConflict,
    reload,
    runMutation,
    patchTeamData,
    dataVersion,
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
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "lockLineup",
      payload: { matchupId, players: lineupPlayers, now: new Date().toISOString() },
      actionScope: buildUiCommandScope("lock", tournamentId, matchupId),
      expectedVersion: version,
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

  async function handlePublish(matchupId) {
    setError("");
    setMutationBusy(true);
    const result = await runMutation({
      method: "publishLineups",
      payload: { matchupId },
      actionScope: buildUiCommandScope("publish", tournamentId, matchupId),
      expectedVersion: version,
    });
    setMutationBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Đã công bố đội hình. Trọng tài có thể nhập điểm.");
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
                    onLock={handleLock}
                    onPublish={handlePublish}
                    onUpdateMatchup={handleUpdateMatchup}
                    onMessage={setMessage}
                    onError={setError}
                    onSyncDreambreaker={handleSyncDreambreaker}
                    onLockDreambreaker={handleLockDreambreaker}
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
    </TournamentSetupShell>
  );
}
