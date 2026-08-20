import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { loadAIData } from "../ai/storage";
import ActiveTournamentsPanel from "../components/tournament/ActiveTournamentsPanel.jsx";
import LeagueRoundsPanel from "../components/tournament/LeagueRoundsPanel.jsx";
import SeasonStandingsPanel from "../components/tournament/SeasonStandingsPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { loadRoundsForClub } from "../domain/clubStorage.js";
import { listLeagueRounds } from "../domain/leagueRoundService.js";
import { getLeagueStandingsBoard } from "../domain/seasonStandingsService.js";
import { useCanonicalTournamentList } from "../features/tournament/hooks/useCanonicalTournament.js";
import CourtOperationsPanel from "../components/courtManagement/CourtOperationsPanel.jsx";
import {
  DashboardAnalyticsView,
  resolveDashboardAccess,
} from "../features/dashboard-analytics/index.js";
import {
  buildDashboardSummary,
  hasExplicitDashboardClubId,
  loadClubOperationsDashboardSummary,
} from "./dashboard.logic";
import { loadCourtsFromStorage, loadPlayersFromStorage } from "./selectPlayers.data";

function StatCard({ label, value, hint }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Gate only — never call club-scoped storage here.
 * Club-scoped queries live in ClubOperationsContent after explicit clubId is known.
 */
function ClubOperationsSection() {
  const { activeClub, activeClubId, revision, clubReadReady } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();

  if (!hasExplicitDashboardClubId(activeClubId)) {
    const loading = clubReadReady === false;
    return (
      <Alert
        severity={loading ? "info" : "warning"}
        data-testid="dashboard-club-operations-gate"
        data-state={loading ? "loading" : "club-required"}
      >
        {loading
          ? "Đang tải ngữ cảnh CLB…"
          : "Chọn CLB trên thanh công cụ để xem vận hành CLB."}
      </Alert>
    );
  }

  return (
    <ClubOperationsContent
      clubId={String(activeClubId).trim()}
      activeClub={activeClub}
      revision={revision}
      activeSeason={activeSeason}
      activeLeague={activeLeague}
    />
  );
}

function ClubOperationsContent({ clubId, activeClub, revision, activeSeason, activeLeague }) {
  const summary = useMemo(() => {
    const loaded = loadClubOperationsDashboardSummary({
      clubId,
      seasonId: activeSeason?.id || null,
      leagueId: activeLeague?.id || null,
      loadAIData,
      loadPlayers: loadPlayersFromStorage,
      loadCourts: loadCourtsFromStorage,
      loadRounds: loadRoundsForClub,
    });
    if (!loaded.ok || !loaded.summary) {
      return buildDashboardSummary({});
    }
    return loaded.summary;
  }, [clubId, revision, activeSeason?.id, activeLeague?.id]);

  const { tournaments = [] } = useCanonicalTournamentList(activeClub, revision);

  const seasonStandings = useMemo(() => {
    if (!activeLeague?.id) {
      return [];
    }
    return getLeagueStandingsBoard(clubId, activeLeague.id);
  }, [clubId, activeLeague?.id, revision]);

  const leagueRounds = useMemo(() => {
    return listLeagueRounds(clubId, {
      seasonId: activeSeason?.id || null,
      leagueId: activeLeague?.id || null,
    });
  }, [clubId, activeSeason?.id, activeLeague?.id, revision]);

  return (
    <Box data-testid="dashboard-club-operations">
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
        Vận hành CLB
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        CLB {activeClub?.name || "hiện tại"}
        {activeSeason ? ` • ${activeSeason.name}` : ""}
        {activeLeague ? ` • ${activeLeague.name}` : ""}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Người chơi" value={summary.totals.players} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Sân hoạt động"
            value={`${summary.totals.activeCourts}/${summary.totals.courts}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Phiên xếp sân" value={summary.totals.sessions} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Điểm AI trung bình"
            value={summary.totals.avgAiScore}
            hint={`${summary.totals.completedResults} phiên có kết quả`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12 }}>
          <CourtOperationsPanel clubId={clubId} revision={revision} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12 }}>
          <ActiveTournamentsPanel tournaments={tournaments} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SeasonStandingsPanel
            rows={seasonStandings}
            leagueName={activeLeague?.name || ""}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <LeagueRoundsPanel rounds={leagueRounds} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
                Phiên gần đây
              </Typography>

              {summary.recentSessions.length === 0 ? (
                <Typography color="text.secondary">
                  Chưa có phiên xếp sân lưu trong lịch sử AI.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {summary.recentSessions.map((session) => (
                    <Box
                      key={session.id}
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        bgcolor: "grey.50",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                      >
                        <Box>
                          <Typography fontWeight="bold">
                            {new Date(session.date).toLocaleString("vi-VN")}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {session.roundName || "Phiên thường"}
                            {session.shiftLabel ? ` • ${session.shiftLabel}` : ""}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          <Chip size="small" label={`${session.courtCount} sân`} />
                          <Chip size="small" label={`Chờ: ${session.waitingCount}`} />
                          <Chip size="small" color="primary" label={`AI ${session.aiScore}`} />
                          <Chip
                            size="small"
                            color={session.resultStatus === "completed" ? "success" : "default"}
                            label={session.resultStatus === "completed" ? "Đã chốt" : "Chưa chốt"}
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
                Top người chơi (số trận)
              </Typography>

              {summary.topPlayers.length === 0 ? (
                <Typography color="text.secondary">Chưa có dữ liệu trận.</Typography>
              ) : (
                <Stack spacing={1}>
                  {summary.topPlayers.map((player, index) => (
                    <Box
                      key={player.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1,
                        borderRadius: 1,
                        bgcolor: index === 0 ? "success.50" : "transparent",
                      }}
                    >
                      <Typography fontWeight={index < 3 ? "bold" : "medium"}>
                        {index + 1}. {player.name}
                      </Typography>
                      <Chip size="small" label={`${player.games} trận`} />
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
                Đi tới nhanh
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button component={RouterLink} to="/tournament" variant="contained">
                  Tạo giải đấu
                </Button>
                <Button component={RouterLink} to="/club" variant="outlined">
                  CLB & Giải
                </Button>
                <Button component={RouterLink} to="/players" variant="outlined">
                  Người chơi
                </Button>
                <Button component={RouterLink} to="/court-management" variant="outlined">
                  Quản lý sân
                </Button>
                <Button component={RouterLink} to="/statistics" variant="outlined">
                  Thống kê
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                {summary.totals.rounds} vòng/ca giải đấu trong bộ lọc hiện tại.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const { activeClubId, activeClub } = useClub();

  const scopeVenueId =
    activeClub?.venueId || activeClub?.tenantId || user?.venueId || user?.tenantId || null;

  const scope = useMemo(
    () => ({
      clubId: activeClubId,
      venueId: scopeVenueId,
    }),
    [activeClubId, scopeVenueId]
  );

  const showClubOperations = useMemo(() => {
    const access = resolveDashboardAccess(user, can, scope);
    return access.sections?.clubOperations !== false;
  }, [user, can, scope]);

  return (
    <Box>
      <DashboardAnalyticsView />

      {showClubOperations && (
        <>
          <Divider sx={{ my: 4 }} />
          <ClubOperationsSection />
        </>
      )}
    </Box>
  );
}
