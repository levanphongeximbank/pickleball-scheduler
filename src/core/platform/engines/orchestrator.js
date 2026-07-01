import {
  createTournamentEngine,
  createCourtEngine,
  createLeagueEngine,
  createRankingEngine,
  createBillingEngine,
  createAiEngine,
} from "./index.js";

export function runPlatformEngineWorkflow(input = {}) {
  const tournamentEngine = createTournamentEngine();
  const courtEngine = createCourtEngine();
  const leagueEngine = createLeagueEngine();
  const rankingEngine = createRankingEngine();
  const billingEngine = createBillingEngine();
  const aiEngine = createAiEngine();

  const players = Array.isArray(input.players) ? input.players : [];
  const courts = Array.isArray(input.courts) ? input.courts : [];
  const matches = Array.isArray(input.matches) ? input.matches : [];

  const plan = tournamentEngine.createPlan({
    id: input.tournament?.id,
    name: input.tournament?.name,
    mode: input.tournament?.mode,
    tournament: input.tournament,
    players,
  });

  const schedule = courtEngine.createSchedule({
    courtId: input.courtId || courts[0]?.id,
    slots: courts.map((court, index) => ({
      courtId: court.id || `court-${index + 1}`,
      label: court.name || `Sân ${index + 1}`,
    })),
  });

  const standing = leagueEngine.createStanding({
    leagueId: input.tournament?.leagueId || input.session?.leagueId || "league-1",
    entries: players.slice(0, 6).map((player, index) => ({
      id: player.id || `player-${index + 1}`,
      name: player.name || `Player ${index + 1}`,
    })),
  });

  const ranking = rankingEngine.calculate({
    entries: players.slice(0, 6).map((player, index) => ({
      id: player.id || `player-${index + 1}`,
      name: player.name || `Player ${index + 1}`,
    })),
  });

  const invoice = billingEngine.buildInvoice({
    tenantId: input.tournament?.clubId || input.session?.clubId || "tenant-1",
    amount: Math.max(players.length * 100, matches.length * 50),
  });

  const recommendation = aiEngine.suggest({
    recommendation: `Focus on ${players[0]?.name || "the next match"} for the current workflow`,
    confidence: 0.74,
    reason: `Players: ${players.length}; Courts: ${courts.length}; Matches: ${matches.length}`,
  });

  return {
    ok: true,
    data: {
      plan,
      schedule,
      standing,
      ranking,
      invoice,
      recommendation,
    },
  };
}
