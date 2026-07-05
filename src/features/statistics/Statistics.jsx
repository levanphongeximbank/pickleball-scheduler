import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { Alert, Box, Grid, Typography } from "@mui/material";

import ExportStatsPanel from "./components/ExportStatsPanel.jsx";
import PlayerStatsPanel from "./components/PlayerStatsPanel.jsx";
import SeasonRankingPanel from "./components/SeasonRankingPanel.jsx";
import TournamentStatsPanel from "./components/TournamentStatsPanel.jsx";
import { useStatisticsData } from "./hooks/useStatisticsData.js";

const VIEW_LABELS = {
  scoreboard: "Bảng điểm giải",
  rankings: "Xếp hạng mùa giải",
  players: "Thành tích vận động viên",
};

export default function Statistics() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  const showAll = !view || !VIEW_LABELS[view];
  const rankingsRef = useRef(null);
  const scoreboardRef = useRef(null);
  const playersRef = useRef(null);

  const data = useStatisticsData();

  useEffect(() => {
    const target =
      view === "rankings"
        ? rankingsRef
        : view === "scoreboard"
          ? scoreboardRef
          : view === "players"
            ? playersRef
            : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const title = VIEW_LABELS[view] || "Thống kê";

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        {title}
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
        {(showAll || view === "rankings") && (
          <Grid size={{ xs: 12 }} ref={rankingsRef}>
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
        )}

        {showAll && (
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
        )}

        {(showAll || view === "scoreboard") && (
          <Grid size={{ xs: 12 }} ref={scoreboardRef}>
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
        )}

        {(showAll || view === "players") && (
          <Grid size={{ xs: 12 }} ref={playersRef}>
            <PlayerStatsPanel
              playerStats={data.playerStats}
              playerNameById={data.playerNameById}
              recentSessions={data.recentSessions}
              topPartners={data.topPartners}
              topOpponents={data.topOpponents}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
