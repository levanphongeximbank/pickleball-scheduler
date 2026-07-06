import { Grid, Paper, Typography } from "@mui/material";

export default function DirectorMiniStandings({ standings = [] }) {
  if (!standings.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chua co bang xep hang.
      </Typography>
    );
  }

  return (
    <Grid container spacing={1}>
      {standings.map((groupStanding) => (
        <Grid key={groupStanding.group} size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 1 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
              Bang {groupStanding.group}
            </Typography>
            {groupStanding.standing.slice(0, 3).map((team, index) => (
              <Typography key={team.id} variant="caption" sx={{ display: "block" }}>
                {index + 1}. {team.name} ({team.matchPoints}d)
              </Typography>
            ))}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
