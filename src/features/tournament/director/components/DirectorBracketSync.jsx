import { Grid, Paper, Typography } from "@mui/material";

import BracketView from "../../../../components/tournament/BracketView.jsx";
import DirectorMiniStandings from "./DirectorMiniStandings.jsx";

export default function DirectorBracketSync({ snapshot }) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            BXH nhanh
          </Typography>
          <DirectorMiniStandings standings={snapshot.standings} />
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            Bracket mini
          </Typography>
          <BracketView progress={snapshot.bracketProgress} canReset={false} />
        </Paper>
      </Grid>
    </Grid>
  );
}
