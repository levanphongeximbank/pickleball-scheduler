import { Chip, Stack, Typography } from "@mui/material";

import MatchCard from "./MatchCard.jsx";
import TournamentSectionCard from "./TournamentSectionCard.jsx";

export default function MatchListPanel({
  title,
  matches = [],
  emptyText,
  chipColor = "default",
  getCardProps,
}) {
  return (
    <TournamentSectionCard
      title={title}
      badge={<Chip size="small" color={chipColor} label={matches.length} variant="outlined" />}
      sx={{ height: "100%", minHeight: 220, display: "flex", flexDirection: "column" }}
      contentSx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {matches.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Stack
          spacing={1}
          sx={{
            flex: 1,
            minHeight: 0,
            maxHeight: { xs: 360, md: 420 },
            overflowY: "auto",
            pr: 0.5,
          }}
        >
          {matches.map((match) => (
            <MatchCard key={match.id} {...getCardProps(match)} />
          ))}
        </Stack>
      )}
    </TournamentSectionCard>
  );
}
