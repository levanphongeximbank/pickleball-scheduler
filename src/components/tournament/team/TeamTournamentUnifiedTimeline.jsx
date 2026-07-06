import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { MATCHUP_STATUS } from "../../../features/team-tournament/constants.js";
import {
  formatTeamTournamentDateTime,
  getMatchupStatusMeta,
} from "./teamTournamentLabels.js";

function formatSubMatchScore(match) {
  if (!match.result) {
    return "—";
  }
  const { teamAWins, teamBWins } = match.result;
  if (teamAWins == null && teamBWins == null) {
    return "—";
  }
  return `${teamAWins ?? 0}–${teamBWins ?? 0}`;
}

function MatchCard({ match }) {
  const statusMeta = match.status ? getMatchupStatusMeta(match.status) : null;
  const isOpen =
    !match.status ||
    match.status === MATCHUP_STATUS.LINEUP_OPEN ||
    match.status === MATCHUP_STATUS.SCHEDULED;

  return (
    <Paper variant="outlined" className="team-schedule-diagram__timeline-card">
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip size="small" label={`Trận ${match.matchNumberInRound || match.matchNumber}`} />
          <Chip size="small" variant="outlined" label={match.courtLabel || "Sân"} />
          {match.groupName ? (
            <Chip size="small" color="secondary" variant="outlined" label={match.groupName} />
          ) : null}
        </Stack>
        <Typography fontWeight={700}>
          {match.teamAName} vs {match.teamBName}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {statusMeta ? (
            <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
          ) : (
            <Chip size="small" label="Chưa tạo lịch" variant="outlined" />
          )}
          <Typography variant="body2" fontWeight={700}>
            TC: {formatSubMatchScore(match)}
          </Typography>
          {isOpen ? (
            <Chip size="small" label="Chưa khóa" variant="outlined" color="warning" />
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function TeamTournamentUnifiedTimeline({ timeSlots = [] }) {
  if (!timeSlots.length) {
    return <Alert severity="info">Chưa có khung giờ thi đấu. Tạo lịch vòng tròn trước.</Alert>;
  }

  return (
    <Stack spacing={2} className="team-schedule-diagram__timeline">
      {timeSlots.map((slot) => (
        <Box key={slot.slotKey} className="team-schedule-diagram__timeline-slot">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography fontWeight={700}>{slot.label}</Typography>
            {slot.scheduledAt ? (
              <Typography variant="caption" color="text.secondary">
                {formatTeamTournamentDateTime(slot.scheduledAt)}
              </Typography>
            ) : null}
          </Stack>

          {slot.restingTeams?.length ? (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              {slot.restingTeams
                .map((entry) => `${entry.groupName} nghỉ: ${entry.teamNames.join(", ")}`)
                .join(" · ")}
            </Typography>
          ) : null}

          <Box className="team-schedule-diagram__timeline-grid">
            {slot.matches.map((match) => (
              <MatchCard
                key={`${match.matchupId || match.teamAId}-${match.teamBId}-${match.matchNumber}`}
                match={match}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
