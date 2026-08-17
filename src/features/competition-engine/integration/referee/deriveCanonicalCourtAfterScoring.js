/**
 * Pure court transition after CORE-16 logical score/serve result.
 * Not a second scoring authority — derives physical slots from committed serve/points.
 *
 * playerPositions.sideA/sideB slot convention:
 *   [0] = RIGHT_SERVICE_COURT (even-score serve court)
 *   [1] = LEFT_SERVICE_COURT (odd-score serve court)
 *
 * RALLY doubles: layout for a side = home XOR (score % 2).
 * Server = player on RIGHT when score even, LEFT when score odd.
 * homePlayerPositions is the even-parity layout captured at lineup.
 */

import { SCORING_SIDE } from "../../../competition-core/scoring/enums/scoringSides.js";
import { SCORING_SYSTEM } from "../../../competition-core/scoring/enums/scoringSystems.js";

function cloneList(list) {
  return Array.isArray(list) ? list.map(String) : [];
}

function cloneCourt(court = {}) {
  const positions = court.playerPositions || {};
  const home = court.homePlayerPositions || {};
  return {
    ...court,
    playerPositions: {
      sideA: cloneList(positions.sideA),
      sideB: cloneList(positions.sideB),
    },
    homePlayerPositions: {
      sideA: cloneList(home.sideA),
      sideB: cloneList(home.sideB),
    },
  };
}

function sideKey(scoringSide) {
  return String(scoringSide || "").toUpperCase() === SCORING_SIDE.SIDE_B
    ? "sideB"
    : "sideA";
}

function oppositeSide(scoringSide) {
  return String(scoringSide || "").toUpperCase() === SCORING_SIDE.SIDE_B
    ? SCORING_SIDE.SIDE_A
    : SCORING_SIDE.SIDE_B;
}

function swapList(list) {
  const next = cloneList(list);
  if (next.length >= 2) {
    const tmp = next[0];
    next[0] = next[1];
    next[1] = tmp;
  }
  return next;
}

function swapSidePositions(positions, scoringSide) {
  const key = sideKey(scoringSide);
  positions[key] = swapList(positions[key]);
  return positions;
}

function partnerOf(list, playerId) {
  const ids = cloneList(list);
  const id = String(playerId || "");
  if (!id || ids.length < 2) return null;
  if (ids[0] === id) return ids[1];
  if (ids[1] === id) return ids[0];
  return ids.find((x) => x !== id) || null;
}

function pickRightCourtServer(positions, scoringSide) {
  const list = positions[sideKey(scoringSide)] || [];
  if (list[0]) return String(list[0]);
  if (list[1]) return String(list[1]);
  return null;
}

function indexOfPlayer(list, playerId) {
  return cloneList(list).indexOf(String(playerId || ""));
}

function resolveReceiver(positions, servingSide, serverPlayerId) {
  const servingList = positions[sideKey(servingSide)] || [];
  const receivingList = positions[sideKey(oppositeSide(servingSide))] || [];
  const idx = indexOfPlayer(servingList, serverPlayerId);
  if (idx < 0) return receivingList[0] || null;
  return receivingList[idx] || receivingList[0] || null;
}

function scoreOf(points, scoringSide) {
  if (!points) return 0;
  const key = String(scoringSide || "").toUpperCase();
  return Number(points[key] ?? points[scoringSide] ?? 0) || 0;
}

/**
 * Even-parity home layout for a side.
 * Prefer explicit homePlayerPositions; else recover from current layout + prior score parity.
 */
function resolveHomeLayout(court, scoringSide, priorScore) {
  const key = sideKey(scoringSide);
  const storedHome = court.homePlayerPositions?.[key];
  if (Array.isArray(storedHome) && storedHome.length) {
    return cloneList(storedHome);
  }
  const current = cloneList(court.playerPositions?.[key]);
  if (!current.length) return current;
  // Odd prior score ⇒ current layout is swapped from home.
  if (Number(priorScore) % 2 === 1) return swapList(current);
  return current;
}

/** Layout for team score: even → home, odd → swapped home. */
function layoutForParity(home, teamScore) {
  const homeList = cloneList(home);
  if (Number(teamScore) % 2 === 1) return swapList(homeList);
  return homeList;
}

/** Server occupies RIGHT (0) on even score, LEFT (1) on odd score. */
function serverForParity(layout, teamScore) {
  const list = cloneList(layout);
  if (!list.length) return null;
  return Number(teamScore) % 2 === 0
    ? String(list[0] || "") || null
    : String(list[1] || list[0] || "") || null;
}

