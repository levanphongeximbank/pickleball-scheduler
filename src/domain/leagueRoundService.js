import { loadClubData, saveClubData } from "./clubStorage.js";

function findTournament(data, tournamentId) {
  return (data.tournaments || []).find((item) => String(item.id) === String(tournamentId)) || null;
}

function createRoundId() {
  return `round-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRound(round, clubId) {
  return {
    id: String(round?.id || createRoundId()),
    clubId,
    seasonId: round?.seasonId ? String(round.seasonId) : "",
    leagueId: round?.leagueId ? String(round.leagueId) : "",
    name: String(round?.name || "Vong moi").trim(),
    defaultShift: round?.defaultShift || null,
    groupLabel: round?.groupLabel || null,
    tournamentIds: Array.isArray(round?.tournamentIds)
      ? round.tournamentIds.map(String)
      : [],
    status: round?.status || "active",
    createdAt: round?.createdAt || new Date().toISOString(),
  };
}

export function listLeagueRounds(clubId, { seasonId = null, leagueId = null } = {}) {
  const data = loadClubData(clubId);
  return (data.rounds || [])
    .map((round) => normalizeRound(round, clubId))
    .filter((round) => {
      if (seasonId && round.seasonId && round.seasonId !== seasonId) {
        return false;
      }
      if (leagueId && round.leagueId && round.leagueId !== leagueId) {
        return false;
      }
      return true;
    });
}

export function createLeagueRound(clubId, { seasonId, leagueId, name, options = {} }) {
  const data = loadClubData(clubId);
  const round = normalizeRound(
    {
      id: options.id || createRoundId(),
      seasonId,
      leagueId,
      name,
      defaultShift: options.defaultShift || null,
      groupLabel: options.groupLabel || null,
      tournamentIds: options.tournamentIds || [],
      status: options.status || "active",
    },
    clubId
  );

  data.rounds = [round, ...(data.rounds || [])];
  data.active.roundSlot = round.id;
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, round };
}

export function linkTournamentToRound(clubId, tournamentId, roundId) {
  const data = loadClubData(clubId);
  const tournament = findTournament(data, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  const roundIndex = (data.rounds || []).findIndex(
    (item) => String(item.id) === String(roundId)
  );
  if (roundIndex < 0) {
    return { ok: false, error: "Khong tim thay vong giai." };
  }

  data.rounds = (data.rounds || []).map((item) => {
    const normalized = normalizeRound(item, clubId);
    if (String(normalized.id) === String(roundId)) {
      return normalized;
    }

    normalized.tournamentIds = (normalized.tournamentIds || []).filter(
      (id) => String(id) !== String(tournamentId)
    );
    return normalized;
  });

  const round = normalizeRound(data.rounds[roundIndex], clubId);
  const tournamentIds = new Set(round.tournamentIds || []);
  tournamentIds.add(String(tournamentId));
  round.tournamentIds = [...tournamentIds];

  data.rounds[roundIndex] = round;
  data.active.roundSlot = round.id;

  const tournamentIndex = (data.tournaments || []).findIndex(
    (item) => String(item.id) === String(tournamentId)
  );
  if (tournamentIndex >= 0) {
    data.tournaments[tournamentIndex] = {
      ...data.tournaments[tournamentIndex],
      roundId: round.id,
      seasonId: round.seasonId || data.tournaments[tournamentIndex].seasonId,
      leagueId: round.leagueId || data.tournaments[tournamentIndex].leagueId,
      updatedAt: new Date().toISOString(),
    };
  }

  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return {
    ok: true,
    round,
    tournament:
      tournamentIndex >= 0 ? data.tournaments[tournamentIndex] : tournament,
  };
}

export function updateLeagueRound(clubId, roundId, patch = {}) {
  const data = loadClubData(clubId);
  const roundIndex = (data.rounds || []).findIndex(
    (item) => String(item.id) === String(roundId)
  );

  if (roundIndex < 0) {
    return { ok: false, error: "Khong tim thay vong giai." };
  }

  data.rounds[roundIndex] = normalizeRound(
    {
      ...data.rounds[roundIndex],
      ...patch,
      id: roundId,
    },
    clubId
  );
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, round: data.rounds[roundIndex] };
}

export function setActiveLeagueRound(clubId, roundId) {
  const data = loadClubData(clubId);
  const round = (data.rounds || []).find((item) => String(item.id) === String(roundId));

  if (!round) {
    return { ok: false, error: "Khong tim thay vong giai." };
  }

  data.active.roundSlot = roundId;
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, round: normalizeRound(round, clubId) };
}

export function unlinkTournamentFromRound(clubId, tournamentId) {
  const data = loadClubData(clubId);
  const tournament = findTournament(data, tournamentId);

  if (!tournament) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  if (tournament.roundId) {
    const roundIndex = (data.rounds || []).findIndex(
      (item) => String(item.id) === String(tournament.roundId)
    );
    if (roundIndex >= 0) {
      const round = normalizeRound(data.rounds[roundIndex], clubId);
      round.tournamentIds = (round.tournamentIds || []).filter(
        (id) => String(id) !== String(tournamentId)
      );
      data.rounds[roundIndex] = round;
    }
  }

  const tournamentIndex = (data.tournaments || []).findIndex(
    (item) => String(item.id) === String(tournamentId)
  );
  if (tournamentIndex >= 0) {
    data.tournaments[tournamentIndex] = {
      ...data.tournaments[tournamentIndex],
      roundId: "",
      updatedAt: new Date().toISOString(),
    };
  }

  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true };
}

export function listLeagueTournaments(clubId, { seasonId = null, leagueId = null } = {}) {
  const data = loadClubData(clubId);
  return (data.tournaments || []).filter((tournament) => {
    if (seasonId && tournament.seasonId && tournament.seasonId !== seasonId) {
      return false;
    }
    if (leagueId && tournament.leagueId && tournament.leagueId !== leagueId) {
      return false;
    }
    return true;
  });
}

export function ensureTournamentLeagueRound(clubId, tournament) {
  if (!tournament?.id || !tournament?.leagueId) {
    return { ok: true, skipped: true };
  }

  if (tournament.roundId) {
    return linkTournamentToRound(clubId, tournament.id, tournament.roundId);
  }

  const data = loadClubData(clubId);
  const leagueRounds = listLeagueRounds(clubId, {
    seasonId: tournament.seasonId,
    leagueId: tournament.leagueId,
  });
  const activeRound = leagueRounds.find(
    (round) => String(round.id) === String(data.active?.roundSlot)
  );

  if (activeRound) {
    return linkTournamentToRound(clubId, tournament.id, activeRound.id);
  }

  const nextIndex = leagueRounds.length + 1;
  const created = createLeagueRound(clubId, {
    seasonId: tournament.seasonId,
    leagueId: tournament.leagueId,
    name: `Vong ${nextIndex}`,
  });

  if (!created.ok) {
    return created;
  }

  return linkTournamentToRound(clubId, tournament.id, created.round.id);
}

export function getTournamentsForRound(clubId, roundId) {
  const data = loadClubData(clubId);
  const round = (data.rounds || []).find((item) => String(item.id) === String(roundId));
  if (!round) {
    return [];
  }

  const ids = new Set((round.tournamentIds || []).map(String));
  return (data.tournaments || []).filter((item) => ids.has(String(item.id)));
}
