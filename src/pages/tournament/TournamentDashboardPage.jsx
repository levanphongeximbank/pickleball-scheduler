import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import {
  individualPublicTournamentPath,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../config/tournamentRoutes.js";
import { useTeamTournamentDashboard } from "../../features/team-tournament/dashboard/useTeamTournamentDashboard.js";
import { PERMISSIONS } from "../../auth/permissions.js";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import { TournamentStatusChip } from "../../components/tournament/TournamentStatusChip.jsx";

function Section({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function MatchupList({ items }) {
  if (!items?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chưa có trận.
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {items.map((item) => {
        const teamA = String(item.teamAId || "").trim();
        const teamB = String(item.teamBId || "").trim();
        const unresolved = !teamA || !teamB;
        return (
          <Stack key={item.id} direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={item.status || "scheduled"} />
            <Typography variant="body2">
              {unresolved
                ? "Chung kết — chờ kết quả Bán kết"
                : `${teamA} vs ${teamB}`}
              {!unresolved && item.courtLabel ? ` · Sân ${item.courtLabel}` : ""}
              {!unresolved && item.result?.winnerTeamId
                ? ` · ${item.result.teamAWins}-${item.result.teamBWins}`
                : ""}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function TournamentDashboardPage() {
  const { tournamentId } = useParams();
  const { user, isAuthenticated, can } = useAuth();
  const { activeClubId } = useClub();
  // Visibility authority is team_tournament_get_dashboard only.
  // Do not derive sameTenant from activeClub.tenantId (PLAYER captains often null).
  const canOrganize = Boolean(
    can?.(PERMISSIONS.TOURNAMENT_UPDATE) || can?.(PERMISSIONS.TEAM_MANAGE)
  );
  const { loading, error, view } = useTeamTournamentDashboard({
    tournamentId,
    clubId: activeClubId,
    playerId: user?.playerId || user?.linkedPlayerId || null,
    userId: user?.id || null,
    canOrganize,
    isAuthenticated,
  });

  if (loading) {
    return <Alert severity="info">Đang tải bảng điều khiển giải...</Alert>;
  }
  if (view?.code === "NOT_TEAM_TOURNAMENT" && view.individualTournamentId) {
    return (
      <Navigate
        to={individualPublicTournamentPath(view.individualTournamentId)}
        replace
      />
    );
  }
  if (error || !view?.ok) {
    return (
      <Alert severity="error">
        {error || view?.error || "Không xem được bảng điều khiển giải."}
      </Alert>
    );
  }

  return (
    <Box>
      <TournamentPageHeader
        title={view.overview.name}
        description="Bảng điều khiển giải — xem giải, đội của tôi, nhiệm vụ đội trưởng và trọng tài khi bạn có quyền."
      />
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        <TournamentStatusChip status={view.overview.status} />
        {view.overview.formatPreset ? (
          <Chip size="small" label={view.overview.formatPreset} />
        ) : null}
      </Stack>

      <Stack spacing={2}>
        {view.sections.viewer ? (
          <Section title="Tổng quan">
            <Typography variant="body2" sx={{ mb: 1 }}>
              Luật hòa theo vòng (chỉ hiển thị, không phải authority):
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(view.stageTieBreakPolicy || {}).map(([stage, policy]) => (
                <Chip key={stage} size="small" label={`${stage}: ${policy}`} />
              ))}
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2">Đội tham dự</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {(view.teams || []).map((team) => (
                <Chip key={team.id} label={team.name} />
              ))}
            </Stack>
          </Section>
        ) : null}

        <Section title="Lịch / đang đấu / đã xong">
          {(view.schedule?.bracketPending || []).length > 0 ? (
            <>
              <Typography variant="subtitle2">Nhánh chờ kết quả</Typography>
              <MatchupList items={view.schedule?.bracketPending} />
            </>
          ) : null}
          <Typography variant="subtitle2">Sắp diễn ra</Typography>
          <MatchupList items={view.schedule?.upcoming} />
          <Typography variant="subtitle2" sx={{ mt: 1.5 }}>
            Đang đấu
          </Typography>
          <MatchupList items={view.schedule?.live} />
          <Typography variant="subtitle2" sx={{ mt: 1.5 }}>
            Kết quả
          </Typography>
          <MatchupList items={view.results} />
        </Section>

        <Section title="Bảng xếp hạng">
          {(view.standings || []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Chưa có BXH.
            </Typography>
          ) : (
            (view.standings || []).map((row) => (
              <Typography key={row.teamId} variant="body2">
                #{row.rank ?? "-"} {row.teamId} · {row.wins}-{row.losses}
              </Typography>
            ))
          )}
        </Section>

        {view.sections.myTeam && view.myTeam ? (
          <Section title="Đội của tôi">
            <Typography variant="body2" fontWeight={600}>
              {view.myTeam.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Trận tiếp theo: {view.myTeam.nextMatch?.id || "Chưa có"}
            </Typography>
          </Section>
        ) : null}

        {view.sections.captain && view.captain ? (
          <Section title="Nhiệm vụ đội trưởng">
            {(view.captain.tasks || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có nhiệm vụ Dreambreaker / lineup lúc này.
              </Typography>
            ) : (
              view.captain.tasks.map((task) => (
                <Button
                  key={`${task.type}-${task.matchupId}`}
                  component={RouterLink}
                  to={task.href}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                >
                  {task.label}
                </Button>
              ))
            )}
          </Section>
        ) : null}

        {view.sections.referee && view.referee ? (
          <Section title="Trọng tài được phân công">
            {(view.referee.assignments || []).map((item) => (
              <Button
                key={`${item.matchupId}-${item.matchId || "nav"}`}
                component={RouterLink}
                to={item.href}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              >
                Điều hành · {item.label}
              </Button>
            ))}
          </Section>
        ) : null}

        {view.sections.organizer && view.organizer ? (
          <Section title="Ban tổ chức">
            <Button
              component={RouterLink}
              to={teamTournamentPath(view.overview.id, TEAM_TAB_QUERY.teams)}
              variant="contained"
              size="small"
            >
              {view.organizer.primaryAction?.label || "Thiết lập giải"}
            </Button>
          </Section>
        ) : null}
      </Stack>
    </Box>
  );
}