function ensureHomes(court, priorPoints) {
  const next = cloneCourt(court);
  for (const side of [SCORING_SIDE.SIDE_A, SCORING_SIDE.SIDE_B]) {
    const key = sideKey(side);
    if (!next.homePlayerPositions[key]?.length) {
      next.homePlayerPositions[key] = resolveHomeLayout(
        next,
        side,
        scoreOf(priorPoints, side)
      );
    }
  }
  return next;
}

function applyRallyCourtTransition(input, court) {
  const priorPoints = input.priorPoints || {};
  const nextPoints = input.nextPoints || {};
  const nextServingSide = String(input.nextServe.servingSide).toUpperCase();
  const priorServingSide = input.priorServe?.servingSide
    ? String(input.priorServe.servingSide).toUpperCase()
    : nextServingSide;

  const next = ensureHomes(court, priorPoints);

  // Align BOTH sides to their committed score parity (identity-preserving).
  for (const side of [SCORING_SIDE.SIDE_A, SCORING_SIDE.SIDE_B]) {
    const key = sideKey(side);
    const home = resolveHomeLayout(next, side, scoreOf(priorPoints, side));
    next.homePlayerPositions[key] = cloneList(home);
    next.playerPositions[key] = layoutForParity(home, scoreOf(nextPoints, side));
  }

  const servingScore = scoreOf(nextPoints, nextServingSide);
  const servingLayout = next.playerPositions[sideKey(nextServingSide)];
  let serverPlayerId = serverForParity(servingLayout, servingScore);

  // Serving team kept possession and scored: same server identity must survive the swap.
  if (
    priorServingSide === nextServingSide &&
    input.awardedPoint === true &&
    String(court.serverPlayerId || "").trim()
  ) {
    const priorId = String(court.serverPlayerId).trim();
    if (servingLayout.includes(priorId)) {
      serverPlayerId = priorId;
    }
  }

  if (!serverPlayerId) {
    serverPlayerId = serverForParity(servingLayout, servingScore);
  }

  return {
    court: next,
    serverPlayerId,
    nextServingSide,
    nextServerNumber: 1,
  };
}

/**
 * @param {{
 *   priorCourt?: object|null,
 *   priorServe?: { servingSide?: string, serverNumber?: number }|null,
 *   nextServe?: { servingSide?: string, serverNumber?: number }|null,
 *   priorPoints?: object|null,
 *   nextPoints?: object|null,
 *   scoringSystem?: string,
 *   awardedPoint?: boolean,
 *   rallyWinnerSide?: string|null,
 * }} input
 */
