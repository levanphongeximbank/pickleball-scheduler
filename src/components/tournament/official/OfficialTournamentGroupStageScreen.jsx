import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import GroupStagePanel from "../GroupStagePanel.jsx";
import DrawPublishControls from "../DrawPublishControls.jsx";
import TournamentCourtSchedulePanel from "../TournamentCourtSchedulePanel.jsx";
import OfficialTournamentRefereeOps from "./OfficialTournamentRefereeOps.jsx";
import { resolveOfficialMatchScoringRules } from "../../../features/individual-tournament/engines/officialScoringRulesResolver.js";
import {
  isOfficialGroupScheduleReady,
  presentOfficialGroupLabel,
  projectOfficialGroupStageMatches,
  summarizeOfficialRefereeOps,
} from "../../../features/individual-tournament/index.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Group-stage operations: schedule/courts first; referee/scoring after schedule is valid.
 */
export default function OfficialTournamentGroupStageScreen({
  tournament,
  event,
  tournamentId,
  players = [],
  courts = [],
  clubId,
  tenantId = null,
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
  onGenerateSchedule,
  scheduleBusy = false,
}) {
  const sampleRule = resolveOfficialMatchScoringRules(tournament, {
    stage: "group",
    groupId: "g",
  });
  const draftRef = useRef({
    date: tournament?.courtSchedule?.date || "",
    startTime: tournament?.courtSchedule?.startTime || "",
    endTime: tournament?.courtSchedule?.endTime || "",
    courtIds: tournament?.courtSchedule?.courtIds || [],
  });
  const handleDraftChange = useCallback((draft) => {
    draftRef.current = draft;
  }, []);
  const [scheduleMessage, setScheduleMessage] = useState(null);

  const presentations = useMemo(
    () =>
      projectOfficialGroupStageMatches(tournament, event?.id, {
        players,
        courts,
      }),
    [tournament, event?.id, players, courts]
  );
  const scheduleReady = isOfficialGroupScheduleReady(event);
  const refereeSummary = useMemo(
    () => summarizeOfficialRefereeOps(tournament, event?.id),
    [tournament, event?.id]
  );
  const groupMatches = (event?.matches || []).filter((match) => !match.bracketMatchId);
  const completedCount = groupMatches.filter(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  ).length;

  if (!event?.groups?.length) {
    return <Alert severity="info">Chưa có vòng bảng. Hãy bốc thăm trước.</Alert>;
  }

  const handleSchedule = async () => {
    setScheduleMessage(null);
    const result = await onGenerateSchedule?.(draftRef.current);
    if (!result?.ok) {
      setScheduleMessage({
        type: "error",
        text: result?.error || "Không xếp được lịch vòng bảng.",
      });
      return;
    }
    setScheduleMessage({ type: "success", text: "Đã xếp lịch vòng bảng." });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={sampleRule.summaryLabel} color="info" />
        <Chip label={`${event.groups.length} bảng`} />
        <Chip label={`${groupMatches.length} trận`} />
        <Chip label={`${completedCount}/${groupMatches.length} hoàn thành`} />
        <Chip
          label={`${refereeSummary.assignedCount}/${refereeSummary.matchCount} trọng tài`}
        />
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

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Lịch thi đấu vòng bảng
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>Cặp đấu</TableCell>
              <TableCell>Giờ</TableCell>
              <TableCell>Sân</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {presentations.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">Chưa có trận vòng bảng.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              presentations.rows.map((row) => (
                <TableRow key={row.matchId}>
                  <TableCell>{row.heading}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.vsLine}</Typography>
                    {row.integrityError ? (
                      <Typography variant="caption" color="error">
                        {row.integrityMessage}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatTime(row.scheduledAt)}</TableCell>
                  <TableCell>{row.courtLabel || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Button
          sx={{ mt: 1.5 }}
          variant="contained"
          disabled={scheduleBusy || !canManage || !groupMatches.length}
          onClick={handleSchedule}
        >
          {scheduleBusy ? "Đang xếp lịch…" : "Xếp lịch vòng bảng"}
        </Button>
        {scheduleMessage ? (
          <Alert sx={{ mt: 1 }} severity={scheduleMessage.type}>
            {scheduleMessage.text}
          </Alert>
        ) : null}
      </Paper>

      <TournamentCourtSchedulePanel
        clubId={clubId}
        tenantId={tenantId}
        tournament={tournament}
        courts={courts}
        onSaved={onSavedCourts}
        onDraftChange={handleDraftChange}
      />

      <Typography variant="subtitle2" fontWeight={700}>
        Trọng tài vòng bảng
      </Typography>
      {scheduleReady ? (
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
          matchPresentationById={presentations.byMatchId}
        />
      ) : (
        <Alert severity="info">Hoàn tất lịch thi đấu trước khi phân công trọng tài.</Alert>
      )}

      <Typography variant="subtitle2" fontWeight={700}>
        Nhập điểm vòng bảng
      </Typography>
      {scheduleReady ? (
        <GroupStagePanel
          event={event}
          players={players}
          onSubmitScore={canManage ? onSubmitGroupScore : undefined}
          draftScope={draftScope}
          matchPresentationById={presentations.byMatchId}
          presentGroupLabel={(group) => presentOfficialGroupLabel(group)}
        />
      ) : (
        <Alert severity="info">Hoàn tất lịch thi đấu trước khi nhập điểm.</Alert>
      )}
    </Stack>
  );
}
