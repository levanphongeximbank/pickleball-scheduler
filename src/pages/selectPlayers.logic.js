export function buildSelectionMetrics({
  selectedPlayersCount,
  selectedCourtCount,
  activeCourtsCount,
  playersPerCourt = 4,
  minPlayers = 4,
}) {
  const maxPlayers = activeCourtsCount * playersPerCourt;
  const requiredCourts =
    selectedPlayersCount > 0 ? Math.ceil(selectedPlayersCount / playersPerCourt) : 0;
  const waitingPotential = Math.max(0, selectedPlayersCount - maxPlayers);

  const hasEnoughSelectedCourts =
    selectedPlayersCount === 0 ||
    (selectedPlayersCount > maxPlayers
      ? selectedCourtCount === activeCourtsCount
      : selectedCourtCount >= requiredCourts);

  const canStart =
    selectedPlayersCount >= minPlayers &&
    selectedCourtCount > 0 &&
    (selectedPlayersCount > maxPlayers || selectedCourtCount >= requiredCourts);

  const selectEnoughCourtsLabel =
    selectedPlayersCount > maxPlayers
      ? `Chọn tất cả ${activeCourtsCount} sân hoạt động`
      : `Chọn đủ ${requiredCourts} sân`;

  return {
    maxPlayers,
    requiredCourts,
    waitingPotential,
    hasEnoughSelectedCourts,
    canStart,
    selectEnoughCourtsLabel,
  };
}

export function buildStartValidationErrors({
  selectedPlayersCount,
  selectedActiveCourtsCount,
  selectedCourtCount,
  requiredCourts,
  maxPlayers,
  minPlayers = 4,
}) {
  const errors = [];

  if (selectedPlayersCount < minPlayers) {
    errors.push(`Cần chọn ít nhất ${minPlayers} người để xếp sân.`);
  }

  if (selectedActiveCourtsCount === 0) {
    errors.push("Vui lòng chọn ít nhất 1 sân.");
  }

  if (selectedPlayersCount <= maxPlayers && selectedCourtCount < requiredCourts) {
    errors.push(
      `Cần chọn ít nhất ${requiredCourts} sân để xếp ${selectedPlayersCount} người mà không chờ.`
    );
  }

  return errors;
}

export function recomputeCourt(court) {
  const teamATotal = (court.teamA || []).reduce(
    (sum, player) => sum + Number(player.level || 0),
    0
  );
  const teamBTotal = (court.teamB || []).reduce(
    (sum, player) => sum + Number(player.level || 0),
    0
  );
  const diff = Math.abs(teamATotal - teamBTotal);

  return {
    ...court,
    teamATotal,
    teamBTotal,
    diff,
  };
}

export function swapTeamsInResult(result, courtId) {
  if (!result) {
    return result;
  }

  const nextCourts = result.courts.map((court) => {
    if (court.court !== courtId) {
      return court;
    }

    return recomputeCourt({
      ...court,
      teamA: [...court.teamB],
      teamB: [...court.teamA],
    });
  });

  return {
    ...result,
    courts: nextCourts,
  };
}

export function movePlayerInResult(result, courtId, fromTeam, playerId) {
  if (!result) {
    return result;
  }

  const nextCourts = result.courts.map((court) => {
    if (court.court !== courtId) {
      return court;
    }

    const sourceTeam = fromTeam === "A" ? [...court.teamA] : [...court.teamB];
    const targetTeam = fromTeam === "A" ? [...court.teamB] : [...court.teamA];
    const movingIndex = sourceTeam.findIndex((player) => player.id === playerId);

    const teamCapacity = Math.max(court.teamA?.length || 0, court.teamB?.length || 0, 1);

    if (movingIndex < 0 || targetTeam.length >= teamCapacity) {
      return court;
    }

    const [movingPlayer] = sourceTeam.splice(movingIndex, 1);
    targetTeam.push(movingPlayer);

    return recomputeCourt({
      ...court,
      teamA: fromTeam === "A" ? sourceTeam : targetTeam,
      teamB: fromTeam === "A" ? targetTeam : sourceTeam,
    });
  });

  return {
    ...result,
    courts: nextCourts,
  };
}

export function applyAlternativeCandidate(result, alternativeIndex) {
  if (!result || !Array.isArray(result.alternatives)) {
    return result;
  }

  const selected = result.alternatives.find(
    (alternative) => alternative.index === alternativeIndex
  );

  if (!selected) {
    return result;
  }

  return {
    ...result,
    courts: selected.courts,
    bestCandidateScore: selected.totalScore,
    selectedAlternativeIndex: selected.index,
    explanation: (selected.courts || []).map((court) => ({
      court: court.court,
      explanation: court.explanation,
    })),
  };
}
