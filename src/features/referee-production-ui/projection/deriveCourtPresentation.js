/**
 * Single presentation orientation for scoreboard + court + point buttons.
 * Derives left/right display from the same courtProjection CanonicalCourtView uses.
 * Does not mutate canonical scores or team identity.
 */

/**
 * @param {{
 *   courtProjection?: object|null,
 *   currentScore?: object|null,
 *   participantDisplay?: object|null,
 * }} viewOrParts
 */
export function deriveCourtPresentation(viewOrParts = {}) {
  const court = viewOrParts.courtProjection || viewOrParts;
  const points =
    viewOrParts.currentScore?.points ||
    viewOrParts.points ||
    {};
  const participantDisplay = viewOrParts.participantDisplay || null;
  const leftSide = court?.sides?.left || {};
  const rightSide = court?.sides?.right || {};
  const leftScoringSide = String(leftSide.scoringSide || "SIDE_A").toUpperCase();
  const rightScoringSide = String(rightSide.scoringSide || "SIDE_B").toUpperCase();

  const leftTeam =
    leftSide.participant?.displayName ||
    (leftScoringSide === "SIDE_A"
      ? participantDisplay?.sideA?.label
      : participantDisplay?.sideB?.label) ||
    (leftScoringSide === "SIDE_B" ? "Đội B" : "Đội A");
  const rightTeam =
    rightSide.participant?.displayName ||
    (rightScoringSide === "SIDE_A"
      ? participantDisplay?.sideA?.label
      : participantDisplay?.sideB?.label) ||
    (rightScoringSide === "SIDE_A" ? "Đội A" : "Đội B");

  const leftParticipants = (leftSide.activePlayers || [])
    .map((p) => p.displayName)
    .filter(Boolean);
  const rightParticipants = (rightSide.activePlayers || [])
    .map((p) => p.displayName)
    .filter(Boolean);

  return Object.freeze({
    courtOrientation: court?.courtOrientation || "STANDARD",
    leftTeam,
    rightTeam,
    leftScore: Number(points[leftScoringSide] || 0),
    rightScore: Number(points[rightScoringSide] || 0),
    leftParticipants: Object.freeze(leftParticipants),
    rightParticipants: Object.freeze(rightParticipants),
    leftTeamId: leftSide.participant?.teamId || leftSide.participant?.entryId || null,
    rightTeamId: rightSide.participant?.teamId || rightSide.participant?.entryId || null,
    leftScoringSide,
    rightScoringSide,
    leftSideKey: leftSide.sideKey || (leftScoringSide === "SIDE_B" ? "B" : "A"),
    rightSideKey: rightSide.sideKey || (rightScoringSide === "SIDE_A" ? "A" : "B"),
    servingSide: court?.serving?.servingSide || null,
    serverPlayerId: court?.serving?.serverPlayerId || null,
  });
}
