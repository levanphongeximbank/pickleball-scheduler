/**
 * Pure court transition after CORE-16 logical score/serve result.
 * Not a second scoring authority — derives physical slots from committed serve/points.
 *
 * playerPositions.sideA/sideB slot convention:
 *   [0] = RIGHT_SERVICE_COURT (even-score serve court)
 *   [1] = LEFT_SERVICE_COURT (odd-score serve court)
 *
 * Algorithm mirrors tested V5 side-out/partner-switch semantics without calling V5.
 */

import { SCORING_SIDE } from "../../../competition-core/scoring/enums/scoringSides.js";
import { SCORING_SYSTEM } from "../../../competition-core/scoring/enums/scoringSystems.js";

function cloneCourt(court = {}) {
  const positions = court.playerPositions || {};
  return {
    ...court,
    playerPositions: {
      sideA: Array.isArray(positions.sideA) ? positions.sideA.map(String) : [],
      sideB: Array.isArray(positions.sideB) ? positions.sideB.map(String) : [],
    },
  };
}

function sideKey(scoringSide) {
  return String(scoringSide || "").toUpperCase() === SCORING_SIDE.SIDE_B ? "sideB" : "sideA";
}

function oppositeSide(scoringSide) {
  return String(scoringSide || "").toUpperCase() === SCORING_SIDE.SIDE_B
    ? SCORING_SIDE.SIDE_A
    : SCORING_SIDE.SIDE_B;
}

function swapSidePositions(positions, scoringSide) {
  const key = sideKey(scoringSide);
  const list = Array.isArray(positions[key]) ? [...positions[key]] : [];
  if (list.length >= 2) {
    const tmp = list[0];
    list[0] = list[1];
    list[1] = tmp;
    positions[key] = list;
  }
  return positions;
}

function partnerOf(list, playerId) {
  const ids = Array.isArray(list) ? list.map(String) : [];
  const id = String(playerId || "");
  if (!id || ids.length < 2) return null;
  if (ids[0] === id) return ids[1];
  if (ids[1] === id) return ids[0];
  return ids.find((x) => x !== id) || null;
}

/**
 * Pick initial server for a side on side-out: RIGHT service court (index 0).
 * Falls back only when the preferred slot is empty — never "first arbitrary" when RIGHT exists.
 */
function pickRightCourtServer(positions, scoringSide) {
  const list = positions[sideKey(scoringSide)] || [];
  if (list[0]) return String(list[0]);
  if (list[1]) return String(list[1]);
  return null;
}

function indexOfPlayer(list, playerId) {
  const ids = Array.isArray(list) ? list.map(String) : [];
  return ids.indexOf(String(playerId || ""));
}

function resolveReceiver(positions, servingSide, serverPlayerId) {
  const servingList = positions[sideKey(servingSide)] || [];
  const receivingList = positions[sideKey(oppositeSide(servingSide))] || [];
  const idx = indexOfPlayer(servingList, serverPlayerId);
  if (idx < 0) return receivingList[0] || null;
  return receivingList[idx] || receivingList[0] || null;
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
  const nextServe = input.nextServe || null;
  const priorServerId = String(next.serverPlayerId || "").trim() || null;
  const awardedPoint = input.awardedPoint === true;

  if (!nextServe?.servingSide) {
    return Object.freeze({
      ...next,
      lineupConfigured: next.lineupConfigured === true || Boolean(priorServerId),
    });
  }

  const nextServingSide = String(nextServe.servingSide).toUpperCase();
  const nextServerNumber = Number(nextServe.serverNumber) > 0 ? Number(nextServe.serverNumber) : 1;
  const priorServingSide = priorServe?.servingSide
    ? String(priorServe.servingSide).toUpperCase()
    : nextServingSide;
  const samePossession = priorServingSide === nextServingSide;

  let serverPlayerId = priorServerId;

  if (scoringSystem === SCORING_SYSTEM.RALLY) {
    if (awardedPoint && samePossession) {
      next.playerPositions = swapSidePositions(next.playerPositions, nextServingSide);
      // Same server follows to the flipped slot.
      serverPlayerId = priorServerId;
    } else if (awardedPoint && !samePossession) {
      serverPlayerId = pickRightCourtServer(next.playerPositions, nextServingSide);
    }
  } else {
    // SIDE_OUT
    if (awardedPoint && samePossession) {
      next.playerPositions = swapSidePositions(next.playerPositions, nextServingSide);
      serverPlayerId = priorServerId;
    } else if (!awardedPoint && samePossession && nextServerNumber === 2) {
      const list = next.playerPositions[sideKey(nextServingSide)] || [];
      serverPlayerId = partnerOf(list, priorServerId) || pickRightCourtServer(next.playerPositions, nextServingSide);
    } else if (!awardedPoint && !samePossession) {
      serverPlayerId = pickRightCourtServer(next.playerPositions, nextServingSide);
    }
  }

  if (!serverPlayerId) {
    serverPlayerId = pickRightCourtServer(next.playerPositions, nextServingSide);
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
    servingSide: nextServingSide,
    serverNumber: nextServerNumber,
    serverPlayerId,
    receiverPlayerId,
    lineupConfigured: true,
  });
}
