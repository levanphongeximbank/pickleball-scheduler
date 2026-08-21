/**
 * Project recent match/scoring operations for Referee UI history panel.
 * Presentation only — reads canonical scoring events / completed games; no second ledger.
 */

import { SCORING_EVENT_TYPE } from "../../competition-core/scoring/index.js";

const EVENT_LABEL_VI = Object.freeze({
  [SCORING_EVENT_TYPE.POINT_RECORDED]: "Ghi điểm",
  [SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE]: "Side-out / không ghi điểm",
  [SCORING_EVENT_TYPE.SERVE_CHANGED]: "Đổi giao",
  [SCORING_EVENT_TYPE.SERVER_NUMBER_CHANGED]: "Đổi lượt giao",
  [SCORING_EVENT_TYPE.GAME_COMPLETED]: "Kết thúc game",
  [SCORING_EVENT_TYPE.SET_COMPLETED]: "Kết thúc set",
  [SCORING_EVENT_TYPE.MATCH_COMPLETED]: "Kết thúc trận",
  [SCORING_EVENT_TYPE.EVENT_SUPERSEDED]: "Hoàn tác / supersede",
  CHANGE_ENDS: "Đổi đầu sân",
  PAUSE: "Tạm dừng",
  RESUME: "Tiếp tục",
  START: "Bắt đầu trận",
});

function sideLabel(side) {
  const key = String(side || "").toUpperCase();
  if (key === "SIDE_A" || key === "A") return "A";
  if (key === "SIDE_B" || key === "B") return "B";
  return null;
}

function scoreSnippet(after) {
  if (!after || typeof after !== "object") return null;
  const a = after.SIDE_A ?? after.sideA;
  const b = after.SIDE_B ?? after.sideB;
  if (a == null && b == null) return null;
  return `${Number(a || 0)}–${Number(b || 0)}`;
}

/**
 * @param {{
 *   scoreProjection?: object|null,
 *   scoreSession?: object|null,
 *   courtState?: object|null,
 *   matchStatus?: string|null,
 *   limit?: number,
 * }} input
 */
export function projectMatchOperationHistory(input = {}) {
  const limit = Math.max(1, Number(input.limit) || 24);
  const scoreProjection = input.scoreProjection || null;
  const scoreSession = input.scoreSession || null;
  const courtState = input.courtState || {};
  const rows = [];

  const events =
    (Array.isArray(scoreProjection?.scoringState?.events) &&
      scoreProjection.scoringState.events) ||
    (Array.isArray(scoreSession?.state?.events) && scoreSession.state.events) ||
    (Array.isArray(scoreProjection?.events) && scoreProjection.events) ||
    [];

  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    if (ev.supersededByEventId) continue;
    const type = String(ev.eventType || "").trim();
    if (!type) continue;
    const label = EVENT_LABEL_VI[type] || type;
    const side = sideLabel(ev.scoringSide);
    const score = scoreSnippet(ev.scoreAfter);
    const detailParts = [];
    if (side) detailParts.push(`Đội ${side}`);
    if (score) detailParts.push(score);
    if (type === SCORING_EVENT_TYPE.SERVE_CHANGED || type === SCORING_EVENT_TYPE.SERVER_NUMBER_CHANGED) {
      const turn = ev.serveAfter?.serverNumber ?? ev.payload?.serverNumber;
      if (turn != null) detailParts.push(`Lượt ${turn}`);
    }
    rows.push(
      Object.freeze({
        id: String(ev.eventId || `${type}-${ev.sequence || rows.length}`),
        kind: type,
        label,
        detail: detailParts.length ? detailParts.join(" · ") : null,
        sequence: Number(ev.sequence) || rows.length + 1,
        source: "canonical-scoring-event",
      })
    );
  }

  if (!rows.length) {
    const completed =
      (Array.isArray(scoreProjection?.completedGames) && scoreProjection.completedGames) ||
      (Array.isArray(scoreProjection?.scoringState?.completedGames) &&
        scoreProjection.scoringState.completedGames) ||
      [];
    completed.forEach((game, index) => {
      const sideA = Number(game?.SIDE_A ?? game?.sideA ?? game?.a);
      const sideB = Number(game?.SIDE_B ?? game?.sideB ?? game?.b);
      if (!Number.isFinite(sideA) || !Number.isFinite(sideB)) return;
      rows.push(
        Object.freeze({
          id: `game-${index + 1}`,
          kind: SCORING_EVENT_TYPE.GAME_COMPLETED,
          label: EVENT_LABEL_VI[SCORING_EVENT_TYPE.GAME_COMPLETED],
          detail: `Game ${index + 1}: ${sideA}–${sideB}`,
          sequence: index + 1,
          source: "canonical-completed-games",
        })
      );
    });
    const points = scoreProjection?.points;
    if (points) {
      rows.push(
        Object.freeze({
          id: "current-score",
          kind: SCORING_EVENT_TYPE.POINT_RECORDED,
          label: "Điểm hiện tại",
          detail: `${Number(points.SIDE_A || 0)}–${Number(points.SIDE_B || 0)}`,
          sequence: rows.length + 1,
          source: "canonical-score-projection",
        })
      );
    }
  }

  if (courtState?.lastSideChangeEventId || courtState?.sideChangeAcknowledgedAtThreshold != null) {
    rows.push(
      Object.freeze({
        id: String(courtState.lastSideChangeEventId || "change-ends"),
        kind: "CHANGE_ENDS",
        label: EVENT_LABEL_VI.CHANGE_ENDS,
        detail: "Đã xác nhận đổi đầu sân",
        sequence: rows.length + 1,
        source: "canonical-court-state",
      })
    );
  }

  const status = String(input.matchStatus || "").toUpperCase();
  if (status === "SUSPENDED" || status === "PAUSED") {
    rows.push(
      Object.freeze({
        id: "lifecycle-pause",
        kind: "PAUSE",
        label: EVENT_LABEL_VI.PAUSE,
        detail: status,
        sequence: rows.length + 1,
        source: "canonical-lifecycle",
      })
    );
  }

  const sorted = rows
    .slice()
    .sort((a, b) => Number(a.sequence) - Number(b.sequence))
    .slice(-limit);

  return Object.freeze({
    source: "canonical",
    empty: sorted.length === 0,
    rows: Object.freeze(sorted),
  });
}
