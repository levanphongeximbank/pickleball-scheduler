export function buildHistoryFromSessions(sessions = []) {
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

export function buildMatchOutcomeStats(sessions = [], playerNameById = {}) {
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

export function getTrendPoints(
  sessions = [],
  selector = (session) => Number(session.aiScore?.total || 0),
  limit = 20
) {
  return [...sessions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-limit)
    .map((session, index) => ({
      x: index,
      y: Number(selector(session) || 0),
      label: new Date(session.date).toLocaleString("vi-VN"),
    }));
}

export function buildTrendPath(points, width, height, padding, minY = 0, maxY = 100) {
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

export function getRoundMetric(roundId, compareScopeSessions) {
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
}

export function getRoundGrade(metrics) {
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
}

export function buildFairnessMetrics(playerStats) {
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
  const variance =
    playerStats.reduce((sum, player) => {
      const diff = (player.games || 0) - avgGames;
      return sum + diff * diff;
    }, 0) / playerStats.length;
  const stdDev = Math.sqrt(variance);

  const balanceScore =
    avgGames > 0 ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / avgGames) * 40))) : 100;

  const repeatedPartnerCount =
    playerStats.reduce((sum, player) => {
      const partnerRepeats = player.partners.reduce(
        (count, [, gamesTogether]) => count + Math.max(0, gamesTogether - 1),
        0
      );
      return sum + partnerRepeats;
    }, 0) / 2;

  const repeatedOpponentCount =
    playerStats.reduce((sum, player) => {
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
}

export function buildOperationalMetrics(filteredSessions) {
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
    filteredSessions.reduce((sum, session) => sum + Number(session.aiScore?.total || 0), 0) /
      totalSessions
  );
  const avgWaiting = Math.round(
    filteredSessions.reduce((sum, session) => sum + Number(session.waiting?.length || 0), 0) /
      totalSessions
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
}

export function buildCompareWinner(
  compareRoundAMetrics,
  compareRoundBMetrics,
  compareRoundAName,
  compareRoundBName
) {
  if (compareRoundAMetrics.sessionCount === 0 || compareRoundBMetrics.sessionCount === 0) {
    return { winner: null, reason: "Chọn đủ dữ liệu cho cả 2 rounds để so sánh." };
  }

  const scoreA = compareRoundAMetrics.avgAIScore - compareRoundAMetrics.avgWaiting * 5;
  const scoreB = compareRoundBMetrics.avgAIScore - compareRoundBMetrics.avgWaiting * 5;

  if (scoreA === scoreB) {
    return { winner: "tie", reason: "Hai rounds đang ngang nhau theo tiêu chí hiện tại." };
  }

  return scoreA > scoreB
    ? {
        winner: "A",
        reason: `${compareRoundAName} tốt hơn: AI cao hơn và/hoặc ít người chờ hơn.`,
      }
    : {
        winner: "B",
        reason: `${compareRoundBName} tốt hơn: AI cao hơn và/hoặc ít người chờ hơn.`,
      };
}
