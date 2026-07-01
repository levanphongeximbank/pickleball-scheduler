export function createTournamentEngine() {
  return {
    name: "tournament",
    createPlan(input = {}) {
      const players = Array.isArray(input.players) ? input.players : [];
      const selectedTournament = input.tournament || {};
      return {
        id: input.id || selectedTournament.id || `tournament-plan-${Date.now()}`,
        mode: input.mode || selectedTournament.mode || "internal",
        name: input.name || selectedTournament.name || "Tournament plan",
        summary: {
          participantCount: players.length,
          participantNames: players.slice(0, 6).map((player) => player.name || player.id),
        },
      };
    },
  };
}

export function createCourtEngine() {
  return {
    name: "court",
    createSchedule(input = {}) {
      const slots = Array.isArray(input.slots) ? input.slots : [];
      return {
        id: input.id || `court-schedule-${Date.now()}`,
        courtId: input.courtId || "court-1",
        slots,
        summary: {
          slotCount: slots.length,
          activeCourts: slots.filter((slot) => slot?.courtId).length,
        },
      };
    },
  };
}

export function createLeagueEngine() {
  return {
    name: "league",
    createStanding(input = {}) {
      const entries = Array.isArray(input.entries) ? input.entries : [];
      return {
        id: input.id || `league-standing-${Date.now()}`,
        leagueId: input.leagueId || "league-1",
        entries,
        summary: {
          entryCount: entries.length,
          topEntry: entries[0]?.name || null,
        },
      };
    },
  };
}

export function createRankingEngine() {
  return {
    name: "ranking",
    calculate(input = {}) {
      const entries = Array.isArray(input.entries) ? input.entries : [];
      return {
        entries: entries.map((entry, index) => ({
          ...entry,
          rank: index + 1,
          score: 100 - index,
        })),
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

export function createBillingEngine() {
  return {
    name: "billing",
    buildInvoice(input = {}) {
      const amount = Number(input.amount || 0);
      return {
        id: input.id || `invoice-${Date.now()}`,
        tenantId: input.tenantId || "tenant-1",
        amount,
        currency: input.currency || "VND",
        status: amount > 0 ? "draft" : "empty",
      };
    },
  };
}

export function createAiEngine() {
  return {
    name: "ai",
    suggest(input = {}) {
      return {
        recommendation: input.recommendation || "No recommendation",
        confidence: input.confidence || 0.5,
        reason: input.reason || "Generated from current platform context",
      };
    },
  };
}

export function buildPlatformEngineSummary({ tournament = {}, session = {}, players = [], courts = [] } = {}) {
  const tournamentEngine = createTournamentEngine();
  const courtEngine = createCourtEngine();
  const leagueEngine = createLeagueEngine();
  const rankingEngine = createRankingEngine();
  const billingEngine = createBillingEngine();
  const aiEngine = createAiEngine();

  return {
    tournament: {
      plan: tournamentEngine.createPlan({
        id: tournament.id,
        name: tournament.name || "Tournament plan",
        mode: tournament.mode || "internal",
      }),
    },
    court: {
      schedule: courtEngine.createSchedule({
        courtId: courts[0]?.id || "court-1",
        slots: courts.map((court, index) => ({
          courtId: court.id || `court-${index + 1}`,
          label: court.name || `Sân ${index + 1}`,
        })),
      }),
    },
    league: {
      standing: leagueEngine.createStanding({
        leagueId: tournament.leagueId || session.leagueId || "league-1",
        entries: players.slice(0, 6).map((player, index) => ({
          id: player.id || `player-${index + 1}`,
          name: player.name || `Player ${index + 1}`,
        })),
      }),
    },
    ranking: {
      result: rankingEngine.calculate({
        entries: players.slice(0, 6).map((player, index) => ({
          id: player.id || `player-${index + 1}`,
          name: player.name || `Player ${index + 1}`,
        })),
      }),
    },
    billing: {
      invoice: billingEngine.buildInvoice({
        tenantId: tournament.clubId || session.clubId || "tenant-1",
        amount: Math.max(players.length * 100, 0),
      }),
    },
    ai: {
      recommendation: aiEngine.suggest({
        recommendation: `Prioritize ${players[0]?.name || "the next match"} for the current session`,
        confidence: 0.72,
      }),
    },
  };
}
