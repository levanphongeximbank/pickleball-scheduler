/**
 * PURE presentation-only optimistic projection for submitPoint.
 * Never authoritative. Does not invent a second Side-Out / scoring engine.
 *
 * Prefer score + pending + change-end warning. Court/serve/star projection only
 * when existing CORE-16-aligned deriveCanonicalCourtAfterScoring is safely reusable.
 */

import {
  deriveCanonicalCourtAfterScoring,
  resolveSideChangeRequiredAfterScoring,
} from "../../competition-engine/integration/referee/deriveCanonicalCourtAfterScoring.js";
import { deriveCourtPresentation } from "./deriveCourtPresentation.js";

function sideKeyOf(scoringSide) {
  return String(scoringSide || "").toUpperCase() === "SIDE_B" ? "sideB" : "sideA";
}

function oppositeSide(scoringSide) {
  return String(scoringSide || "").toUpperCase() === "SIDE_B" ? "SIDE_A" : "SIDE_B";
}

function clonePoints(points = {}) {
  return {
    SIDE_A: Number(points.SIDE_A || 0),
    SIDE_B: Number(points.SIDE_B || 0),
  };
}

function playerIdsFromSide(side) {
  const players = Array.isArray(side?.activePlayers) ? side.activePlayers : [];
  return players.map((p) => String(p.playerId || "")).filter(Boolean);
}

/**
 * Best-effort prior court snapshot from already-present presentation state.
 * Returns null when required slot identity is missing (fail closed → score-only).
 */
function extractPriorCourt(view) {
  const court = view?.courtProjection || {};
  const left = court.sides?.left || {};
  const right = court.sides?.right || {};
  const leftSide = String(left.scoringSide || "").toUpperCase();
  const rightSide = String(right.scoringSide || "").toUpperCase();
  if (leftSide !== "SIDE_A" && leftSide !== "SIDE_B") return null;
  if (rightSide !== "SIDE_A" && rightSide !== "SIDE_B") return null;

  const positions = { sideA: [], sideB: [] };
  const leftIds = playerIdsFromSide(left);
  const rightIds = playerIdsFromSide(right);
  positions[sideKeyOf(leftSide)] = leftIds;
  positions[sideKeyOf(rightSide)] = rightIds;

  if (!positions.sideA.length && !positions.sideB.length) return null;

  const serving = court.serving || {};
  return {
    playerPositions: positions,
    homePlayerPositions: {
      sideA: [],
      sideB: [],
    },
    servingSide: serving.servingSide || view.servingSideNow || null,
    serverNumber: serving.serviceTurn ?? null,
    serverPlayerId: serving.serverPlayerId || null,
    receiverPlayerId: serving.receiverPlayerId || null,
    lineupConfigured: court.lineupConfigured === true,
    courtOrientation: court.courtOrientation || "STANDARD",
    sideChangeRequired: court.sideChangeRequired === true,
    sideChangeThreshold: court.sideChangeThreshold ?? null,
    sideChangeAcknowledgedAtThreshold: court.sideChangeAcknowledgedAtThreshold ?? null,
  };
}

function applyCourtSlots(courtProjection, nextCourt) {
  if (!courtProjection?.sides || !nextCourt?.playerPositions) return courtProjection;
  const left = courtProjection.sides.left || {};
  const right = courtProjection.sides.right || {};
  const leftSide = String(left.scoringSide || "").toUpperCase();
  const rightSide = String(right.scoringSide || "").toUpperCase();

  function reorder(side, scoringSide) {
    const ids = nextCourt.playerPositions[sideKeyOf(scoringSide)] || [];
    if (!ids.length) return side.activePlayers || [];
    const byId = new Map(
      (side.activePlayers || []).map((p) => [String(p.playerId), p])
    );
    return ids.map((id) => {
      const existing = byId.get(String(id));
      if (existing) {
        return Object.freeze({
          ...existing,
          isServing: Boolean(
            nextCourt.serverPlayerId && String(existing.playerId) === String(nextCourt.serverPlayerId)
          ),
          isReceiving: Boolean(
            nextCourt.receiverPlayerId &&
              String(existing.playerId) === String(nextCourt.receiverPlayerId)
          ),
        });
      }
      return Object.freeze({
        playerId: String(id),
        displayName: String(id),
        isServing: String(id) === String(nextCourt.serverPlayerId || ""),
        isReceiving: String(id) === String(nextCourt.receiverPlayerId || ""),
      });
    });
  }

  const nextServingSide = nextCourt.servingSide
    ? String(nextCourt.servingSide).toUpperCase()
    : courtProjection.serving?.servingSide || null;

  return Object.freeze({
    ...courtProjection,
    sides: Object.freeze({
      left: Object.freeze({
        ...left,
        activePlayers: Object.freeze(reorder(left, leftSide)),
      }),
      right: Object.freeze({
        ...right,
        activePlayers: Object.freeze(reorder(right, rightSide)),
      }),
    }),
    serving: Object.freeze({
      ...(courtProjection.serving || {}),
      servingSide: nextServingSide,
      serverPlayerId: nextCourt.serverPlayerId || courtProjection.serving?.serverPlayerId || null,
      receiverPlayerId:
        nextCourt.receiverPlayerId || courtProjection.serving?.receiverPlayerId || null,
      serviceTurn:
        nextCourt.serverNumber != null
          ? Number(nextCourt.serverNumber)
          : courtProjection.serving?.serviceTurn ?? null,
    }),
    sideChangeRequired:
      courtProjection.sideChangeRequired === true || nextCourt.sideChangeRequired === true,
  });
}

