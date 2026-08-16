/**
 * Best-of / change-end policy labels — derived from canonical rules/policy only.
 * Do not hardcode "11 ends the game" or "always change ends at 6".
 */

import { SCORING_SYSTEM } from "../../competition-core/scoring/index.js";

function readLabel(source) {
  if (!source || typeof source !== "object") return "";
  return String(
    source.changeEndPolicyLabel ||
      source.changeEndSummary ||
      source.sideChangePolicyLabel ||
      ""
  ).trim();
}

function scoringMethodLabel(scoringSystem) {
  if (scoringSystem === SCORING_SYSTEM.SIDE_OUT) return "SIDE-OUT";
  if (scoringSystem === SCORING_SYSTEM.RALLY) return "RALLY";
  return scoringSystem || null;
}

/**
 * @param {{ scoringRules?: object|null, lifecyclePolicy?: object|null }} input
 */
export function formatScoringPolicyLabel(input = {}) {
  const rules = input.scoringRules || {};
  const policy = input.lifecyclePolicy || {};
  const metadata = rules.metadata && typeof rules.metadata === "object" ? rules.metadata : {};

  const bestOf = Number(rules.bestOfGames) || 0;
  const pointsToWin = Number(rules.pointsToWin) || 0;
  const winBy = Number(rules.winBy) || 0;
  const cap = rules.maximumScore == null ? null : Number(rules.maximumScore);
  const scoringSystem = String(rules.scoringSystem || "").toUpperCase();
  const method = scoringMethodLabel(scoringSystem);

  const parts = [];
  if (method) parts.push(method);
  if (bestOf > 0) parts.push(`Best of ${bestOf}`);
  if (pointsToWin > 0) parts.push(`đến ${pointsToWin}`);
  if (winBy > 0) parts.push(`win-by ${winBy}`);
  if (cap != null && Number.isFinite(cap)) parts.push(`cap ${cap}`);

  const changeEndLabel =
    readLabel(policy) ||
    readLabel(metadata) ||
    readLabel(policy.changeEndPolicy) ||
    readLabel(metadata.changeEndPolicy);

  const sideSwitchAt =
    rules.sideSwitchAt == null ? null : Number(rules.sideSwitchAt);
  const changeEndAt =
    (sideSwitchAt != null && Number.isFinite(sideSwitchAt) ? String(sideSwitchAt) : null) ||
    changeEndLabel;

  return Object.freeze({
    scoringSystem,
    scoringMethodLabel: method,
    isSideOut: scoringSystem === SCORING_SYSTEM.SIDE_OUT,
    isRally: scoringSystem === SCORING_SYSTEM.RALLY,
    bestOfGames: bestOf || null,
    pointsToWin: pointsToWin || null,
    winBy: winBy || null,
    cap: cap != null && Number.isFinite(cap) ? cap : null,
    capLabel: cap != null && Number.isFinite(cap) ? String(cap) : "Không",
    scorePolicyLine: parts.join(" • ") || "",
    changeEndPolicyLabel: changeEndLabel || null,
    changeEndAtLabel: changeEndAt,
    sideSwitchAt,
    rulesRows: Object.freeze(
      [
        method ? Object.freeze({ key: "method", label: "Cách tính", value: method }) : null,
        pointsToWin > 0
          ? Object.freeze({ key: "target", label: "Kết thúc game", value: String(pointsToWin) })
          : null,
        winBy > 0
          ? Object.freeze({ key: "winBy", label: "Thắng cách", value: String(winBy) })
          : null,
        Object.freeze({
          key: "cap",
          label: "Điểm trần",
          value: cap != null && Number.isFinite(cap) ? String(cap) : "Không",
        }),
        changeEndAt
          ? Object.freeze({ key: "changeEnd", label: "Đổi sân tại", value: changeEndAt })
          : null,
        bestOf > 0
          ? Object.freeze({ key: "bestOf", label: "Thể thức", value: `Best of ${bestOf}` })
          : null,
      ].filter(Boolean)
    ),
  });
}

/**
 * Side-out score line from canonical serve + points.
 * Rally: two-number only. Never invent client rotation.
 *
 * @param {{
 *   scoringSystem?: string,
 *   points?: object,
 *   serve?: object|null,
 *   scoringRules?: object|null,
 * }} input
 */
export function formatCanonicalScoreLine(input = {}) {
  const system = String(input.scoringSystem || input.scoringRules?.scoringSystem || "")
    .trim()
    .toUpperCase();
  const points = input.points || {};
  const sideA = Number(points.SIDE_A ?? points.sideA ?? 0) || 0;
  const sideB = Number(points.SIDE_B ?? points.sideB ?? 0) || 0;
  const serve = input.serve || null;

  if (system === SCORING_SYSTEM.RALLY || !serve) {
    return Object.freeze({
      display: `${sideA} – ${sideB}`,
      servingTeamScore: null,
      receivingTeamScore: null,
      serviceTurn: null,
      showServiceTurn: false,
    });
  }

  const servingSide = String(serve.servingSide || "").toUpperCase();
  const servingScore = servingSide === "SIDE_B" ? sideB : sideA;
  const receivingScore = servingSide === "SIDE_B" ? sideA : sideB;
  const metadata = input.scoringRules?.metadata || {};
  const openingTurn = Number(metadata.openingServiceTurn);
  const atGameStart = sideA === 0 && sideB === 0 && Number(input.currentGameIndex || 0) === 0;
  const fromState = Number(serve.serverNumber);
  const serviceTurn =
    Number.isFinite(fromState) && fromState > 0
      ? fromState
      : atGameStart && Number.isFinite(openingTurn) && openingTurn > 0
        ? openingTurn
        : null;

  return Object.freeze({
    display:
      serviceTurn != null
        ? `${servingScore} – ${receivingScore} – ${serviceTurn}`
        : `${servingScore} – ${receivingScore}`,
    servingTeamScore: servingScore,
    receivingTeamScore: receivingScore,
    serviceTurn,
    showServiceTurn: serviceTurn != null,
  });
}
