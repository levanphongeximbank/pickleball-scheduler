import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { loadAIData } from "../ai/storage";
import SeasonStandingsTable from "../components/tournament/SeasonStandingsTable.jsx";
import { useClub } from "../context/ClubContext.jsx";
import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { loadRoundsForClub } from "../domain/clubStorage.js";
import { getLeagueStandingsBoard } from "../domain/seasonStandingsService.js";
import { loadPlayersFromStorage } from "./selectPlayers.data";
import { filterSessionsByContext } from "./statistics.logic";
import { buildSeasonStandingsCsv } from "./statistics.season.logic";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { guardSubscriptionForClub } from "../auth/subscriptionGuard.js";
import SeasonExportActions from "../components/tournament/SeasonExportActions.jsx";

function buildHistoryFromSessions(sessions = []) {
  const history = {};

  const ensurePlayer = (player) => {
    if (!player || player.id === undefined || player.id === null) {
      return;
    }

    if (!history[player.id]) {
      history[player.id] = {
        games: 0,
        partners: {},
        opponents: {},
      };
    }
  };

  const addPartner = (a, b) => {
    if (!a || !b) {
      return;
    }

    ensurePlayer(a);
    ensurePlayer(b);
    history[a.id].partners[b.id] = (history[a.id].partners[b.id] || 0) + 1;
    history[b.id].partners[a.id] = (history[b.id].partners[a.id] || 0) + 1;
  };

  const addOpponent = (a, b) => {
    if (!a || !b) {
      return;
    }

    ensurePlayer(a);
    ensurePlayer(b);
    history[a.id].opponents[b.id] = (history[a.id].opponents[b.id] || 0) + 1;
    history[b.id].opponents[a.id] = (history[b.id].opponents[a.id] || 0) + 1;
  };

  sessions.forEach((session) => {
    (session.courts || []).forEach((court) => {
      const teamA = court.teamA || [];
      const teamB = court.teamB || [];
      const players = [...teamA, ...teamB];

      players.forEach((player) => {
        ensurePlayer(player);
        history[player.id].games += 1;
      });

      addPartner(teamA[0], teamA[1]);
      addPartner(teamB[0], teamB[1]);

      teamA.forEach((playerA) => {
        teamB.forEach((playerB) => {
          addOpponent(playerA, playerB);
        });
      });
    });
  });

  return history;
}

