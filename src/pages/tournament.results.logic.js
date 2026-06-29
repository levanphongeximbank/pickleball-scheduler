function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildWinner(teamAScore, teamBScore) {
  if (teamAScore > teamBScore) {
    return "A";
  }

  if (teamBScore > teamAScore) {
    return "B";
  }

  return "draw";
}

export function buildSessionResultDraft(session) {
  const existing = session?.result || null;
  const sessionCourts = Array.isArray(session?.courts) ? session.courts : [];

  const existingByCourt = new Map(
    (existing?.courts || []).map((courtResult) => [String(courtResult.courtId), courtResult])
  );

  const courts = sessionCourts.map((court, index) => {
    const courtId = court?.court ?? `court-${index}`;
    const previous = existingByCourt.get(String(courtId));

    const teamAScore = toFiniteNumber(previous?.teamAScore, 0);
    const teamBScore = toFiniteNumber(previous?.teamBScore, 0);

    return {
      courtId,
      courtName: court?.courtName || court?.name || `Sân ${index + 1}`,
      teamAScore,
      teamBScore,
      winner: buildWinner(teamAScore, teamBScore),
    };
  });

  return {
    status: existing?.status || "pending",
    note: existing?.note || "",
    locked: existing?.locked === true,
    courts,
  };
}

export function updateCourtScore(draft, courtId, team, rawValue) {
  const safeValue = Math.max(0, toFiniteNumber(rawValue, 0));

  const nextCourts = (draft?.courts || []).map((courtResult) => {
    if (String(courtResult.courtId) !== String(courtId)) {
      return courtResult;
    }

    const teamAScore = team === "A" ? safeValue : toFiniteNumber(courtResult.teamAScore, 0);
    const teamBScore = team === "B" ? safeValue : toFiniteNumber(courtResult.teamBScore, 0);

    return {
      ...courtResult,
      teamAScore,
      teamBScore,
      winner: buildWinner(teamAScore, teamBScore),
    };
  });

  return {
    ...draft,
    courts: nextCourts,
  };
}

export function summarizeSessionResult(draft) {
  const courts = draft?.courts || [];

  const totals = courts.reduce(
    (acc, item) => ({
      teamATotal: acc.teamATotal + toFiniteNumber(item.teamAScore, 0),
      teamBTotal: acc.teamBTotal + toFiniteNumber(item.teamBScore, 0),
    }),
    { teamATotal: 0, teamBTotal: 0 }
  );

  return {
    teamATotal: totals.teamATotal,
    teamBTotal: totals.teamBTotal,
    winner: buildWinner(totals.teamATotal, totals.teamBTotal),
  };
}

export function buildSessionResultPayload(draft) {
  const normalizedCourts = (draft?.courts || []).map((courtResult) => ({
    courtId: courtResult.courtId,
    courtName: courtResult.courtName,
    teamAScore: Math.max(0, toFiniteNumber(courtResult.teamAScore, 0)),
    teamBScore: Math.max(0, toFiniteNumber(courtResult.teamBScore, 0)),
    winner: buildWinner(
      Math.max(0, toFiniteNumber(courtResult.teamAScore, 0)),
      Math.max(0, toFiniteNumber(courtResult.teamBScore, 0))
    ),
  }));

  return {
    status: draft?.status === "completed" ? "completed" : "pending",
    note: String(draft?.note || ""),
    locked: draft?.locked === true,
    courts: normalizedCourts,
    updatedAt: new Date().toISOString(),
    summary: summarizeSessionResult({ courts: normalizedCourts }),
  };
}
