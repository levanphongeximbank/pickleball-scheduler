import { useEffect, useMemo, useState } from "react";

import { loadAIData } from "../../../ai/storage";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardSubscriptionForClub } from "../../../auth/subscriptionGuard.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import { loadRoundsForClub } from "../../../domain/clubStorage.js";
import { getLeagueStandingsBoard } from "../../../domain/seasonStandingsService.js";
import { filterSessionsByContext } from "../../../pages/statistics.logic";
import { buildSeasonStandingsCsv } from "../../../pages/statistics.season.logic";
import { loadPlayersFromStorage } from "../../../pages/selectPlayers.data";
import {
  buildCompareWinner,
  buildFairnessMetrics,
  buildHistoryFromSessions,
  buildMatchOutcomeStats,
  buildOperationalMetrics,
  buildTrendPath,
  getRoundGrade,
  getRoundMetric,
  getTrendPoints,
} from "../services/statisticsMetricsService.js";
import {
  buildFilteredSessionsCsv,
  buildRoundCompareCsv,
  downloadCsv,
} from "../services/statisticsExportService.js";

export function useStatisticsData() {
  const { activeClubId, revision } = useClub();
  const { can } = useAuth();
  const { activeSeason, activeLeague, seasons, leagues } = useSeasonLeague();

  const aiData = useMemo(() => loadAIData(activeClubId), [activeClubId, revision]);
  const sessions = useMemo(
    () =>
      filterSessionsByContext(aiData.sessions || [], {
        seasonId: activeSeason?.id || null,
        leagueId: activeLeague?.id || null,
      }),
    [aiData.sessions, activeSeason?.id, activeLeague?.id]
  );

  const [selectedRound, setSelectedRound] = useState("all");
  const [selectedShift, setSelectedShift] = useState("all");
  const [selectedCompareRoundA, setSelectedCompareRoundA] = useState("all");
  const [selectedCompareRoundB, setSelectedCompareRoundB] = useState("all");
  const [waitingAlertThreshold, setWaitingAlertThreshold] = useState(2);
  const [statusMessage, setStatusMessage] = useState(null);
  const [standingsSeasonId, setStandingsSeasonId] = useState(activeSeason?.id || "");
  const [standingsLeagueId, setStandingsLeagueId] = useState(activeLeague?.id || "");

  useEffect(() => {
    if (activeSeason?.id) {
      setStandingsSeasonId(activeSeason.id);
    }
  }, [activeSeason?.id]);

  useEffect(() => {
    if (activeLeague?.id) {
      setStandingsLeagueId(activeLeague.id);
    }
  }, [activeLeague?.id]);

  const rounds = useMemo(() => loadRoundsForClub(activeClubId), [activeClubId, revision]);
  const players = useMemo(() => loadPlayersFromStorage(activeClubId), [activeClubId, revision]);

  const playerNameById = useMemo(() => {
    const map = {};
    players.forEach((player) => {
      map[player.id] = player.name;
    });
    return map;
  }, [players]);

  const leaguesForStandingsSeason = useMemo(
    () => leagues.filter((league) => String(league.seasonId) === String(standingsSeasonId)),
    [leagues, standingsSeasonId]
  );

  const selectedStandingsSeason = useMemo(
    () => seasons.find((season) => String(season.id) === String(standingsSeasonId)) || null,
    [seasons, standingsSeasonId]
  );

  const selectedStandingsLeague = useMemo(
    () =>
      leaguesForStandingsSeason.find((league) => String(league.id) === String(standingsLeagueId)) ||
      null,
    [leaguesForStandingsSeason, standingsLeagueId]
  );

  const seasonStandingsRows = useMemo(() => {
    if (!standingsLeagueId) {
      return [];
    }
    return getLeagueStandingsBoard(activeClubId, standingsLeagueId);
  }, [activeClubId, standingsLeagueId, revision]);

  const shiftOptions = useMemo(() => {
    const set = new Set();
    sessions.forEach((session) => {
      if (session.meta?.shiftLabel) {
        set.add(session.meta.shiftLabel);
      }
    });
    return Array.from(set);
  }, [sessions]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const matchRound =
          selectedRound === "all" ||
          String(session.meta?.roundId || "") === String(selectedRound);
        const matchShift =
          selectedShift === "all" ||
          String(session.meta?.shiftLabel || "") === String(selectedShift);
        return matchRound && matchShift;
      }),
    [sessions, selectedRound, selectedShift]
  );

  const compareScopeSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          selectedShift === "all" ||
          String(session.meta?.shiftLabel || "") === String(selectedShift)
      ),
    [sessions, selectedShift]
  );

  const history = useMemo(() => buildHistoryFromSessions(filteredSessions), [filteredSessions]);

  const playerStats = useMemo(
    () =>
      Object.entries(history)
        .map(([id, data]) => ({
          id,
          name: playerNameById[id] || data.name || `Player ${id}`,
          games: data.games || 0,
          partners: Object.entries(data.partners || {}),
          opponents: Object.entries(data.opponents || {}),
        }))
        .sort((a, b) => b.games - a.games)
        .slice(0, 12),
    [history, playerNameById]
  );

  const matchOutcomeStats = useMemo(
    () => buildMatchOutcomeStats(filteredSessions, playerNameById),
    [filteredSessions, playerNameById]
  );

  const completedResultSessions = useMemo(
    () => filteredSessions.filter((session) => session.result?.status === "completed").length,
    [filteredSessions]
  );

  const topPartners = useMemo(
    () =>
      playerStats
        .flatMap((player) =>
          player.partners.map(([partnerId, count]) => ({
            playerName: player.name,
            partnerId,
            partnerName: playerNameById[partnerId] || partnerId,
            count,
          }))
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    [playerStats, playerNameById]
  );

  const topOpponents = useMemo(
    () =>
      playerStats
        .flatMap((player) =>
          player.opponents.map(([opponentId, count]) => ({
            playerName: player.name,
            opponentId,
            opponentName: playerNameById[opponentId] || opponentId,
            count,
          }))
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    [playerStats, playerNameById]
  );

  const fairnessMetrics = useMemo(() => buildFairnessMetrics(playerStats), [playerStats]);
  const operationalMetrics = useMemo(
    () => buildOperationalMetrics(filteredSessions),
    [filteredSessions]
  );

  const recentSessions = useMemo(
    () =>
      [...filteredSessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [filteredSessions]
  );

  const trendPoints = useMemo(
    () => getTrendPoints(filteredSessions, (session) => Number(session.aiScore?.total || 0), 20),
    [filteredSessions]
  );

  const waitingTrendPoints = useMemo(
    () => getTrendPoints(filteredSessions, (session) => Number(session.waiting?.length || 0), 20),
    [filteredSessions]
  );

  const waitingTrendMaxY = useMemo(() => {
    if (waitingTrendPoints.length === 0) {
      return 4;
    }
    const maxValue = Math.max(...waitingTrendPoints.map((point) => point.y));
    return Math.max(4, maxValue + 1);
  }, [waitingTrendPoints]);

  const trendPath = useMemo(() => buildTrendPath(trendPoints, 720, 220, 24), [trendPoints]);
  const waitingTrendPath = useMemo(
    () => buildTrendPath(waitingTrendPoints, 720, 220, 24, 0, waitingTrendMaxY),
    [waitingTrendPoints, waitingTrendMaxY]
  );

  const trendSummary = useMemo(() => {
    if (trendPoints.length < 2) {
      return {
        delta: 0,
        best: trendPoints[0]?.y || 0,
        worst: trendPoints[0]?.y || 0,
      };
    }

    const first = trendPoints[0].y;
    const last = trendPoints[trendPoints.length - 1].y;
    const scores = trendPoints.map((point) => point.y);

    return {
      delta: Math.round((last - first) * 10) / 10,
      best: Math.max(...scores),
      worst: Math.min(...scores),
    };
  }, [trendPoints]);

  const compareRoundAMetrics = useMemo(
    () => getRoundMetric(selectedCompareRoundA, compareScopeSessions),
    [selectedCompareRoundA, compareScopeSessions]
  );

  const compareRoundBMetrics = useMemo(
    () => getRoundMetric(selectedCompareRoundB, compareScopeSessions),
    [selectedCompareRoundB, compareScopeSessions]
  );

  const compareRoundAName = useMemo(() => {
    const round = rounds.find((item) => String(item.id) === String(selectedCompareRoundA));
    return round?.name || "Round A";
  }, [rounds, selectedCompareRoundA]);

  const compareRoundBName = useMemo(() => {
    const round = rounds.find((item) => String(item.id) === String(selectedCompareRoundB));
    return round?.name || "Round B";
  }, [rounds, selectedCompareRoundB]);

  const compareWinner = useMemo(
    () =>
      buildCompareWinner(
        compareRoundAMetrics,
        compareRoundBMetrics,
        compareRoundAName,
        compareRoundBName
      ),
    [compareRoundAMetrics, compareRoundBMetrics, compareRoundAName, compareRoundBName]
  );

  const compareRoundAGrade = useMemo(
    () => getRoundGrade(compareRoundAMetrics),
    [compareRoundAMetrics]
  );
  const compareRoundBGrade = useMemo(
    () => getRoundGrade(compareRoundBMetrics),
    [compareRoundBMetrics]
  );

  const fairnessLevel = useMemo(() => {
    if (fairnessMetrics.fairnessScore >= 70) return "Tốt";
    if (fairnessMetrics.fairnessScore >= 40) return "Trung bình";
    return "Cần cải thiện";
  }, [fairnessMetrics.fairnessScore]);

  const assertExportAllowed = () => {
    if (!can(PERMISSIONS.STATISTICS_EXPORT, { clubId: activeClubId })) {
      setStatusMessage({ type: "error", text: "Không có quyền xuất thống kê." });
      return false;
    }

    const planCheck = guardSubscriptionForClub(activeClubId, "statistics");
    if (!planCheck.ok) {
      setStatusMessage({ type: "error", text: planCheck.error });
      return false;
    }

    return true;
  };

  const handleExportFilteredCsv = () => {
    if (!assertExportAllowed()) {
      return;
    }

    if (filteredSessions.length === 0) {
      setStatusMessage({ type: "error", text: "Không có dữ liệu sau lọc để xuất CSV." });
      return;
    }

    const csv = buildFilteredSessionsCsv(filteredSessions);
    downloadCsv(csv, `pickleball-statistics-${new Date().toISOString().slice(0, 10)}.csv`);
    setStatusMessage({ type: "success", text: "Đã xuất CSV theo bộ lọc hiện tại." });
  };

  const handleExportCompareCsv = () => {
    if (!assertExportAllowed()) {
      return;
    }

    if (compareRoundAMetrics.sessionCount === 0 && compareRoundBMetrics.sessionCount === 0) {
      setStatusMessage({ type: "error", text: "Không có dữ liệu so sánh để xuất CSV." });
      return;
    }

    const csv = buildRoundCompareCsv({
      compareRoundAName,
      compareRoundBName,
      compareRoundAMetrics,
      compareRoundBMetrics,
      compareRoundAGrade,
      compareRoundBGrade,
      waitingAlertThreshold,
    });
    downloadCsv(csv, `pickleball-round-compare-${new Date().toISOString().slice(0, 10)}.csv`);
    setStatusMessage({ type: "success", text: "Đã xuất CSV phần so sánh Round A/B." });
  };

  const handleStandingsSeasonChange = (seasonId) => {
    setStandingsSeasonId(seasonId);
    const nextLeagues = leagues.filter((league) => String(league.seasonId) === String(seasonId));
    setStandingsLeagueId(nextLeagues[0]?.id || "");
  };

  const handleExportSeasonStandingsCsv = () => {
    if (!assertExportAllowed()) {
      return;
    }

    if (!seasonStandingsRows.length) {
      setStatusMessage({ type: "warning", text: "Chưa có dữ liệu BXH mùa giải để xuất." });
      return;
    }

    const csv = buildSeasonStandingsCsv(seasonStandingsRows, {
      seasonName: selectedStandingsSeason?.name || "",
      leagueName: selectedStandingsLeague?.name || "",
    });
    downloadCsv(csv, `bxh-mua-giai-${new Date().toISOString().slice(0, 10)}.csv`);
    setStatusMessage({ type: "success", text: "Đã xuất CSV BXH mùa giải." });
  };

  return {
    activeSeason,
    activeLeague,
    statusMessage,
    seasons,
    leagues,
    rounds,
    shiftOptions,
    selectedRound,
    setSelectedRound,
    selectedShift,
    setSelectedShift,
    selectedCompareRoundA,
    setSelectedCompareRoundA,
    selectedCompareRoundB,
    setSelectedCompareRoundB,
    waitingAlertThreshold,
    setWaitingAlertThreshold,
    standingsSeasonId,
    standingsLeagueId,
    setStandingsLeagueId,
    leaguesForStandingsSeason,
    selectedStandingsSeason,
    selectedStandingsLeague,
    seasonStandingsRows,
    filteredSessions,
    matchOutcomeStats,
    completedResultSessions,
    operationalMetrics,
    trendPoints,
    waitingTrendPoints,
    waitingTrendMaxY,
    trendPath,
    waitingTrendPath,
    trendSummary,
    compareRoundAMetrics,
    compareRoundBMetrics,
    compareRoundAName,
    compareRoundBName,
    compareWinner,
    compareRoundAGrade,
    compareRoundBGrade,
    fairnessMetrics,
    fairnessLevel,
    playerStats,
    playerNameById,
    recentSessions,
    topPartners,
    topOpponents,
    handleStandingsSeasonChange,
    handleExportSeasonStandingsCsv,
    handleExportFilteredCsv,
    handleExportCompareCsv,
    setStatusMessage,
  };
}
