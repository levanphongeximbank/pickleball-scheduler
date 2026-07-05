import { useMemo, useState } from "react";

import { Link as RouterLink, useParams } from "react-router-dom";

import {

  Alert,

  Box,

  Button,

  Chip,

  Paper,

  Stack,

  Tab,

  Tabs,

  TextField,

  Typography,

} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import LockIcon from "@mui/icons-material/Lock";

import SportsIcon from "@mui/icons-material/Sports";



import { useAuth } from "../../context/AuthContext.jsx";

import { useClub } from "../../context/ClubContext.jsx";

import { useTenant } from "../../context/TenantContext.jsx";

import { PERMISSIONS } from "../../auth/permissions.js";

import { loadPlayersForClub } from "../../domain/clubStorage.js";

import { assertTournamentAccess, getTournament } from "../../domain/tournamentService.js";

import {

  addDisciplineToTournament,

  buildRoundRobinMatchups,

  getTeamData,

  isTeamTournament,

} from "../../features/team-tournament/engines/teamTournamentEngine.js";

import { canManageTeam } from "../../features/team-tournament/engines/teamPermissionEngine.js";

import { submitLineup } from "../../features/team-tournament/engines/lineupEngine.js";

import { getStandingsTable } from "../../features/team-tournament/engines/teamStandingsEngine.js";

import {

  organizerLockLineups,

  organizerPublishLineups,

  patchTeamTournament,

} from "../../features/team-tournament/services/teamTournamentService.js";

import TeamRosterPanel from "../../components/tournament/TeamRosterPanel.jsx";

import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";



const TAB = {

  TEAMS: 0,

  DISCIPLINES: 1,

  MATCHUPS: 2,

  STANDINGS: 3,

};



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

    user?.playerId,

    user?.role,

  ]);

}



