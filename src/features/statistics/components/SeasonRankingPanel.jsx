import {
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import SeasonExportActions from "../../../components/tournament/SeasonExportActions.jsx";
import SeasonStandingsTable from "../../../components/tournament/SeasonStandingsTable.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";

export default function SeasonRankingPanel({
  seasons,
  standingsSeasonId,
  onStandingsSeasonChange,
  leaguesForStandingsSeason,
  standingsLeagueId,
  onStandingsLeagueChange,
  onExportSeasonStandingsCsv,
  activeSeason,
  onMessage,
  seasonStandingsRows,
  selectedStandingsSeason,
  selectedStandingsLeague,
}) {
  return (
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            BXH mùa giải (Giải đấu V3.3)
          </Typography>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ mb: 2, alignItems: { md: "center" } }}
          >
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Mùa giải</InputLabel>
              <Select
                label="Mùa giải"
                value={standingsSeasonId || ""}
                onChange={(event) => onStandingsSeasonChange(event.target.value)}
              >
                {seasons.map((season) => (
                  <MenuItem key={season.id} value={season.id}>
                    {season.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Giải / League</InputLabel>
              <Select
                label="Giải / League"
                value={standingsLeagueId || ""}
                onChange={(event) => onStandingsLeagueChange(event.target.value)}
              >
                {leaguesForStandingsSeason.map((league) => (
                  <MenuItem key={league.id} value={league.id}>
                    {league.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
              <Button variant="outlined" onClick={onExportSeasonStandingsCsv}>
                Xuất CSV BXH
              </Button>
            </PermissionGate>

            <SeasonExportActions
              seasonId={standingsSeasonId || activeSeason?.id}
              onMessage={onMessage}
            />
          </Stack>

          <SeasonStandingsTable
            rows={seasonStandingsRows}
            seasonName={selectedStandingsSeason?.name || ""}
            leagueName={selectedStandingsLeague?.name || ""}
            pointsSystem={selectedStandingsLeague?.pointsSystem || null}
          />
        </CardContent>
      </Card>
    </Grid>
  );
}
