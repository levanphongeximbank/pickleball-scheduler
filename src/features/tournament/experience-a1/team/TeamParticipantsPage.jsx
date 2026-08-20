import { Link as RouterLink } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

import TeamRosterPanel from "../../../../components/tournament/TeamRosterPanel.jsx";
import { TEAM_TAB_QUERY } from "../../../../config/tournamentRoutes.js";
import { teamTournamentLegacyPath } from "./teamExperienceRoutes.js";
import { TeamExperiencePageFrame } from "./TeamExperiencePageFrame.jsx";
import { useTeamExperienceSetup } from "./useTeamExperienceSetup.js";
import { outlinedActionSx } from "../visual/tournamentExperienceTokens.js";

export default function TeamParticipantsPage() {
  const setup = useTeamExperienceSetup();
  const projection = setup.participantsProjection;

  return (
    <TeamExperiencePageFrame
      tournamentId={setup.tournamentId}
      title="Đội tham dự"
      subtitle="Participants = đội · roster theo playerId"
      activeKey="participants"
      loading={setup.loading}
      loadError={setup.loadError}
      message={setup.message}
      error={setup.error}
      primaryAction={
        <Button
          component={RouterLink}
          to={teamTournamentLegacyPath(setup.tournamentId, TEAM_TAB_QUERY.teams)}
          size="small"
          sx={outlinedActionSx}
        >
          Thiết lập đầy đủ
        </Button>
      }
    >
      {projection ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
          <Chip size="small" color="success" label={`${projection.teamCount} đội`} />
          <Chip
            size="small"
            label={`${projection.teams.reduce((n, t) => n + t.memberCount, 0)} thành viên`}
          />
          <Chip
            size="small"
            label={`Cảnh báo roster: ${projection.teams.reduce((n, t) => n + t.readiness.warningCount, 0)}`}
          />
        </Stack>
      ) : null}

      {!setup.access.canManage ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Chế độ chỉ xem. Thêm/xóa đội và thành viên dành cho BTC (hoặc quyền đã cấp).
        </Alert>
      ) : null}

      {setup.tournament ? (
        <TeamRosterPanel
          clubId={setup.effectiveClubId}
          tournamentId={setup.tournamentId}
          tournament={setup.tournament}
          teamData={setup.teamData}
          clubPlayers={setup.players}
          allTenantPlayers={setup.allTenantPlayers}
          clubs={setup.clubs}
          tenantId={setup.tenantId}
          clubFromQuery={setup.clubFromQuery}
          activeClubId={setup.activeClubId}
          canManage={setup.access.canManage}
          canViewAll={setup.access.canViewAll}
          viewerPlayerId={setup.access.viewerPlayerId}
          setupVersion={setup.version ?? 0}
          setupVersionForMutations={setup.version ?? 0}
          persistSetupTeamData={setup.persistSetupTeamData}
          refreshAfterMutation={setup.refreshAfterMutation}
          beginMutationBarrier={setup.beginMutationBarrier}
          endMutationBarrier={setup.endMutationBarrier}
          athletePoolLoadingInitial={
            setup.clubPool.loadingInitial ||
            (Boolean(setup.clubPool.tenantId) && setup.tenantPool.loadingInitial)
          }
          athletePoolRefreshing={
            setup.clubPool.refreshing ||
            (Boolean(setup.clubPool.tenantId) && setup.tenantPool.refreshing)
          }
          athletePoolError={setup.clubPool.error || setup.tenantPool.error}
          setupReady={Boolean(setup.tournament && setup.teamData)}
          onUpdated={(opts) => setup.reload({ silent: true, ...opts })}
          onError={setup.setError}
          onMessage={setup.setMessage}
        />
      ) : null}

      {projection?.teams?.length ? (
        <Stack spacing={0.75} sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Tóm tắt đội (projection)</Typography>
          {projection.teams.map((team) => (
            <Typography key={team.id} sx={{ fontSize: 12.5 }}>
              {team.name} · {team.memberCount} VĐV
              {team.captainPlayerId ? ` · đội trưởng ${team.captainPlayerId}` : " · chưa có đội trưởng"}
              {team.groupLabel ? ` · ${team.groupLabel}` : ""}
              {team.readiness.warningCount
                ? ` · ${team.readiness.warningCount} cảnh báo`
                : ""}
            </Typography>
          ))}
        </Stack>
      ) : null}
    </TeamExperiencePageFrame>
  );
}