export function deriveCanonicalCourtAfterScoring(input = {}) {
  const scoringSystem = String(input.scoringSystem || "").trim().toUpperCase();
  const next = cloneCourt(input.priorCourt || {});
  const priorServe = input.priorServe || null;
  let nextServe = input.nextServe || null;
  const priorServerId = String(next.serverPlayerId || "").trim() || null;
  const awardedPoint = input.awardedPoint === true;
  const rallyWinnerSide = input.rallyWinnerSide
    ? String(input.rallyWinnerSide).toUpperCase()
    : null;

  // RALLY must always carry logical serve after a point (CORE may have had null serve).
  if (
    scoringSystem === SCORING_SYSTEM.RALLY &&
    awardedPoint &&
    !nextServe?.servingSide &&
    rallyWinnerSide
  ) {
    nextServe = { servingSide: rallyWinnerSide, serverNumber: 1 };
  }

  if (!nextServe?.servingSide) {
    return Object.freeze({
      ...next,
      lineupConfigured: next.lineupConfigured === true || Boolean(priorServerId),
    });
  }

  if (scoringSystem === SCORING_SYSTEM.RALLY) {
    const applied = applyRallyCourtTransition(
      { ...input, nextServe, awardedPoint },
      next
    );
    const receiverPlayerId = resolveReceiver(
      applied.court.playerPositions,
      applied.nextServingSide,
      applied.serverPlayerId
    );
    return Object.freeze({
      ...applied.court,
      playerPositions: {
        sideA: [...(applied.court.playerPositions.sideA || [])],
        sideB: [...(applied.court.playerPositions.sideB || [])],
      },
      homePlayerPositions: {
        sideA: [...(applied.court.homePlayerPositions.sideA || [])],
        sideB: [...(applied.court.homePlayerPositions.sideB || [])],
      },
      servingSide: applied.nextServingSide,
      serverNumber: applied.nextServerNumber,
      serverPlayerId: applied.serverPlayerId,
      receiverPlayerId,
      lineupConfigured: true,
    });
  }

  // SIDE_OUT
  const nextServingSide = String(nextServe.servingSide).toUpperCase();
  const nextServerNumber =
    Number(nextServe.serverNumber) > 0 ? Number(nextServe.serverNumber) : 1;
  const priorServingSide = priorServe?.servingSide
    ? String(priorServe.servingSide).toUpperCase()
    : nextServingSide;
  const samePossession = priorServingSide === nextServingSide;
  let serverPlayerId = priorServerId;

  if (awardedPoint && samePossession) {
    next.playerPositions = swapSidePositions(
      next.playerPositions,
      nextServingSide
    );
    serverPlayerId = priorServerId;
  } else if (!awardedPoint && samePossession && nextServerNumber === 2) {
    const list = next.playerPositions[sideKey(nextServingSide)] || [];
    serverPlayerId =
      partnerOf(list, priorServerId) ||
      pickRightCourtServer(next.playerPositions, nextServingSide);
  } else if (!awardedPoint && !samePossession) {
    // Side-out to opponent at serverNumber 1 → RIGHT court of new serving side.
    serverPlayerId = pickRightCourtServer(
      next.playerPositions,
      nextServingSide
    );
  }

  if (!serverPlayerId) {
    serverPlayerId = pickRightCourtServer(
      next.playerPositions,
      nextServingSide
    );
  }

  const receiverPlayerId = resolveReceiver(
    next.playerPositions,
    nextServingSide,
    serverPlayerId
  );

  return Object.freeze({
    ...next,
    playerPositions: {
      sideA: [...(next.playerPositions.sideA || [])],
      sideB: [...(next.playerPositions.sideB || [])],
    },
    homePlayerPositions: {
      sideA: [...(next.homePlayerPositions.sideA || [])],
      sideB: [...(next.homePlayerPositions.sideB || [])],
    },
    servingSide: nextServingSide,
    serverNumber: nextServerNumber,
    serverPlayerId,
    receiverPlayerId,
    lineupConfigured: true,
  });
}

/**
 * Durable change-end due flag. Sticky until confirmChangeEnds ACKs.
 * Threshold T applies to a team's game score (not A+B total):
 * priorScore < T && nextScore >= T on either side.
 */
export function resolveSideChangeRequiredAfterScoring(input = {}) {
  const priorCourt = input.priorCourt || {};
  const hints = Array.isArray(input.domainHints) ? input.domainHints : [];
  const thresholdRaw = input.sideSwitchAt;
  const threshold =
    thresholdRaw == null || thresholdRaw === "" ? null : Number(thresholdRaw);
  const ackAt =
    priorCourt.sideChangeAcknowledgedAtThreshold == null
      ? null
      : Number(priorCourt.sideChangeAcknowledgedAtThreshold);
  const priorPoints = input.priorPoints || {};
  const nextPoints = input.nextPoints || {};

  const acknowledgedForThreshold =
    threshold != null && Number.isFinite(threshold) && ackAt === threshold;

  if (acknowledgedForThreshold) {
    return Object.freeze({
      sideChangeRequired: false,
      sideChangeAcknowledgedAtThreshold: threshold,
      sideChangeThreshold: threshold,
    });
  }

  if (threshold == null || !Number.isFinite(threshold)) {
    return Object.freeze({
      sideChangeRequired: priorCourt.sideChangeRequired === true,
      sideChangeAcknowledgedAtThreshold: ackAt,
      sideChangeThreshold: null,
    });
  }

  let crossedThisTransition = false;
  let eitherAtOrPast = false;
  for (const side of ["SIDE_A", "SIDE_B"]) {
    const prior = Number(priorPoints[side] || 0);
    const next = Number(nextPoints[side] || 0);
    if (next >= threshold) eitherAtOrPast = true;
    if (prior < threshold && next >= threshold) crossedThisTransition = true;
  }

  const milestoneHint = hints.includes("ENDS_SWITCH_MILESTONE");
  // Per-team threshold is authoritative for change-end due.
  // CORE-16 ENDS_SWITCH_MILESTONE uses A+B total and must not force due early.
  const sideChangeRequired =
    priorCourt.sideChangeRequired === true ||
    crossedThisTransition ||
    eitherAtOrPast ||
    (threshold == null && milestoneHint);

  return Object.freeze({
    sideChangeRequired,
    sideChangeAcknowledgedAtThreshold: ackAt,
    sideChangeThreshold: threshold,
  });
}
