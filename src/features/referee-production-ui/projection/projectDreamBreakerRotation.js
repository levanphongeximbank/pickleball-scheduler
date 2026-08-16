/**
 * DreamBreaker rotation projection — Team domain remains rotation authority.
 * Referee UI only reads.
 */

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return null;
}

function playerName(id, names) {
  if (!id) return null;
  const mapped = names && names[id];
  if (mapped && typeof mapped === "object") {
    return String(mapped.displayName || mapped.name || id);
  }
  if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
  return String(id);
}

/**
 * @param {{
 *   matchContext?: object|null,
 *   modeState?: object|null,
 *   participants?: object|null,
 *   participantNames?: Record<string, string|object>,
 * }} input
 */
export function projectDreamBreakerRotation(input = {}) {
  const matchContext = input.matchContext || {};
  // Fail closed: only genuine DreamBreaker match context may open the panel.
  // Leftover modeState.dreambreaker blobs must not invent DreamBreaker UI.
  const isDreambreaker = matchContext.isDreambreaker === true;

  if (!isDreambreaker) {
    return Object.freeze({
      isDreambreaker: false,
      hasActiveRotation: false,
      rotationOwnedByTeamDomain: true,
      sideAActivePlayer: null,
      sideBActivePlayer: null,
      nextPlayerA: null,
      nextPlayerB: null,
      rotationProgress: null,
      currentRotation: null,
    });
  }

  const db =
    matchContext.dreambreakerProjection ||
    input.modeState?.dreambreaker ||
    input.modeState?.matchups?.[matchContext.matchupId || matchContext.matchId]
      ?.dreambreaker ||
    null;

  const rotation = db?.rotation || db?.currentRotation || {};
  const names = input.participantNames || {};
  const sides = Array.isArray(input.participants?.sides)
    ? input.participants.sides
    : [];

  const sideAId = firstString(
    rotation.sideAPlayerId,
    rotation.teamA?.activePlayerId,
    rotation.teamAActivePlayerId,
    sides[0]?.activePlayerId,
    Array.isArray(sides[0]?.participantIds) ? sides[0].participantIds[0] : null
  );
  const sideBId = firstString(
    rotation.sideBPlayerId,
    rotation.teamB?.activePlayerId,
    rotation.teamBActivePlayerId,
    sides[1]?.activePlayerId,
    Array.isArray(sides[1]?.participantIds) ? sides[1].participantIds[0] : null
  );
  const nextA = firstString(
    rotation.nextA,
    rotation.teamA?.nextPlayerId,
    rotation.nextSideAPlayerId
  );
  const nextB = firstString(
    rotation.nextB,
    rotation.teamB?.nextPlayerId,
    rotation.nextSideBPlayerId
  );

  const pointsInRotation =
    rotation.pointsInRotation ??
    rotation.progress?.pointsInRotation ??
    db?.pointsInRotation ??
    null;
  const rotationPoints =
    rotation.rotationPoints ??
    rotation.progress?.rotationPoints ??
    db?.scoringFormat?.rotationPoints ??
    null;

  const sideAActivePlayer = sideAId
    ? Object.freeze({
        playerId: sideAId,
        displayName: playerName(sideAId, names),
      })
    : null;
  const sideBActivePlayer = sideBId
    ? Object.freeze({
        playerId: sideBId,
        displayName: playerName(sideBId, names),
      })
    : null;

  return Object.freeze({
    isDreambreaker: true,
    hasActiveRotation: Boolean(sideAActivePlayer || sideBActivePlayer),
    rotationOwnedByTeamDomain: true,
    noDuplicateDreambreakerAssignment: true,
    sideAActivePlayer,
    sideBActivePlayer,
    nextPlayerA: nextA
      ? Object.freeze({ playerId: nextA, displayName: playerName(nextA, names) })
      : null,
    nextPlayerB: nextB
      ? Object.freeze({ playerId: nextB, displayName: playerName(nextB, names) })
      : null,
    currentRotation: rotation.index ?? rotation.currentIndex ?? db?.currentIndex ?? null,
    rotationProgress:
      pointsInRotation != null || rotationPoints != null
        ? Object.freeze({
            pointsInRotation: pointsInRotation == null ? null : Number(pointsInRotation),
            rotationPoints: rotationPoints == null ? null : Number(rotationPoints),
          })
        : null,
  });
}
