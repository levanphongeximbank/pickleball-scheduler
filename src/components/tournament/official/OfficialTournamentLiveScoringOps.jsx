import { useMemo } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import Button from "@mui/material/Button";

import GroupStagePanel from "../GroupStagePanel.jsx";
import BracketView from "../BracketView.jsx";
import { buildIndividualAllGroupStandings } from "../../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import { summarizeOfficialMatches } from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import { getRefereeAssignments } from "../../../features/individual-tournament/engines/refereeAssignEngine.js";
import { resolveBracketProgress } from "../../../tournament/engines/index.js";

function MatchOpsList({ title, matches, assignments, emptyText }) {
  if (!matches.length) {
    return <Alert severity="info">{emptyText}</Alert>;
  }
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {matches.map((match) => {
        const assignment = assignments[String(match.id)];
        return (
          <Box
            key={match.id}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              gap={1}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {match.groupLabel || match.roundName || match.stageLabel || "Trận"} ·{" "}
                  {match.name || match.id}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sân: {match.courtName || match.courtId || "—"} · TT:{" "}
                  {assignment?.refereeName || match.referee?.name || "Chưa gán"}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={match.status || "pending"}
                color={
                  String(match.status).includes("complete") ? "success" : "default"
                }
              />
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * Official live scoring stage — reuses GroupStagePanel / BracketView authorities.
 */
export default function OfficialTournamentLiveScoringOps({
  event,
  tournament,
  players = [],
  onSubmitGroupScore,
  onSubmitKnockoutScore,
  onToggleRoundLock,
  canManage = true,
  tournamentId,
  draftScope,
}) {
  const matchSummary = useMemo(
    () => summarizeOfficialMatches(tournament, event?.id),
    [tournament, event?.id]
  );
  const assignments = useMemo(
    () => getRefereeAssignments(tournament),
    [tournament]
  );
  const standings = useMemo(
    () => (event ? buildIndividualAllGroupStandings(event) : []),
    [event]
  );

  if (!event) {
    return <Alert severity="info">Chưa có nội dung thi đấu.</Alert>;
  }

  if (!matchSummary.total) {
    return (
      <Alert severity="info">
        Chưa có trận sẵn sàng chấm điểm. Hãy bốc thăm và sinh lịch trước.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" color="warning" label={`Chờ: ${matchSummary.waiting}`} />
        <Chip size="small" color="info" label={`Đang đấu: ${matchSummary.live}`} />
        <Chip size="small" color="success" label={`Hoàn tất: ${matchSummary.completed}`} />
      </Stack>

      {!canManage ? (
        <Alert severity="info">Bạn không có quyền nhập điểm trên giải này.</Alert>
      ) : null}

      <MatchOpsList
        title="Chờ thi đấu"
        matches={matchSummary.waitingMatches.slice(0, 12)}
        assignments={assignments}
        emptyText="Không còn trận chờ."
      />
      <MatchOpsList
        title="Đang thi đấu"
        matches={matchSummary.liveMatches.slice(0, 12)}
        assignments={assignments}
        emptyText="Không có trận đang thi đấu."
      />

      <Divider />
      <Typography variant="subtitle2">Nhập điểm vòng bảng (canonical)</Typography>
      <GroupStagePanel
        event={event}
        players={players}
        onSubmitScore={canManage ? onSubmitGroupScore : undefined}
        draftScope={draftScope}
      />

      {standings?.length ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Bảng xếp hạng vòng bảng
          </Typography>
          <Stack spacing={1}>
            {standings.map((group) => (
              <Box
                key={group.groupId || group.label}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {group.label || group.groupId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(group.standings || group.rows || [])
                    .slice(0, 4)
                    .map(
                      (row, index) =>
                        `${index + 1}. ${row.name || row.entryName || row.entryId}`
                    )
                    .join(" · ")}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      {event.bracket ? (
        <>
          <Divider />
          <Typography variant="subtitle2">Knockout / nhập điểm</Typography>
          <BracketView
            progress={resolveBracketProgress(event)}
            unlockedRounds={event?.bracket?.unlockedRounds || {}}
            onSubmitScore={canManage ? onSubmitKnockoutScore : undefined}
            onToggleRoundLock={canManage ? onToggleRoundLock : undefined}
            draftScope={draftScope}
          />
        </>
      ) : null}

      <Button
        component={RouterLink}
        to={`/tournament/director/${tournamentId}?eventId=${encodeURIComponent(event.id)}`}
        variant="outlined"
        size="small"
      >
        Mở Director Mode (điều hành sân)
      </Button>
    </Stack>
  );
}
