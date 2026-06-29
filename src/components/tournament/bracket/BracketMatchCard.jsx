import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import { Box, Stack, Typography } from "@mui/material";

import StatusBadge from "../animation/shared/StatusBadge.jsx";

export default function BracketMatchCard({
  match,
  visible = true,
  highlighted = false,
  style,
}) {
  if (!match) {
    return null;
  }

  return (
    <Box
      className={`tournament-bracket-match${
        visible ? " tournament-bracket-match--visible" : ""
      }${highlighted ? " tournament-bracket-match--highlight" : ""}${
        match.completed ? " tournament-bracket-match--done" : ""
      }${match.isThirdPlace ? " tournament-bracket-match--third" : ""}`}
      data-round={match.roundName}
      data-match-id={match.id}
      style={style}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.5}>
        <Box>
          <Typography variant="caption" fontWeight={800} color="primary.main" display="block">
            {match.code}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {match.roundDisplay}
          </Typography>
        </Box>
        <StatusBadge
          label={match.statusLabel}
          tone={
            match.status === "done" ? "success" : match.status === "live" ? "active" : "default"
          }
        />
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, mb: 0.5 }}>
        {match.scheduleText || "Chưa xếp lịch"}
        {match.courtLabel ? ` • ${match.courtLabel}` : ""}
      </Typography>

      <TeamRow team={match.home} />
      <Box className="tournament-bracket-match__divider" />
      <TeamRow team={match.away} />
    </Box>
  );
}

function TeamRow({ team }) {
  const showScore = team.score !== "" && team.score != null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      className={`tournament-bracket-team${
        team.isWinner ? " tournament-bracket-team--winner" : ""
      }${team.isLoser ? " tournament-bracket-team--loser" : ""}${
        team.isPlaceholder ? " tournament-bracket-team--placeholder" : ""
      }`}
    >
      <Box className="tournament-bracket-team__avatar">
        <GroupsIcon sx={{ fontSize: 15 }} />
      </Box>
      <Typography
        variant="body2"
        fontWeight={team.isWinner ? 800 : 500}
        sx={{ flex: 1, wordBreak: "break-word", lineHeight: 1.25 }}
      >
        {team.name}
      </Typography>
      {showScore ? (
        <Typography
          variant="body2"
          fontWeight={team.isWinner ? 900 : 600}
          className="tournament-bracket-team__score"
        >
          {team.score}
        </Typography>
      ) : null}
      {team.isWinner ? (
        <CheckCircleIcon sx={{ fontSize: 17, color: "#2e7d32", flexShrink: 0 }} />
      ) : null}
    </Stack>
  );
}
