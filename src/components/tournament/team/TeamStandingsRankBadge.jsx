import { Box } from "@mui/material";

export default function TeamStandingsRankBadge({ rank }) {
  const rankClass =
    rank === 1
      ? "team-standings__rank--first"
      : rank === 2
        ? "team-standings__rank--second"
        : rank === 3
          ? "team-standings__rank--third"
          : "";

  return (
    <Box component="span" className={`team-standings__rank ${rankClass}`}>
      {rank}
    </Box>
  );
}
