/**
 * CanonicalCourtView projection — not court/scoring authority.
 * Positions and ends come from canonical state/events only.
 */

import { COURT_ORIENTATION, COURT_SLOT } from "../constants.js";
import { projectDreamBreakerRotation } from "./projectDreamBreakerRotation.js";
import { formatCanonicalScoreLine } from "./formatScoringPolicyLabel.js";
import { resolveSideChangeRequiredAfterScoring } from "../../competition-engine/integration/referee/deriveCanonicalCourtAfterScoring.js";
import { resolveAthleteDisplayName } from "./resolveRefereeSideDisplay.js";

function nameOf(id, names, fallback) {
  if (!id) return fallback || null;
  const mapped = names && names[id];
  if (mapped && typeof mapped === "object") {
    const label = String(mapped.displayName || mapped.name || "").trim();
    if (label) return label;
  }
  if (typeof mapped === "string" && mapped.trim()) {
    const label = mapped.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(label)) return label;
  }
  return fallback || null;
}

function sideLabel(side, names) {
  const teamId = side?.teamId || side?.entryId || side?.sideKey || null;
  const fromTeam = teamId ? nameOf(teamId, names, null) : null;
  if (fromTeam && fromTeam !== teamId) return fromTeam;
  if (side?.displayName) return String(side.displayName);
  if (side?.teamName) return String(side.teamName);
  return side?.sideKey === "B" ? "Bên B" : "Bên A";
}

function playersForSide(side, names, activeOnlyId) {
  const entryId = String(side?.entryId || side?.teamId || "").trim() || null;
  const ids = Array.isArray(side?.participantIds) ? side.participantIds.map(String) : [];
  const source = (activeOnlyId ? [activeOnlyId] : ids).filter(
    (playerId) => playerId && playerId !== entryId
  );
  return source.map((playerId) =>
    Object.freeze({
      playerId,
      displayName: resolveAthleteDisplayName(playerId, names, side) || playerId,
      permanentPlayerNumber: null,
    })
  );
}

function slotPlayers(players, servingPlayerId, receiverPlayerId) {
  const top = players[0] || null;
  const bottom = players[1] || null;
  function mark(player) {
    if (!player) return null;
    return Object.freeze({
      ...player,
      isServing: Boolean(servingPlayerId && player.playerId === servingPlayerId),
      isReceiving: Boolean(receiverPlayerId && player.playerId === receiverPlayerId),
    });
  }
  return { top: mark(top), bottom: mark(bottom) };
}

/**
 * @param {{
 *   participants?: object|null,
 *   scoringRules?: object|null,
 *   currentScore?: object|null,
 *   matchContext?: object|null,
 *   modeState?: object|null,
 *   courtState?: object|null,
 *   participantNames?: Record<string, string|object>,
 *   lifecyclePolicy?: object|null,
 * }} input
 */
