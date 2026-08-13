import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import GroupStagePanel from "../GroupStagePanel.jsx";
import DrawPublishControls from "../DrawPublishControls.jsx";
import TournamentCourtSchedulePanel from "../TournamentCourtSchedulePanel.jsx";
import OfficialTournamentRefereeOps from "./OfficialTournamentRefereeOps.jsx";
import { resolveOfficialMatchScoringRules } from "../../../features/individual-tournament/engines/officialScoringRulesResolver.js";

/**
 * Group-stage operations: schedule/courts/referee/scoring in one workspace.
 */
export default function OfficialTournamentGroupStageScreen({
  tournament,
  event,
  tournamentId,
  players = [],
  courts = [],
  clubId,
  drawPublish,
  hasDrawReopenPermission,
  onLockDraw,
  onPublishDraw,
  onReopenDraw,
  onForceRedraw,
  onSubmitGroupScore,
  draftScope,
  refereeRoster,
  onRosterChange,
  actor,
  onPersistRefereeTournament,
  canManage = true,
  onSavedCourts,
}) {
  const sampleRule = resolveOfficialMatchScoringRules(tournament, {
    stage: "group",
    groupId: "g",
  });

  if (!event?.groups?.length) {
    return <Alert severity="info">Chưa có vòng bảng. Hãy bốc thăm trước.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={sampleRule.summaryLabel} color="info" />
        <Chip label={`${event.groups.length} bảng`} />
        <Chip label={`${(event.matches || []).length} trận`} />
      </Stack>

      <DrawPublishControls
        tournament={tournament}
        groups={event.groups}
        drawPublish={drawPublish}
        hasReopenPermission={hasDrawReopenPermission}
        onLock={onLockDraw}
        onPublish={onPublishDraw}
        onReopen={onReopenDraw}
        onForceRedraw={onForceRedraw}
        compact
      />

      <Button
        component={RouterLink}
        to={`/tournament/publish-schedule?tournamentId=${encodeURIComponent(tournamentId)}`}
        variant="outlined"
      >
        Xếp lịch & công bố (giữ tournamentId)
      </Button>

      <TournamentCourtSchedulePanel
        clubId={clubId}
        tournament={tournament}
        courts={courts}
        onSaved={onSavedCourts}
      />

      <Typography variant="subtitle2" fontWeight={700}>
        Trọng tài vòng bảng
      </Typography>
      <OfficialTournamentRefereeOps
        tournament={tournament}
        eventId={event.id}
        roster={refereeRoster}
        onRosterChange={onRosterChange}
        actor={actor}
        clubId={clubId}
        courts={courts}
        players={players}
        canManage={canManage}
        tournamentId={tournamentId}
        onPersistTournament={onPersistRefereeTournament}
      />

      <Typography variant="subtitle2" fontWeight={700}>
        Nhập điểm vòng bảng
      </Typography>
      <GroupStagePanel
        event={event}
        players={players}
        onSubmitScore={canManage ? onSubmitGroupScore : undefined}
        draftScope={draftScope}
      />
    </Stack>
  );
}