export default function TeamTournamentSetup() {

  const { tournamentId } = useParams();

  const { activeClubId, revision, refreshClubs } = useClub();

  const [tab, setTab] = useState(TAB.TEAMS);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [disciplineName, setDisciplineName] = useState("");



  const tournament = useMemo(() => {

    if (!activeClubId || !tournamentId) {

      return null;

    }

    return getTournament(activeClubId, tournamentId);

  }, [activeClubId, tournamentId, revision]);



  const access = useTeamTournamentAccess({ tournament, activeClubId, tournamentId });

  const teamData = useMemo(

    () => getTeamData(tournament) || { teams: [], disciplines: [], matchups: [], standings: [] },

    [tournament]

  );

  const players = useMemo(

    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),

    [activeClubId, revision]

  );

  const standings = useMemo(() => getStandingsTable(teamData), [teamData]);



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



  function handleAddDiscipline() {

    if (!access.canManage) {

      return;

    }

    const trimmed = disciplineName.trim();

    if (!trimmed) {

      setError("Nhập tên nội dung.");

      return;

    }

    const next = addDisciplineToTournament(teamData, { name: trimmed, playerCount: 2 });

    if (saveTeamData(next)) {

      setDisciplineName("");

    }

  }



  function handleBuildSchedule() {

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

    const next = buildRoundRobinMatchups(teamData, {

      lineupLockAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),

    });

    saveTeamData(next);

  }



  function handleCaptainDemoSubmit(matchupId, teamId) {

    const team = teamData.teams.find((item) => item.id === teamId);

    if (!team) {

      return;

    }

    const selections = {};

    teamData.disciplines.forEach((discipline) => {

      const pool = team.playerIds.filter((playerId) => {

        const player = players.find((item) => String(item.id) === String(playerId));

        if (!player) {

          return false;

        }

        if (discipline.genderRequirement === "male") {

          return String(player.gender).toLowerCase().includes("nam");

        }

        if (discipline.genderRequirement === "female") {

          return String(player.gender).toLowerCase().includes("n");

        }

        return true;

      });

      selections[discipline.id] = pool.slice(0, discipline.playerCount);

    });



    const result = submitLineup(teamData, {

      matchupId,

      teamId,

      selections,

      players,

    });



    if (!result.ok) {

      setError(result.error);

      return;

    }



    saveTeamData(result.teamData);

  }



  function handleLock(matchupId) {

    const result = organizerLockLineups(activeClubId, tournamentId, {

      matchupId,

      players,

      now: new Date().toISOString(),

    });

    if (!result.ok) {

      setError(result.error);

      return;

    }

    refreshClubs();

    setMessage((result.logs || []).join(" "));

  }



  function handlePublish(matchupId) {

    const result = organizerPublishLineups(activeClubId, tournamentId, { matchupId });

    if (!result.ok) {

      setError(result.error);

      return;

    }

    refreshClubs();

    setMessage("Đã công bố đội hình.");

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



  return (

    <Box sx={{ p: { xs: 2, md: 3 } }}>

      <Stack spacing={2}>

        <Button

          startIcon={<ArrowBackIcon />}

          component={RouterLink}

          to="/tournament"

          sx={{ alignSelf: "flex-start" }}

        >

          Quay lại

        </Button>



        <Typography variant="h5">{tournament.name}</Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">

          <Chip label="Giải đồng đội" color="primary" />

          {!access.canManage ? <Chip label="Chỉ xem" variant="outlined" /> : null}

          {access.isCaptain ? (
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



        {message ? <Alert severity="success">{message}</Alert> : null}

        {error ? <Alert severity="error">{error}</Alert> : null}



        <Tabs value={tab} onChange={(_, value) => setTab(value)}>

          <Tab label="Đội" />

          {access.canManage ? <Tab label="Nội dung" /> : null}

          {access.canManage ? <Tab label="Lịch đối đầu" /> : null}

          <Tab label="BXH" />

        </Tabs>



        {tab === TAB.TEAMS ? (

          <TeamRosterPanel

            clubId={activeClubId}

            tournamentId={tournamentId}

            teamData={teamData}

            clubPlayers={players}

            canManage={access.canManage}

            canViewAll={access.canViewAll}

            viewerPlayerId={access.viewerPlayerId}

            onUpdated={refreshClubs}

            onError={setError}

            onMessage={setMessage}

          />

        ) : null}



        {access.canManage && tab === TAB.DISCIPLINES ? (

          <Paper sx={{ p: 2 }}>

            <Stack spacing={2}>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>

                <TextField

                  label="Tên nội dung"

                  value={disciplineName}

                  onChange={(event) => setDisciplineName(event.target.value)}

                  fullWidth

                />

                <Button variant="contained" onClick={handleAddDiscipline}>

                  Thêm nội dung

                </Button>

              </Stack>

              {teamData.disciplines.map((discipline) => (

                <Typography key={discipline.id}>

                  {discipline.sortOrder}. {discipline.name} ({discipline.playerCount} VĐV)

                </Typography>

              ))}

            </Stack>

          </Paper>

        ) : null}



        {access.canManage && tab === TAB.MATCHUPS ? (

          <Paper sx={{ p: 2 }}>

            <Stack spacing={2}>

              <Button variant="outlined" onClick={handleBuildSchedule}>

                Tạo lịch vòng tròn

              </Button>

              {teamData.matchups.map((matchup) => {

                const teamA = teamData.teams.find((team) => team.id === matchup.teamAId);

                const teamB = teamData.teams.find((team) => team.id === matchup.teamBId);

                return (

                  <Box key={matchup.id} sx={{ border: "1px solid #eee", borderRadius: 1, p: 2 }}>

                    <Typography fontWeight={600}>

                      {teamA?.name || matchup.teamAId} vs {teamB?.name || matchup.teamBId}

                    </Typography>

                    <Typography variant="body2" color="text.secondary">

                      Trạng thái: {matchup.status}

                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>

                      <Button size="small" onClick={() => handleCaptainDemoSubmit(matchup.id, matchup.teamAId)}>

                        Nộp A (demo)

                      </Button>

                      <Button size="small" onClick={() => handleCaptainDemoSubmit(matchup.id, matchup.teamBId)}>

                        Nộp B (demo)

                      </Button>

                      <Button size="small" variant="outlined" onClick={() => handleLock(matchup.id)}>

                        Khóa

                      </Button>

                      <Button size="small" variant="contained" onClick={() => handlePublish(matchup.id)}>

                        Công bố

                      </Button>

                    </Stack>

                  </Box>

                );

              })}

            </Stack>

          </Paper>

        ) : null}



        {tab === TAB.STANDINGS ? (

          <Paper sx={{ p: 2 }}>

            {standings.length === 0 ? (

              <Typography color="text.secondary">Chưa có dữ liệu BXH.</Typography>

            ) : (

              standings.map((row) => (

                <Typography key={row.teamId}>

                  #{row.rank} {row.teamName} — {row.wins}W/{row.losses}L · HS trận con {row.subMatchDiff}

                </Typography>

              ))

            )}

          </Paper>

        ) : null}

      </Stack>

    </Box>

  );

}