export function projectCanonicalCourtView(input = {}) {
  const participants = input.participants || { sides: [] };
  const sides = Array.isArray(participants.sides) ? participants.sides : [];
  const sideA = sides[0] || { sideKey: "A", participantIds: [] };
  const sideB = sides[1] || { sideKey: "B", participantIds: [] };
  const names = input.participantNames || {};
  const rules = input.scoringRules || {};
  const score = input.currentScore || {};
  const serve = score.serve || null;
  const courtState = input.courtState || {};
  const orientation = String(
    courtState.courtOrientation || COURT_ORIENTATION.STANDARD
  ).toUpperCase();
  const swapped = orientation === COURT_ORIENTATION.SWAPPED;

  const dreambreaker = projectDreamBreakerRotation({
    matchContext: input.matchContext,
    modeState: input.modeState,
    participants,
    participantNames: names,
  });

  const singles =
    !dreambreaker.isDreambreaker &&
    (sideA.participantIds || []).length === 1 &&
    (sideB.participantIds || []).length === 1;

  const playersA = dreambreaker.isDreambreaker
    ? playersForSide(sideA, names, dreambreaker.sideAActivePlayer?.playerId)
    : playersForSide(sideA, names);
  const playersB = dreambreaker.isDreambreaker
    ? playersForSide(sideB, names, dreambreaker.sideBActivePlayer?.playerId)
    : playersForSide(sideB, names);

  const storedPositions = courtState.playerPositions || {};
  const orderedA = Array.isArray(storedPositions.sideA)
    ? storedPositions.sideA.map((id) => playersA.find((p) => p.playerId === id) || {
        playerId: id,
        displayName: resolveAthleteDisplayName(id, names, sideA) || id,
        permanentPlayerNumber: null,
      })
    : playersA;
  const orderedB = Array.isArray(storedPositions.sideB)
    ? storedPositions.sideB.map((id) => playersB.find((p) => p.playerId === id) || {
        playerId: id,
        displayName: resolveAthleteDisplayName(id, names, sideB) || id,
        permanentPlayerNumber: null,
      })
    : playersB;

  const servingPlayerId = String(
    courtState.serverPlayerId || serve?.serverPlayerId || ""
  ).trim() || null;
  let servingSide = serve?.servingSide
    ? String(serve.servingSide).toUpperCase()
    : courtState.servingSide
      ? String(courtState.servingSide).toUpperCase()
      : null;
  if (!servingSide && servingPlayerId) {
    if (orderedA.some((p) => p.playerId === servingPlayerId)) servingSide = "SIDE_A";
    else if (orderedB.some((p) => p.playerId === servingPlayerId)) servingSide = "SIDE_B";
  }
  const resolvedServingPlayerId =
    servingPlayerId ||
    (servingSide === "SIDE_A" ? orderedA[0]?.playerId : null) ||
    (servingSide === "SIDE_B" ? orderedB[0]?.playerId : null) ||
    null;
  const receiverPlayerId = String(
    courtState.receiverPlayerId || serve?.receiverPlayerId || ""
  ).trim() || null;

  const leftSide = swapped ? sideB : sideA;
  const rightSide = swapped ? sideA : sideB;
  const leftPlayers = swapped ? orderedB : orderedA;
  const rightPlayers = swapped ? orderedA : orderedB;

  const leftSlots = slotPlayers(leftPlayers, resolvedServingPlayerId, receiverPlayerId);
  const rightSlots = slotPlayers(rightPlayers, resolvedServingPlayerId, receiverPlayerId);

  const scoreLine = formatCanonicalScoreLine({
    scoringSystem: rules.scoringSystem,
    scoringRules: rules,
    points: score.points,
    serve: serve
      ? { ...serve, servingSide: servingSide || serve.servingSide }
      : servingSide
        ? { servingSide, serverNumber: courtState.serverNumber, serverPlayerId: resolvedServingPlayerId }
        : null,
    currentGameIndex: score.currentGameIndex,
  });

  const fromCourtTurn = Number(courtState.serverNumber);
  const fromServeTurn = Number(serve?.serverNumber);
  const scoringSystem = String(rules.scoringSystem || "").toUpperCase();
  const serviceTurn =
    scoringSystem === "RALLY"
      ? null
      : Number.isFinite(fromServeTurn) && fromServeTurn > 0
        ? fromServeTurn
        : Number.isFinite(fromCourtTurn) && fromCourtTurn > 0
          ? fromCourtTurn
          : scoreLine.serviceTurn;

  const points = score.points || {};
  const sideChangeResolved = resolveSideChangeRequiredAfterScoring({
    priorCourt: courtState,
    priorPoints: points,
    nextPoints: points,
    sideSwitchAt: rules.sideSwitchAt ?? rules.changeEndAt ?? null,
    domainHints: [],
  });
  const sideChangeRequired = sideChangeResolved.sideChangeRequired === true;
  const sideChangePolicy =
    input.lifecyclePolicy?.changeEndPolicyLabel ||
    input.lifecyclePolicy?.changeEndSummary ||
    rules.metadata?.changeEndPolicyLabel ||
    null;
  const lineupConfigured =
    courtState.lineupConfigured === true ||
    Boolean(courtState.serverPlayerId || serve?.serverPlayerId);

  return Object.freeze({
    courtOrientation: swapped ? COURT_ORIENTATION.SWAPPED : COURT_ORIENTATION.STANDARD,
    geometry: dreambreaker.isDreambreaker || singles ? "SINGLES_OR_DB" : "DOUBLES",
    isSingles: singles,
    isDoubles: !singles && !dreambreaker.isDreambreaker,
    isDreambreaker: dreambreaker.isDreambreaker,
    lineupConfigured,
    sides: Object.freeze({
      left: Object.freeze({
        sideKey: leftSide.sideKey || (swapped ? "B" : "A"),
        scoringSide: swapped ? "SIDE_B" : "SIDE_A",
        participant: Object.freeze({
          teamId: leftSide.teamId || null,
          entryId: leftSide.entryId || null,
          displayName: sideLabel(leftSide, names),
        }),
        activePlayers: Object.freeze(leftPlayers),
      }),
      right: Object.freeze({
        sideKey: rightSide.sideKey || (swapped ? "A" : "B"),
        scoringSide: swapped ? "SIDE_A" : "SIDE_B",
        participant: Object.freeze({
          teamId: rightSide.teamId || null,
          entryId: rightSide.entryId || null,
          displayName: sideLabel(rightSide, names),
        }),
        activePlayers: Object.freeze(rightPlayers),
      }),
    }),
    serving: Object.freeze({
      servingSide,
      serverPlayerId: resolvedServingPlayerId,
      receiverPlayerId,
      serviceTurn: serviceTurn != null ? Number(serviceTurn) : null,
    }),
    court: Object.freeze({
      [COURT_SLOT.LEFT_TOP]: leftSlots.top,
      [COURT_SLOT.LEFT_BOTTOM]: singles || dreambreaker.isDreambreaker ? null : leftSlots.bottom,
      [COURT_SLOT.RIGHT_TOP]: rightSlots.top,
      [COURT_SLOT.RIGHT_BOTTOM]:
        singles || dreambreaker.isDreambreaker ? null : rightSlots.bottom,
    }),
    sideChangeRequired,
    sideChangePolicy,
    lastSideChangeEventId: courtState.lastSideChangeEventId || null,
    dreambreaker,
    scoreLine,
    permanentPlayerNumberLabel: false,
  });
}