function servingTeamName(view, servingSide) {
  if (servingSide === "SIDE_B") return view.participantDisplay?.sideB?.label || null;
  if (servingSide === "SIDE_A") return view.participantDisplay?.sideA?.label || null;
  return view.servingStatus?.servingTeamName || null;
}

function servingPlayerName(courtProjection, serverPlayerId) {
  if (!serverPlayerId) return null;
  const all = [
    ...(courtProjection?.sides?.left?.activePlayers || []),
    ...(courtProjection?.sides?.right?.activePlayers || []),
  ];
  const hit = all.find((p) => String(p.playerId) === String(serverPlayerId));
  return hit?.displayName || null;
}

/**
 * @param {object|null|undefined} authoritativeView
 * @param {string} scoringSide SIDE_A | SIDE_B
 * @returns {object|null} optimistic presentation view, or null if nothing safe to project
 */
export function deriveOptimisticSubmitPointView(authoritativeView, scoringSide) {
  if (!authoritativeView) return null;
  const side = String(scoringSide || "").trim().toUpperCase();
  if (side !== "SIDE_A" && side !== "SIDE_B") return null;

  const isRally = authoritativeView.isRally === true;
  const isSideOut = authoritativeView.isSideOut === true;
  const priorServing = String(
    authoritativeView.servingSideNow ||
      authoritativeView.courtProjection?.serving?.servingSide ||
      authoritativeView.currentScore?.serve?.servingSide ||
      ""
  ).toUpperCase();

  const awardedPoint = isRally || !isSideOut || priorServing === side;
  const priorPoints = clonePoints(authoritativeView.currentScore?.points);
  const nextPoints = clonePoints(priorPoints);
  if (awardedPoint) {
    nextPoints[side] = Number(nextPoints[side] || 0) + 1;
  }

  const thresholdRaw =
    authoritativeView.scoringRules?.sideSwitchAt ??
    authoritativeView.scoringRules?.changeEndAt ??
    authoritativeView.courtProjection?.sideChangeThreshold ??
    null;
  const sideChangeResolved = resolveSideChangeRequiredAfterScoring({
    priorCourt: {
      sideChangeRequired: authoritativeView.courtProjection?.sideChangeRequired === true,
      sideChangeAcknowledgedAtThreshold:
        authoritativeView.courtProjection?.sideChangeAcknowledgedAtThreshold ?? null,
      sideChangeThreshold: authoritativeView.courtProjection?.sideChangeThreshold ?? null,
    },
    priorPoints,
    nextPoints,
    sideSwitchAt: thresholdRaw,
    domainHints: [],
  });

  let nextServingSide = priorServing || null;
  let courtProjected = false;
  let nextCourtProjection = authoritativeView.courtProjection
    ? { ...authoritativeView.courtProjection }
    : null;

  const priorCourt = extractPriorCourt(authoritativeView);
  const priorServe =
    priorServing
      ? {
          servingSide: priorServing,
          serverNumber:
            authoritativeView.courtProjection?.serving?.serviceTurn ??
            authoritativeView.currentScore?.serve?.serverNumber ??
            1,
        }
      : null;

  if (isRally && awardedPoint) {
    nextServingSide = side;
    if (priorCourt) {
      const derived = deriveCanonicalCourtAfterScoring({
        priorCourt,
        priorServe,
        nextServe: { servingSide: side, serverNumber: 1 },
        priorPoints,
        nextPoints,
        scoringSystem: "RALLY",
        awardedPoint: true,
        rallyWinnerSide: side,
      });
      nextCourtProjection = applyCourtSlots(nextCourtProjection, derived);
      courtProjected = true;
    } else if (nextCourtProjection?.serving) {
      nextCourtProjection = Object.freeze({
        ...nextCourtProjection,
        serving: Object.freeze({
          ...nextCourtProjection.serving,
          servingSide: side,
        }),
      });
    }
  } else if (isSideOut && awardedPoint && priorServing === side && priorCourt && priorServe) {
    // Serving team scored: same possession — reuse CORE-16 partner swap, no Side-Out invent.
    const derived = deriveCanonicalCourtAfterScoring({
      priorCourt,
      priorServe,
      nextServe: priorServe,
      priorPoints,
      nextPoints,
      scoringSystem: "SIDE_OUT",
      awardedPoint: true,
      rallyWinnerSide: side,
    });
    nextCourtProjection = applyCourtSlots(nextCourtProjection, derived);
    nextServingSide = derived.servingSide || priorServing;
    courtProjected = true;
  }
  // Side-Out receiving win / ambiguous: score unchanged; keep serve/star/positions until ACK.

  if (nextCourtProjection) {
    nextCourtProjection = Object.freeze({
      ...nextCourtProjection,
      sideChangeRequired: sideChangeResolved.sideChangeRequired === true,
      sideChangeThreshold:
        sideChangeResolved.sideChangeThreshold ?? nextCourtProjection.sideChangeThreshold ?? null,
      sideChangeAcknowledgedAtThreshold:
        sideChangeResolved.sideChangeAcknowledgedAtThreshold ??
        nextCourtProjection.sideChangeAcknowledgedAtThreshold ??
        null,
    });
  }

  const nextServe = nextServingSide
    ? {
        ...(authoritativeView.currentScore?.serve || {}),
        servingSide: nextServingSide,
        serverPlayerId:
          nextCourtProjection?.serving?.serverPlayerId ||
          authoritativeView.currentScore?.serve?.serverPlayerId ||
          null,
        serverNumber:
          nextCourtProjection?.serving?.serviceTurn ??
          authoritativeView.currentScore?.serve?.serverNumber ??
          null,
      }
    : authoritativeView.currentScore?.serve || null;

  const currentScore = authoritativeView.currentScore
    ? Object.freeze({
        ...authoritativeView.currentScore,
        points: Object.freeze(nextPoints),
        serve: nextServe ? Object.freeze(nextServe) : null,
      })
    : Object.freeze({
        points: Object.freeze(nextPoints),
        serve: nextServe ? Object.freeze(nextServe) : null,
      });

  const participantDisplay = authoritativeView.participantDisplay || null;
  const courtPresentation = deriveCourtPresentation({
    courtProjection: nextCourtProjection,
    currentScore,
    participantDisplay,
  });

  const receivingSideNow = nextServingSide ? oppositeSide(nextServingSide) : null;
  const changeEndDue = sideChangeResolved.sideChangeRequired === true;

  return Object.freeze({
    ...authoritativeView,
    // Keep CAS identity from authoritative — never invent optimistic version.
    expectedVersion: authoritativeView.expectedVersion,
    diagnostics: Object.freeze({
      ...(authoritativeView.diagnostics || {}),
      expectedVersion: authoritativeView.expectedVersion,
    }),
    currentScore,
    courtProjection: nextCourtProjection,
    courtPresentation,
    servingSideNow: nextServingSide || authoritativeView.servingSideNow || null,
    receivingSideNow:
      receivingSideNow || authoritativeView.receivingSideNow || null,
    servingStatus: Object.freeze({
      ...(authoritativeView.servingStatus || {}),
      servingTeamName: servingTeamName(
        authoritativeView,
        nextServingSide || priorServing
      ),
      servingPlayerName:
        servingPlayerName(
          nextCourtProjection,
          nextCourtProjection?.serving?.serverPlayerId
        ) || authoritativeView.servingStatus?.servingPlayerName || null,
      serviceTurn:
        isSideOut && nextCourtProjection?.serving?.serviceTurn != null
          ? nextCourtProjection.serving.serviceTurn
          : authoritativeView.servingStatus?.serviceTurn ?? null,
    }),
    gameSummary: authoritativeView.gameSummary
      ? Object.freeze({
          ...authoritativeView.gameSummary,
          currentGamePoints: Object.freeze({
            sideA: nextPoints.SIDE_A,
            sideB: nextPoints.SIDE_B,
          }),
        })
      : authoritativeView.gameSummary,
    // Optimistic change-end warning is presentation-only; confirm stays ACK-gated.
    canChangeEnds: false,
    canScore: false,
    canPointSideA: false,
    canPointSideB: false,
    canChangeServe: false,
    canComplete: false,
    canSwitchPositions: false,
    isOptimisticPresentation: true,
    optimisticPending: true,
    optimisticScoringSide: side,
    optimisticAwardedPoint: awardedPoint,
    optimisticCourtProjected: courtProjected,
    optimisticChangeEndDue: changeEndDue,
    changeEndConfirmBlocked: true,
    pendingCanonicalAction: `point:${side}`,
  });
}
