import { Box, Typography } from "@mui/material";

import BracketMatchCard from "./BracketMatchCard.jsx";
import ChampionCard from "./ChampionCard.jsx";
import ThirdPlaceCard from "./ThirdPlaceCard.jsx";

export default function BracketMobileTimeline({
  viewModel,
  activeRoundKey = "",
  isMatchVisible,
  isRoundVisible,
  connectorReveal = 1,
  onViewSummary,
}) {
  const { rounds = [], champion, thirdPlace, thirdPlaceTeam } = viewModel || {};

  if (!rounds.length) {
    return null;
  }

  const finalCompleted = rounds[rounds.length - 1]?.matches?.[0]?.completed;
  const hasChampion = Boolean(champion?.name);

  return (
    <Box className="tournament-bracket-mobile">
      {rounds.map((round, roundIndex) => {
        const active = round.key === activeRoundKey;
        const roundVisible = isRoundVisible(roundIndex);

        return (
          <Box
            key={round.key}
            className="tournament-bracket-mobile__round"
            data-round-key={round.key}
            id={`bracket-round-${round.key}`}
          >
            <Box
              className={`tournament-bracket-mobile__round-title${
                active ? " tournament-bracket-tree__round-label--active" : ""
              }`}
            >
              <Typography variant="subtitle1" fontWeight={800} color="primary.dark">
                {round.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {round.matches.length} trận
              </Typography>
            </Box>

            {round.matches.map((match, matchIndex) => (
              <BracketMatchCard
                key={match.id}
                match={match}
                visible={roundVisible && isMatchVisible(roundIndex, matchIndex)}
                highlighted={active}
                style={{ position: "static", width: "100%", marginBottom: 8 }}
              />
            ))}

            {roundIndex < rounds.length - 1 ? (
              <Box
                className={`tournament-bracket-mobile__connector${
                  round.completed ? " tournament-bracket-mobile__connector--active" : ""
                }`}
              />
            ) : null}
          </Box>
        );
      })}

      <ChampionCard
        champion={champion}
        revealed={isRoundVisible(rounds.length - 1) || connectorReveal >= 1}
        celebrate={hasChampion && finalCompleted}
        onViewSummary={onViewSummary}
        style={{ position: "static", width: "100%", marginTop: 8 }}
      />

      {thirdPlace || thirdPlaceTeam ? (
        <Box sx={{ mt: 1.5 }}>
          <ThirdPlaceCard match={thirdPlace} team={thirdPlaceTeam} />
        </Box>
      ) : null}
    </Box>
  );
}
