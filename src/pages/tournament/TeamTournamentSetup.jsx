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
import { assertTournamentAccess, getTournament } from "../../domain/tournamentService.js";
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
  organizerLockLineups,
  organizerPublishLineups,
  organizerSyncDreambreaker,
  patchTeamTournament,
} from "../../features/team-tournament/services/teamTournamentService.js";
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
  const { activeClubId, clubs, revision, refreshClubs } = useClub();
  const { currentTenantId } = useTenant();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulePreviewOpen, setSchedulePreviewOpen] = useState(false);
  const [hubBanner, setHubBanner] = useState("");

  const tournament = useMemo(() => {
    if (!activeClubId || !tournamentId) {
      return null;
    }
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const access = useTeamTournamentAccess({ tournament, activeClubId, tournamentId });
  const visibleTabs = useMemo(
    () => buildVisibleTabs(access.canManage),
    [access.canManage]
  );
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
  const teamData = useMemo(
    () => getTeamData(tournament) || { teams: [], disciplines: [], matchups: [], standings: [] },
    [tournament]
  );
  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId, revision]
  );
  const allTenantPlayers = useMemo(
    () => (tenantId ? getTenantPlayers(tenantId) : []),
    [tenantId, revision]
  );
  const lineupPlayers = useMemo(() => {
    const pool = new Map();
    [...allTenantPlayers, ...players].forEach((player) => {
      pool.set(String(player.id), player);
    });
    return [...pool.values()];
  }, [allTenantPlayers, players]);
  const standings = useMemo(() => getStandingsTable(teamData), [teamData]);
  const workflow = useMemo(() => computeTeamTournamentWorkflow(teamData), [teamData]);
  const allMatchupsPublished = useMemo(
    () =>
      teamData.matchups.length > 0 &&
      teamData.matchups.every((matchup) =>
        [
          MATCHUP_STATUS.PUBLISHED,
          MATCHUP_STATUS.IN_PROGRESS,
          MATCHUP_STATUS.COMPLETED,
        ].includes(matchup.status)
      ),
    [teamData.matchups]
  );
  const firstPublishedMatchupId = teamData.matchups.find((matchup) =>
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
    const result = patchTeamTournament(activeClubId, tournamentId, { teamData: nextTeamData });
    if (!result.ok) {
      setError(result.error || "Không lưu được dữ liệu giải đồng đội.");
      return false;
    }
    refreshClubs();
    setMessage("Đã lưu.");
    setError("");
    return true;
  }

  function handleBuildScheduleConfirm(options) {
    if (!access.canManage) {
      return;
    }
    if (teamData.teams.length < 2) {
      setError("Cần ít nhất 2 đội.");
      return;
    }
    if (teamData.disciplines.length === 0) {
      setError("Cần ít nhất 1 nội dung thi đấu.");
      return;
    }

    const next = buildRoundRobinMatchups(
      searchParams.get("random") === "1" &&
        teamData.settings?.missingLineupPolicy !== MISSING_LINEUP_POLICY.RANDOM
        ? {
            ...teamData,
            settings: {
              ...teamData.settings,
              missingLineupPolicy: MISSING_LINEUP_POLICY.RANDOM,
            },
          }
        : teamData,
      options
    );
    if (saveTeamData(next)) {
      setScheduleDialogOpen(false);
      setMessage("Đã tạo lịch vòng tròn. Gửi link portal cho đội trưởng.");
    }
  }

  function handleUpdateMatchup(matchupId, patch) {
    const next = updateMatchupInTournament(teamData, matchupId, patch);
    saveTeamData(next);
  }

  async function handleLock(matchupId) {
    setError("");
    const result = await organizerLockLineups(activeClubId, tournamentId, {
      matchupId,
      players: lineupPlayers,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refreshClubs();
    const detail = (result.logs || []).join(" ") || "Đã khóa đội hình.";
    if (result.warning) {
      setMessage(`${detail} (Đã lưu trên máy — chưa đồng bộ cloud: ${result.warning})`);
    } else {
      setMessage(detail);
    }
  }

  async function handlePublish(matchupId) {
    setError("");
    const result = await organizerPublishLineups(activeClubId, tournamentId, { matchupId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refreshClubs();
    if (result.warning) {
      setMessage(`Đã công bố đội hình trên máy. Chưa đồng bộ cloud: ${result.warning}`);
    } else {
      setMessage("Đã công bố đội hình. Trọng tài có thể nhập điểm.");
    }
  }

  async function handleSyncDreambreaker() {
    setError("");
    const result = await organizerSyncDreambreaker(activeClubId, tournamentId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refreshClubs();
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
    refreshClubs();
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
        <TeamTournamentWorkflowBar teamData={teamData} />

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
              teamData={teamData}
              clubPlayers={players}
              allTenantPlayers={allTenantPlayers}
              clubs={clubs}
              canManage={access.canManage}
              canViewAll={access.canViewAll}
              viewerPlayerId={access.viewerPlayerId}
              onUpdated={refreshClubs}
              onError={setError}
              onMessage={setMessage}
            />
            {access.canManage ? (
              <TeamGroupDivisionPanel
                teamData={teamData}
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
            teamData={teamData}
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
            {teamData.groups?.length > 0 ? (
              <Alert severity="info">
                Đã chia {teamData.groups.length} bảng — lịch vòng tròn chỉ tạo trận trong từng bảng.
              </Alert>
            ) : null}
            {teamData.matchups.length === 0 ? (
              <Alert severity="info">
                Chưa có lượt đối đầu. Tạo lịch sau khi có ít nhất 2 đội và 1 nội dung.
              </Alert>
            ) : (
              teamData.matchups.map((matchup) => {
                const teamA = teamData.teams.find((team) => team.id === matchup.teamAId);
                const teamB = teamData.teams.find((team) => team.id === matchup.teamBId);
                return (
                  <TeamMatchupOperationsCard
                    key={matchup.id}
                    matchup={matchup}
                    teamData={teamData}
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
              {(teamData.matchups.length > 0) ? (
                <Button variant="outlined" onClick={() => setSchedulePreviewOpen(true)}>
                  Xem sơ đồ trước
                </Button>
              ) : null}
              <Button
                variant={teamData.matchups.length > 0 ? "outlined" : "contained"}
                onClick={() => setScheduleDialogOpen(true)}
              >
                {teamData.matchups.length > 0 ? "Tạo lại lịch vòng tròn" : "Tạo lịch vòng tròn"}
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
            formatPreset={teamData.settings?.formatPreset}
            tiebreakOrder={teamData.settings?.tiebreakOrder}
            matchupsDone={countMatchupsWithSubResults(teamData.matchups)}
            matchupsTotal={teamData.matchups.length}
            dreambreakerPending={countDreambreakerPendingMatchups(teamData)}
            scheduleLabel={teamData.groups?.length > 0 ? "Vòng tròn theo bảng" : "Vòng tròn"}
          />
        ) : null}

        {activeTabKey === TEAM_TAB_QUERY.diagram ? (
          <TeamTournamentScheduleDiagram
            teamData={teamData}
            tournamentName={tournament?.name || ""}
          />
        ) : null}
      </Stack>

      <BuildScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onConfirm={handleBuildScheduleConfirm}
        teamData={teamData}
        hasExistingResults={countMatchupsWithSubResults(teamData.matchups) > 0}
        onPreview={() => {
          setScheduleDialogOpen(false);
          setSchedulePreviewOpen(true);
        }}
      />

      <TeamSchedulePreviewDialog
        open={schedulePreviewOpen}
        onClose={() => setSchedulePreviewOpen(false)}
        teamData={teamData}
        tournamentName={tournament?.name || ""}
      />
    </TournamentSetupShell>
  );
}