function buildMatchOutcomeStats(sessions = [], playerNameById = {}) {
  const statsByPlayerId = {};

  const ensurePlayer = (player) => {
    if (!player || player.id === undefined || player.id === null) {
      return null;
    }

    if (!statsByPlayerId[player.id]) {
      statsByPlayerId[player.id] = {
        id: player.id,
        name: playerNameById[player.id] || player.name || `Player ${player.id}`,
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    }

    return statsByPlayerId[player.id];
  };

  sessions.forEach((session) => {
    if (session?.result?.status !== "completed") {
      return;
    }

    const scheduleByCourt = new Map(
      (session.courts || []).map((court) => [String(court.court), court])
    );

    (session.result?.courts || []).forEach((courtResult) => {
      const scheduleCourt = scheduleByCourt.get(String(courtResult.courtId));
      if (!scheduleCourt) {
        return;
      }

      const teamA = scheduleCourt.teamA || [];
      const teamB = scheduleCourt.teamB || [];
      const teamAScore = Number(courtResult.teamAScore || 0);
      const teamBScore = Number(courtResult.teamBScore || 0);
      const winner = courtResult.winner || "draw";

      teamA.forEach((player) => {
        const stat = ensurePlayer(player);
        if (!stat) {
          return;
        }

        stat.pointsFor += teamAScore;
        stat.pointsAgainst += teamBScore;

        if (winner === "A") {
          stat.wins += 1;
        } else if (winner === "B") {
          stat.losses += 1;
        } else {
          stat.draws += 1;
        }
      });

      teamB.forEach((player) => {
        const stat = ensurePlayer(player);
        if (!stat) {
          return;
        }

        stat.pointsFor += teamBScore;
        stat.pointsAgainst += teamAScore;

        if (winner === "B") {
          stat.wins += 1;
        } else if (winner === "A") {
          stat.losses += 1;
        } else {
          stat.draws += 1;
        }
      });
    });
  });

  return Object.values(statsByPlayerId)
    .map((item) => ({
      ...item,
      totalMatches: item.wins + item.losses + item.draws,
      winRate:
        item.wins + item.losses + item.draws > 0
          ? Math.round((item.wins / (item.wins + item.losses + item.draws)) * 100)
          : 0,
      pointDiff: item.pointsFor - item.pointsAgainst,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.pointDiff - a.pointDiff;
    });
}

function getTrendPoints(sessions = [], selector = (session) => Number(session.aiScore?.total || 0), limit = 20) {
  return [...sessions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-limit)
    .map((session, index) => ({
      x: index,
      y: Number(selector(session) || 0),
      label: new Date(session.date).toLocaleString("vi-VN"),
    }));
}

function buildTrendPath(points, width, height, padding, minY = 0, maxY = 100) {
  if (!points || points.length === 0) {
    return "";
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const toY = (value) => {
    const clamped = Math.max(minY, Math.min(maxY, value));
    const normalized = (clamped - minY) / (maxY - minY || 1);
    return height - padding - normalized * innerHeight;
  };

  return points
    .map((point, index) => {
      const x = padding + index * stepX;
      const y = toY(point.y);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function Statistics() {
  const { activeClubId, revision } = useClub();
  const { can } = useAuth();
  const { activeSeason, activeLeague, seasons, leagues } = useSeasonLeague();

  const aiData = useMemo(
    () => loadAIData(activeClubId),
    [activeClubId, revision]
  );
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

  const rounds = useMemo(
    () => loadRoundsForClub(activeClubId),
    [activeClubId, revision]
  );

  const players = useMemo(
    () => loadPlayersFromStorage(activeClubId),
    [activeClubId, revision]
  );

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
      leaguesForStandingsSeason.find(
        (league) => String(league.id) === String(standingsLeagueId)
      ) || null,
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

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchRound =
        selectedRound === "all" ||
        String(session.meta?.roundId || "") === String(selectedRound);
      const matchShift =
        selectedShift === "all" ||
        String(session.meta?.shiftLabel || "") === String(selectedShift);

      return matchRound && matchShift;
    });
  }, [sessions, selectedRound, selectedShift]);

  const compareScopeSessions = useMemo(() => {
    return sessions.filter((session) => (
      selectedShift === "all" ||
      String(session.meta?.shiftLabel || "") === String(selectedShift)
    ));
  }, [sessions, selectedShift]);

  const history = useMemo(
    () => buildHistoryFromSessions(filteredSessions),
    [filteredSessions]
  );

  const playerStats = useMemo(() => {
    return Object.entries(history)
      .map(([id, data]) => ({
        id,
        name: playerNameById[id] || data.name || `Player ${id}`,
        games: data.games || 0,
        partners: Object.entries(data.partners || {}),
        opponents: Object.entries(data.opponents || {}),
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 12);
  }, [history, playerNameById]);

  const matchOutcomeStats = useMemo(
    () => buildMatchOutcomeStats(filteredSessions, playerNameById),
    [filteredSessions, playerNameById]
  );

  const completedResultSessions = useMemo(
    () => filteredSessions.filter((session) => session.result?.status === "completed").length,
    [filteredSessions]
  );

  const topPartners = useMemo(() => {
    return playerStats
      .flatMap((player) =>
        player.partners.map(([partnerId, count]) => ({
          playerName: player.name,
          partnerId,
          partnerName: playerNameById[partnerId] || partnerId,
          count,
        }))
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [playerStats, playerNameById]);

  const topOpponents = useMemo(() => {
    return playerStats
      .flatMap((player) =>
        player.opponents.map(([opponentId, count]) => ({
          playerName: player.name,
          opponentId,
          opponentName: playerNameById[opponentId] || opponentId,
          count,
        }))
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [playerStats, playerNameById]);

  const fairnessMetrics = useMemo(() => {
    if (playerStats.length === 0) {
      return {
        fairnessScore: 0,
        totalGames: 0,
        balanceScore: 0,
        partnerScore: 0,
        opponentScore: 0,
        repeatedPartnerCount: 0,
        repeatedOpponentCount: 0,
      };
    }

    const totalGames = playerStats.reduce((sum, player) => sum + (player.games || 0), 0);
    const avgGames = totalGames / playerStats.length;
    const variance = playerStats.reduce((sum, player) => {
      const diff = (player.games || 0) - avgGames;
      return sum + diff * diff;
    }, 0) / playerStats.length;
    const stdDev = Math.sqrt(variance);

    const balanceScore = avgGames > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / avgGames) * 40)))
      : 100;

    const repeatedPartnerCount = playerStats.reduce((sum, player) => {
      const partnerRepeats = player.partners.reduce(
        (count, [, gamesTogether]) => count + Math.max(0, gamesTogether - 1),
        0
      );
      return sum + partnerRepeats;
    }, 0) / 2;

    const repeatedOpponentCount = playerStats.reduce((sum, player) => {
      const opponentRepeats = player.opponents.reduce(
        (count, [, gamesTogether]) => count + Math.max(0, gamesTogether - 1),
        0
      );
      return sum + opponentRepeats;
    }, 0) / 2;

    const partnerScore = Math.max(0, 100 - Math.min(80, repeatedPartnerCount * 15));
    const opponentScore = Math.max(0, 100 - Math.min(80, repeatedOpponentCount * 10));
    const fairnessScore = Math.round((balanceScore + partnerScore + opponentScore) / 3);

    return {
      fairnessScore,
      totalGames,
      balanceScore,
      partnerScore,
      opponentScore,
      repeatedPartnerCount,
      repeatedOpponentCount,
    };
  }, [playerStats]);

  const operationalMetrics = useMemo(() => {
    if (filteredSessions.length === 0) {
      return {
        totalSessions: 0,
        avgAIScore: 0,
        avgWaiting: 0,
        totalCourtsUsed: 0,
      };
    }

    const totalSessions = filteredSessions.length;
    const avgAIScore = Math.round(
      filteredSessions.reduce((sum, session) => sum + Number(session.aiScore?.total || 0), 0) / totalSessions
    );
    const avgWaiting = Math.round(
      filteredSessions.reduce((sum, session) => sum + Number(session.waiting?.length || 0), 0) / totalSessions
    );
    const totalCourtsUsed = filteredSessions.reduce(
      (sum, session) => sum + Number(session.courts?.length || 0),
      0
    );

    return {
      totalSessions,
      avgAIScore,
      avgWaiting,
      totalCourtsUsed,
    };
  }, [filteredSessions]);

  const recentSessions = useMemo(() => {
    return [...filteredSessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [filteredSessions]);

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

  const trendPath = useMemo(
    () => buildTrendPath(trendPoints, 720, 220, 24),
    [trendPoints]
  );

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

  const getRoundMetric = (roundId) => {
    if (!roundId || roundId === "all") {
      return {
        sessionCount: 0,
        avgAIScore: 0,
        avgWaiting: 0,
      };
    }

    const targetSessions = compareScopeSessions.filter(
      (session) => String(session.meta?.roundId || "") === String(roundId)
    );

    if (targetSessions.length === 0) {
      return {
        sessionCount: 0,
        avgAIScore: 0,
        avgWaiting: 0,
      };
    }

    return {
      sessionCount: targetSessions.length,
      avgAIScore: Math.round(
        targetSessions.reduce((sum, session) => sum + Number(session.aiScore?.total || 0), 0) /
          targetSessions.length
      ),
      avgWaiting: Math.round(
        targetSessions.reduce((sum, session) => sum + Number(session.waiting?.length || 0), 0) /
          targetSessions.length
      ),
    };
  };

  const compareRoundAMetrics = useMemo(
    () => getRoundMetric(selectedCompareRoundA),
    [selectedCompareRoundA, compareScopeSessions]
  );

  const compareRoundBMetrics = useMemo(
    () => getRoundMetric(selectedCompareRoundB),
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

  const compareWinner = useMemo(() => {
    if (
      compareRoundAMetrics.sessionCount === 0 ||
      compareRoundBMetrics.sessionCount === 0
    ) {
      return { winner: null, reason: "Chß╗ìn ─æß╗º dß╗» liß╗çu cho cß║ú 2 rounds ─æß╗â so s├ính." };
    }

    const scoreA = compareRoundAMetrics.avgAIScore - compareRoundAMetrics.avgWaiting * 5;
    const scoreB = compareRoundBMetrics.avgAIScore - compareRoundBMetrics.avgWaiting * 5;

    if (scoreA === scoreB) {
      return { winner: "tie", reason: "Hai rounds ─æang ngang nhau theo ti├¬u ch├¡ hiß╗çn tß║íi." };
    }

    return scoreA > scoreB
      ? {
          winner: "A",
          reason: `${compareRoundAName} tß╗æt h╞ín: AI cao h╞ín v├á/hoß║╖c ├¡t ng╞░ß╗¥i chß╗¥ h╞ín.`,
        }
      : {
          winner: "B",
          reason: `${compareRoundBName} tß╗æt h╞ín: AI cao h╞ín v├á/hoß║╖c ├¡t ng╞░ß╗¥i chß╗¥ h╞ín.`,
        };
  }, [compareRoundAMetrics, compareRoundBMetrics, compareRoundAName, compareRoundBName]);

  const getRoundGrade = (metrics) => {
    if (!metrics || metrics.sessionCount === 0) {
      return "N/A";
    }

    const weightedScore = metrics.avgAIScore - metrics.avgWaiting * 5;
    if (weightedScore >= 80) {
      return "A";
    }
    if (weightedScore >= 65) {
      return "B";
    }
    if (weightedScore >= 50) {
      return "C";
    }
    return "D";
  };

  const compareRoundAGrade = useMemo(
    () => getRoundGrade(compareRoundAMetrics),
    [compareRoundAMetrics]
  );

  const compareRoundBGrade = useMemo(
    () => getRoundGrade(compareRoundBMetrics),
    [compareRoundBMetrics]
  );

  const fairnessLevel = useMemo(() => {
    if (fairnessMetrics.fairnessScore >= 70) return "Tß╗æt";
    if (fairnessMetrics.fairnessScore >= 40) return "Trung b├¼nh";
    return "Cß║ºn cß║úi thiß╗çn";
  }, [fairnessMetrics.fairnessScore]);

  const escapeCsvCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const assertExportAllowed = () => {
    if (!can(PERMISSIONS.STATISTICS_EXPORT, { clubId: activeClubId })) {
      setStatusMessage({ type: "error", text: "Kh├┤ng c├│ quyß╗ün xuß║Ñt thß╗æng k├¬." });
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
      setStatusMessage({ type: "error", text: "Kh├┤ng c├│ dß╗» liß╗çu sau lß╗ìc ─æß╗â xuß║Ñt CSV." });
      return;
    }

    const headers = [
      "session_id",
      "date",
      "round",
      "shift",
      "courts",
      "waiting",
      "ai_score",
    ];

    const rows = filteredSessions.map((session) => ([
      session.id,
      session.date,
      session.meta?.roundName || "Round tß╗▒ do",
      session.meta?.shiftLabel || "",
      session.courts?.length || 0,
      session.waiting?.length || 0,
      session.aiScore?.total || 0,
    ]));

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pickleball-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setStatusMessage({ type: "success", text: "─É├ú xuß║Ñt CSV theo bß╗Ö lß╗ìc hiß╗çn tß║íi." });
  };

  const handleExportCompareCsv = () => {
    if (!assertExportAllowed()) {
      return;
    }

    if (
      compareRoundAMetrics.sessionCount === 0 &&
      compareRoundBMetrics.sessionCount === 0
    ) {
      setStatusMessage({ type: "error", text: "Kh├┤ng c├│ dß╗» liß╗çu so s├ính ─æß╗â xuß║Ñt CSV." });
      return;
    }

    const headers = [
      "round_label",
      "round_name",
      "session_count",
      "avg_ai_score",
      "avg_waiting",
      "grade",
      "waiting_alert",
    ];

    const rows = [
      [
        "A",
        compareRoundAName,
        compareRoundAMetrics.sessionCount,
        compareRoundAMetrics.avgAIScore,
        compareRoundAMetrics.avgWaiting,
        compareRoundAGrade,
        compareRoundAMetrics.avgWaiting > waitingAlertThreshold ? "YES" : "NO",
      ],
      [
        "B",
        compareRoundBName,
        compareRoundBMetrics.sessionCount,
        compareRoundBMetrics.avgAIScore,
        compareRoundBMetrics.avgWaiting,
        compareRoundBGrade,
        compareRoundBMetrics.avgWaiting > waitingAlertThreshold ? "YES" : "NO",
      ],
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pickleball-round-compare-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setStatusMessage({ type: "success", text: "─É├ú xuß║Ñt CSV phß║ºn so s├ính Round A/B." });
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
      setStatusMessage({ type: "warning", text: "Ch╞░a c├│ dß╗» liß╗çu BXH m├╣a giß║úi ─æß╗â xuß║Ñt." });
      return;
    }

    const csv = buildSeasonStandingsCsv(seasonStandingsRows, {
      seasonName: selectedStandingsSeason?.name || "",
      leagueName: selectedStandingsLeague?.name || "",
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bxh-mua-giai-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setStatusMessage({ type: "success", text: "─É├ú xuß║Ñt CSV BXH m├╣a giß║úi." });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        Thß╗æng k├¬
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {activeSeason?.name || "M├╣a hiß╗çn tß║íi"}
        {activeLeague ? ` ΓÇó ${activeLeague.name}` : ""}
      </Typography>

      {statusMessage && (
        <Alert severity={statusMessage.type} sx={{ mb: 2 }}>
          {statusMessage.text}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                BXH m├╣a giß║úi (Giß║úi ─æß║Ñu V3.3)
              </Typography>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ mb: 2, alignItems: { md: "center" } }}
              >
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>M├╣a giß║úi</InputLabel>
                  <Select
                    label="M├╣a giß║úi"
                    value={standingsSeasonId || ""}
                    onChange={(event) => handleStandingsSeasonChange(event.target.value)}
                  >
                    {seasons.map((season) => (
                      <MenuItem key={season.id} value={season.id}>
                        {season.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Giß║úi / League</InputLabel>
                  <Select
                    label="Giß║úi / League"
                    value={standingsLeagueId || ""}
                    onChange={(event) => setStandingsLeagueId(event.target.value)}
                  >
                    {leaguesForStandingsSeason.map((league) => (
                      <MenuItem key={league.id} value={league.id}>
                        {league.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
                  <Button variant="outlined" onClick={handleExportSeasonStandingsCsv}>
                    Xuß║Ñt CSV BXH
                  </Button>
                </PermissionGate>

                <SeasonExportActions
                  seasonId={standingsSeasonId || activeSeason?.id}
                  onMessage={setStatusMessage}
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

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Bß╗Ö lß╗ìc thß╗æng k├¬
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Round</InputLabel>
                  <Select
                    label="Round"
                    value={selectedRound}
                    onChange={(event) => setSelectedRound(event.target.value)}
                  >
                    <MenuItem value="all">Tß║Ñt cß║ú round</MenuItem>
                    {rounds.map((round) => (
                      <MenuItem key={round.id} value={String(round.id)}>
                        {round.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Ca ch╞íi</InputLabel>
                  <Select
                    label="Ca ch╞íi"
                    value={selectedShift}
                    onChange={(event) => setSelectedShift(event.target.value)}
                  >
                    <MenuItem value="all">Tß║Ñt cß║ú ca</MenuItem>
                    {shiftOptions.map((shift) => (
                      <MenuItem key={shift} value={shift}>
                        {shift}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Chip label={`Sessions sau lß╗ìc: ${filteredSessions.length}`} color="info" />
                <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
                  <Button variant="outlined" onClick={handleExportFilteredCsv}>
                    Xuß║Ñt CSV theo bß╗Ö lß╗ìc
                  </Button>
                </PermissionGate>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ≡ƒÅà Bß║úng thß║»ng/thua theo kß║┐t quß║ú v├▓ng
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
                <Chip label={`Phi├¬n ho├án tß║Ñt: ${completedResultSessions}`} color="success" />
                <Chip label={`Ng╞░ß╗¥i c├│ dß╗» liß╗çu kß║┐t quß║ú: ${matchOutcomeStats.length}`} color="info" />
              </Stack>

              {matchOutcomeStats.length === 0 ? (
                <Typography color="text.secondary">
                  Ch╞░a c├│ dß╗» liß╗çu kß║┐t quß║ú v├▓ng ho├án tß║Ñt ─æß╗â t├¡nh thß║»ng/thua.
                </Typography>
              ) : (
                matchOutcomeStats.slice(0, 16).map((item, index) => (
                  <Box key={item.id} sx={{ py: 0.8 }}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography fontWeight="bold">#{index + 1} {item.name}</Typography>
                      <Chip label={`${item.winRate}% thß║»ng`} color={item.winRate >= 60 ? "success" : item.winRate >= 40 ? "warning" : "default"} size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      W-L-D: {item.wins}-{item.losses}-{item.draws} ΓÇó Trß║¡n: {item.totalMatches} ΓÇó ─Éiß╗âm: {item.pointsFor}/{item.pointsAgainst} (diff {item.pointDiff >= 0 ? "+" : ""}{item.pointDiff})
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ≡ƒôî Dashboard vß║¡n h├ánh
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">Tß╗òng phi├¬n</Typography>
                  <Typography variant="h5" fontWeight="bold">{operationalMetrics.totalSessions}</Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">AI score TB</Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">{operationalMetrics.avgAIScore}</Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">Ng╞░ß╗¥i chß╗¥ TB</Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">{operationalMetrics.avgWaiting}</Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary">Tß╗òng l╞░ß╗út s├ón</Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">{operationalMetrics.totalCourtsUsed}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                ≡ƒôê Xu h╞░ß╗¢ng AI score theo thß╗¥i gian
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Dß╗▒a tr├¬n {trendPoints.length} phi├¬n gß║ºn nhß║Ñt sau lß╗ìc. Trß╗Ñc dß╗ìc l├á ─æiß╗âm AI tß╗½ 0 ─æß║┐n 100.
              </Typography>

              {trendPoints.length === 0 ? (
                <Typography color="text.secondary">Kh├┤ng c├│ phi├¬n n├áo ─æß╗â vß║╜ biß╗âu ─æß╗ô.</Typography>
              ) : (
                <>
                  <Box sx={{ width: "100%", overflowX: "auto", border: "1px solid", borderColor: "grey.300", borderRadius: 2, p: 1, mb: 1.5 }}>
                    <svg width="100%" viewBox="0 0 720 220" role="img" aria-label="AI score trend">
                      <line x1="24" y1="196" x2="696" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                      <line x1="24" y1="24" x2="24" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                      <line x1="24" y1="24" x2="696" y2="24" stroke="#eceff1" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="24" y1="110" x2="696" y2="110" stroke="#eceff1" strokeWidth="1" strokeDasharray="4 4" />

                      <path d={trendPath} fill="none" stroke="#1976d2" strokeWidth="2.5" />

                      {trendPoints.map((point, index) => {
                        const x = 24 + (trendPoints.length > 1 ? (672 / (trendPoints.length - 1)) * index : 336);
                        const y = 196 - (Math.max(0, Math.min(100, point.y)) / 100) * 172;

                        return (
                          <g key={`${point.label}-${index}`}>
                            <circle cx={x} cy={y} r="3" fill="#1565c0" />
                          </g>
                        );
                      })}

                      <text x="8" y="28" fontSize="10" fill="#607d8b">100</text>
                      <text x="10" y="114" fontSize="10" fill="#607d8b">50</text>
                      <text x="12" y="200" fontSize="10" fill="#607d8b">0</text>
                    </svg>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Chip
                      label={`Xu h╞░ß╗¢ng: ${trendSummary.delta > 0 ? "+" : ""}${trendSummary.delta}`}
                      color={trendSummary.delta >= 0 ? "success" : "error"}
                    />
                    <Chip label={`Best: ${trendSummary.best}`} color="primary" />
                    <Chip label={`Worst: ${trendSummary.worst}`} color="warning" />
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                ≡ƒæÑ Xu h╞░ß╗¢ng sß╗æ ng╞░ß╗¥i chß╗¥ theo thß╗¥i gian
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Dß╗▒a tr├¬n {waitingTrendPoints.length} phi├¬n gß║ºn nhß║Ñt sau lß╗ìc.
              </Typography>

              {waitingTrendPoints.length === 0 ? (
                <Typography color="text.secondary">Kh├┤ng c├│ phi├¬n n├áo ─æß╗â vß║╜ biß╗âu ─æß╗ô ng╞░ß╗¥i chß╗¥.</Typography>
              ) : (
                <Box sx={{ width: "100%", overflowX: "auto", border: "1px solid", borderColor: "grey.300", borderRadius: 2, p: 1, mb: 1.5 }}>
                  <svg width="100%" viewBox="0 0 720 220" role="img" aria-label="Waiting trend">
                    <line x1="24" y1="196" x2="696" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                    <line x1="24" y1="24" x2="24" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                    <path d={waitingTrendPath} fill="none" stroke="#ef6c00" strokeWidth="2.5" />

                    {waitingTrendPoints.map((point, index) => {
                      const x = 24 + (waitingTrendPoints.length > 1 ? (672 / (waitingTrendPoints.length - 1)) * index : 336);
                      const y = 196 - (Math.max(0, Math.min(waitingTrendMaxY, point.y)) / waitingTrendMaxY) * 172;

                      return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3" fill="#e65100" />;
                    })}

                    <text x="8" y="28" fontSize="10" fill="#607d8b">{waitingTrendMaxY}</text>
                    <text x="12" y="200" fontSize="10" fill="#607d8b">0</text>
                  </svg>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ΓÜû∩╕Å So s├ính 2 round
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Round A</InputLabel>
                  <Select
                    label="Round A"
                    value={selectedCompareRoundA}
                    onChange={(event) => setSelectedCompareRoundA(event.target.value)}
                  >
                    <MenuItem value="all">Chß╗ìn Round A</MenuItem>
                    {rounds.map((round) => (
                      <MenuItem key={`A-${round.id}`} value={String(round.id)}>
                        {round.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Round B</InputLabel>
                  <Select
                    label="Round B"
                    value={selectedCompareRoundB}
                    onChange={(event) => setSelectedCompareRoundB(event.target.value)}
                  >
                    <MenuItem value="all">Chß╗ìn Round B</MenuItem>
                    {rounds.map((round) => (
                      <MenuItem key={`B-${round.id}`} value={String(round.id)}>
                        {round.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  type="number"
                  label="Ng╞░ß╗íng cß║únh b├ío chß╗¥"
                  value={waitingAlertThreshold}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (Number.isNaN(nextValue)) {
                      return;
                    }
                    setWaitingAlertThreshold(Math.max(0, nextValue));
                  }}
                  sx={{ width: 200 }}
                />

                <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
                  <Button variant="outlined" onClick={handleExportCompareCsv}>
                    Xuß║Ñt CSV so s├ính
                  </Button>
                </PermissionGate>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
                {compareWinner.winner === "A" && <Chip color="success" label={`Round tß╗æt h╞ín: ${compareRoundAName}`} />}
                {compareWinner.winner === "B" && <Chip color="success" label={`Round tß╗æt h╞ín: ${compareRoundBName}`} />}
                {compareWinner.winner === "tie" && <Chip color="info" label="Kß║┐t quß║ú: h├▓a" />}
                {compareWinner.winner === null && <Chip color="default" label="Cß║ºn th├¬m dß╗» liß╗çu" />}
                <Chip color="default" label={compareWinner.reason} />
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography fontWeight="bold">{compareRoundAName}</Typography>
                      <Typography variant="body2" color="text.secondary">Sessions: {compareRoundAMetrics.sessionCount}</Typography>
                      <Typography variant="body2" color="text.secondary">AI TB: {compareRoundAMetrics.avgAIScore}</Typography>
                      <Typography variant="body2" color="text.secondary">Chß╗¥ TB: {compareRoundAMetrics.avgWaiting}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Chip label={`Grade: ${compareRoundAGrade}`} color={compareRoundAGrade === "A" || compareRoundAGrade === "B" ? "success" : compareRoundAGrade === "C" ? "warning" : "error"} size="small" />
                        {compareRoundAMetrics.avgWaiting > waitingAlertThreshold && (
                          <Chip label="Cß║únh b├ío chß╗¥ cao" color="error" size="small" />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography fontWeight="bold">{compareRoundBName}</Typography>
                      <Typography variant="body2" color="text.secondary">Sessions: {compareRoundBMetrics.sessionCount}</Typography>
                      <Typography variant="body2" color="text.secondary">AI TB: {compareRoundBMetrics.avgAIScore}</Typography>
                      <Typography variant="body2" color="text.secondary">Chß╗¥ TB: {compareRoundBMetrics.avgWaiting}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Chip label={`Grade: ${compareRoundBGrade}`} color={compareRoundBGrade === "A" || compareRoundBGrade === "B" ? "success" : compareRoundBGrade === "C" ? "warning" : "error"} size="small" />
                        {compareRoundBMetrics.avgWaiting > waitingAlertThreshold && (
                          <Chip label="Cß║únh b├ío chß╗¥ cao" color="error" size="small" />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                ≡ƒºá Fairness Score
              </Typography>
              <Typography variant="h3" color={fairnessMetrics.fairnessScore >= 70 ? "success.main" : fairnessMetrics.fairnessScore >= 40 ? "warning.main" : "error.main"} fontWeight="bold">
                {fairnessMetrics.fairnessScore}/100
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                {fairnessLevel} ΓÇö phß║ún ├ính mß╗⌐c ─æß╗Ö c├ón bß║▒ng v├á ─æa dß║íng lß╗ïch sß╗¡ gh├⌐p trß║¡n.
              </Typography>

              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={fairnessMetrics.fairnessScore}
                  sx={{ height: 12, borderRadius: 2, bgcolor: "grey.200", "& .MuiLinearProgress-bar": { borderRadius: 2 } }}
                />
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Chip label={`C├ón bß║▒ng ${fairnessMetrics.balanceScore}`} color="primary" size="small" />
                <Chip label={`─Éß╗ông ─æß╗Öi ${fairnessMetrics.partnerScore}`} color="success" size="small" />
                <Chip label={`─Éß╗æi thß╗º ${fairnessMetrics.opponentScore}`} color="warning" size="small" />
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary">Tß╗òng trß║¡n</Typography>
                  <Typography fontWeight="bold">{fairnessMetrics.totalGames}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary">─É├ú lß║╖p ─æß╗ông ─æß╗Öi</Typography>
                  <Typography fontWeight="bold">{fairnessMetrics.repeatedPartnerCount}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary">─É├ú lß║╖p ─æß╗æi thß╗º</Typography>
                  <Typography fontWeight="bold">{fairnessMetrics.repeatedOpponentCount}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ≡ƒÅô Thß╗æng k├¬ ng╞░ß╗¥i ch╞íi
              </Typography>
              {playerStats.length === 0 ? (
                <Typography color="text.secondary">Ch╞░a c├│ dß╗» liß╗çu lß╗ïch sß╗¡.</Typography>
              ) : (
                playerStats.map((player) => {
                  const topPartner = [...player.partners].sort((a, b) => b[1] - a[1])[0];
                  const topOpponent = [...player.opponents].sort((a, b) => b[1] - a[1])[0];

                  return (
                    <Box key={player.id} sx={{ py: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                        <Typography fontWeight="bold">{player.name}</Typography>
                        <Chip label={`${player.games} trß║¡n`} color="primary" size="small" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        ─Éß╗ông ─æß╗Öi nhiß╗üu nhß║Ñt: {topPartner ? `${playerNameById[topPartner[0]] || topPartner[0]} (${topPartner[1]})` : "-"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ─Éß╗æi thß╗º nhiß╗üu nhß║Ñt: {topOpponent ? `${playerNameById[topOpponent[0]] || topOpponent[0]} (${topOpponent[1]})` : "-"}
                      </Typography>
                      <Divider sx={{ mt: 1 }} />
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ≡ƒùé∩╕Å Phi├¬n gß║ºn nhß║Ñt
              </Typography>

              {recentSessions.length === 0 ? (
                <Typography color="text.secondary">Ch╞░a c├│ session n├áo.</Typography>
              ) : (
                recentSessions.map((session) => (
                  <Box key={session.id} sx={{ py: 0.8 }}>
                    <Typography fontWeight="bold">
                      {new Date(session.date).toLocaleString("vi-VN")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {session.meta?.roundName || "Round tß╗▒ do"} {session.meta?.shiftLabel ? `ΓÇó ${session.meta.shiftLabel}` : ""}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      S├ón: {session.courts?.length || 0} ΓÇó Chß╗¥: {session.waiting?.length || 0} ΓÇó AI: {session.aiScore?.total || 0}
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                ≡ƒöü Top ─æß╗ông ─æß╗Öi & ─æß╗æi thß╗º
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography fontWeight="bold" sx={{ mb: 1 }}>
                    ─Éß╗ông ─æß╗Öi th╞░ß╗¥ng gß║╖p
                  </Typography>
                  {topPartners.length === 0 ? (
                    <Typography color="text.secondary">Ch╞░a c├│ dß╗» liß╗çu ─æß╗ông ─æß╗Öi.</Typography>
                  ) : (
                    topPartners.map((item) => (
                      <Box key={`${item.playerName}-${item.partnerId}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}>
                        <Typography>{item.playerName} ΓåÆ {item.partnerName}</Typography>
                        <Typography color="primary.main" fontWeight="bold">{item.count}</Typography>
                      </Box>
                    ))
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography fontWeight="bold" sx={{ mb: 1 }}>
                    ─Éß╗æi thß╗º th╞░ß╗¥ng gß║╖p
                  </Typography>
                  {topOpponents.length === 0 ? (
                    <Typography color="text.secondary">Ch╞░a c├│ dß╗» liß╗çu ─æß╗æi thß╗º.</Typography>
                  ) : (
                    topOpponents.map((item) => (
                      <Box key={`${item.playerName}-${item.opponentId}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}>
                        <Typography>{item.playerName} vs {item.opponentName}</Typography>
                        <Typography color="error.main" fontWeight="bold">{item.count}</Typography>
                      </Box>
                    ))
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
