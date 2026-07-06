import { Box, Stack, Typography } from "@mui/material";

export default function BracketMatchCard({
  match,
  visible = true,
  highlighted = false,
  style,
}) {
  if (!match) {
    return null;
  }

  const isFinal = match.roundName === "Chung ket";

  return (
    <Box
      className={`tournament-bracket-match${
        visible ? " tournament-bracket-match--visible" : ""
      }${highlighted ? " tournament-bracket-match--highlight" : ""}${
        match.completed ? " tournament-bracket-match--done" : ""
      }${match.status === "live" ? " tournament-bracket-match--live" : ""}${
        match.isThirdPlace ? " tournament-bracket-match--third" : ""
      }${isFinal ? " tournament-bracket-match--final" : ""}`}
      data-round={match.roundName}
      data-match-id={match.id}
      style={style}
    >
      <Typography variant="caption" className="tournament-bracket-match__meta" display="block">
        {match.metaLine || match.code}
      </Typography>

      <TeamRow team={match.home} />
      <Box className="tournament-bracket-match__divider" />
      <TeamRow team={match.away} />
    </Box>
  );
}

function TeamRow({ team }) {
  const seedBadge = formatSeedBadge(team.seed);
  const hasScore = team.score !== "" && team.score != null;

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
      {seedBadge ? (
        <Box className="tournament-bracket-team__seed" title={`Hạt giống ${seedBadge}`}>
          {seedBadge}
        </Box>
      ) : (
        <Box className="tournament-bracket-team__seed tournament-bracket-team__seed--empty" />
      )}
      <Typography
        variant="body2"
        fontWeight={team.isWinner ? 700 : 500}
        className="tournament-bracket-team__name"
        sx={{ flex: 1, wordBreak: "break-word", lineHeight: 1.25 }}
      >
        {team.name}
      </Typography>
      <Box
        className={`tournament-bracket-team__score-box${
          team.isWinner ? " tournament-bracket-team__score-box--winner" : ""
        }${hasScore && !team.isWinner ? " tournament-bracket-team__score-box--loser" : ""}${
          !hasScore ? " tournament-bracket-team__score-box--empty" : ""
        }`}
      >
        {hasScore ? team.score : ""}
      </Box>
    </Stack>
  );
}

function formatSeedBadge(seed) {
  const text = String(seed || "").trim();
  if (!text || text.startsWith("W(")) {
    return "";
  }
  return text;
}
