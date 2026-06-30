import { Alert, Box, Grid, Typography } from "@mui/material";

import ExportStatsPanel from "./components/ExportStatsPanel.jsx";
import PlayerStatsPanel from "./components/PlayerStatsPanel.jsx";
import SeasonRankingPanel from "./components/SeasonRankingPanel.jsx";
import TournamentStatsPanel from "./components/TournamentStatsPanel.jsx";
import { useStatisticsData } from "./hooks/useStatisticsData.js";

export default function Statistics() {
  const data = useStatisticsData();

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        Thống kê
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {data.activeSeason?.name || "Mùa hiện tại"}
        {data.activeLeague ? ` • ${data.activeLeague.name}` : ""}
      </Typography>

      {data.statusMessage && (
        <Alert severity={data.statusMessage.type} sx={{ mb: 2 }}>
          {data.statusMessage.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <SeasonRankingPanel
            seasons={data.seasons}
            standingsSeasonId={data.standingsSeasonId}
            onStandingsSeasonChange={data.handleStandingsSeasonChange}
            leaguesForStandingsSeason={data.leaguesForStandingsSeason}
            standingsLeagueId={data.standingsLeagueId}
            onStandingsLeagueChange={data.setStandingsLeagueId}
            onExportSeasonStandingsCsv={data.handleExportSeasonStandingsCsv}
            activeSeason={data.activeSeason}
            onMessage={data.setStatusMessage}
            seasonStandingsRows={data.seasonStandingsRows}
            selectedStandingsSeason={data.selectedStandingsSeason}
            selectedStandingsLeague={data.selectedStandingsLeague}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ExportStatsPanel
            rounds={data.rounds}
            selectedRound={data.selectedRound}
            onSelectedRoundChange={data.setSelectedRound}
            shiftOptions={data.shiftOptions}
            selectedShift={data.selectedShift}
            onSelectedShiftChange={data.setSelectedShift}
            filteredSessions={data.filteredSessions}
            onExportFilteredCsv={data.handleExportFilteredCsv}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TournamentStatsPanel
            matchOutcomeStats={data.matchOutcomeStats}
            completedResultSessions={data.completedResultSessions}
            operationalMetrics={data.operationalMetrics}
            trendPoints={data.trendPoints}
            trendPath={data.trendPath}
            trendSummary={data.trendSummary}
            waitingTrendPoints={data.waitingTrendPoints}
            waitingTrendPath={data.waitingTrendPath}
            waitingTrendMaxY={data.waitingTrendMaxY}
            rounds={data.rounds}
            selectedCompareRoundA={data.selectedCompareRoundA}
            onSelectedCompareRoundAChange={data.setSelectedCompareRoundA}
            selectedCompareRoundB={data.selectedCompareRoundB}
            onSelectedCompareRoundBChange={data.setSelectedCompareRoundB}
            waitingAlertThreshold={data.waitingAlertThreshold}
            onWaitingAlertThresholdChange={data.setWaitingAlertThreshold}
            onExportCompareCsv={data.handleExportCompareCsv}
            compareWinner={data.compareWinner}
            compareRoundAName={data.compareRoundAName}
            compareRoundBName={data.compareRoundBName}
            compareRoundAMetrics={data.compareRoundAMetrics}
            compareRoundBMetrics={data.compareRoundBMetrics}
            compareRoundAGrade={data.compareRoundAGrade}
            compareRoundBGrade={data.compareRoundBGrade}
            fairnessMetrics={data.fairnessMetrics}
            fairnessLevel={data.fairnessLevel}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <PlayerStatsPanel
            playerStats={data.playerStats}
            playerNameById={data.playerNameById}
            recentSessions={data.recentSessions}
            topPartners={data.topPartners}
            topOpponents={data.topOpponents}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
