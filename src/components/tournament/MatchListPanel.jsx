import { Chip, Paper, Stack, Typography } from "@mui/material";

import MatchCard from "./MatchCard.jsx";

export default function MatchListPanel({
  title,
  matches = [],
  emptyText,
  chipColor = "default",
  getCardProps,
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 1.5 }, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
        <Chip size="small" color={chipColor} label={matches.length} />
      </Stack>

      {matches.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {matches.map((match) => (
            <MatchCard key={match.id} {...getCardProps(match)} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}
