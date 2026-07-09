import { ANIMATION_MODES, prefersReducedMotion } from "../animationUtils.js";
import { ANIMATION_TO_FLOW_KEY } from "./tournamentFlowConfig.js";

/** Scope ngoài ANIMATION_MODES — xếp sân CLB */
export const EFFECT_PRELUDE_SCOPE = Object.freeze({
  COURT_SCHEDULING: "court_scheduling",
});

export const EFFECT_PRELUDE_PRESETS = Object.freeze({
  [ANIMATION_MODES.PAIRING_REVEAL]: {
    durationSec: 10,
    headline: "AI đang tính toán dữ liệu giải đấu",
    flowStepKey: "pairing",
    messages: [
      { at: 0, text: "Đang phân tích người chơi...", badge: "Đang phân tích" },
      { at: 33, text: "Đánh giá độ cân bằng...", badge: "Đánh giá độ cân bằng" },
      { at: 66, text: "Tối ưu ghép cặp...", badge: "Tối ưu ghép cặp" },
    ],
    playTick: true,
    skippable: true,
  },
  [ANIMATION_MODES.SNAKE_GROUP]: {
    durationSec: 8,
    headline: "AI đang chia bảng",
    flowStepKey: "draw",
    messages: [
      { at: 0, text: "Đang sắp xếp hạt giống...", badge: "Phân tích hạt giống" },
      { at: 40, text: "Áp dụng thuật toán Snake...", badge: "Snake seeding" },
      { at: 70, text: "Cân bằng trình độ các bảng...", badge: "Cân bằng bảng" },
    ],
    playTick: true,
    skippable: true,
  },
  [ANIMATION_MODES.RANDOM_DRAW]: {
    durationSec: 8,
    headline: "AI đang chuẩn bị bốc thăm",
    flowStepKey: "draw",
    messages: [
      { at: 0, text: "Đang xáo trộn danh sách...", badge: "Xáo trộn" },
      { at: 40, text: "Kiểm tra ràng buộc ghép...", badge: "Ràng buộc" },
      { at: 70, text: "Chuẩn bị vòng quay...", badge: "Sẵn sàng bốc thăm" },
    ],
    playTick: true,
    skippable: true,
  },
  [ANIMATION_MODES.GROUP_MATCH_PAIRING]: {
    durationSec: 6,
    headline: "AI đang ghép trận đấu",
    flowStepKey: "match_pairing",
    messages: [
      { at: 0, text: "Đang phân tích từng bảng...", badge: "Phân tích bảng" },
      { at: 45, text: "Ghép cặp thi đấu vòng bảng...", badge: "Ghép trận" },
      { at: 75, text: "Phân bổ sân dự kiến...", badge: "Xếp sân" },
    ],
    playTick: true,
    skippable: true,
  },
  [ANIMATION_MODES.BRACKET_REVEAL]: {
    durationSec: 8,
    headline: "AI đang tính toán sơ đồ thi đấu",
    flowStepKey: "bracket",
    messages: [
      { at: 0, text: "Đang xây dựng nhánh đấu...", badge: "Xây nhánh" },
      { at: 40, text: "Sắp xếp thứ tự trận...", badge: "Lịch trận" },
      { at: 70, text: "Chuẩn bị trình chiếu bracket...", badge: "Sẵn sàng" },
    ],
    playTick: true,
    skippable: true,
  },
  [ANIMATION_MODES.DAILY_FAIR_MATCH]: {
    durationSec: 5,
    headline: "AI đang tạo trận công bằng",
    flowStepKey: null,
    messages: [
      { at: 0, text: "Đang phân tích người chơi...", badge: "Đang phân tích" },
      { at: 50, text: "Đánh giá độ cân bằng...", badge: "Đánh giá độ cân bằng" },
    ],
    playTick: true,
    skippable: true,
    skipDailyAnalyzePhase: true,
  },
  [EFFECT_PRELUDE_SCOPE.COURT_SCHEDULING]: {
    durationSec: 8,
    headline: "AI đang xếp sân",
    flowStepKey: null,
    compact: true,
    messages: [
      { at: 0, text: "Đang xếp danh sách chờ...", badge: "Chờ xếp" },
      { at: 25, text: "Cân bằng sân...", badge: "Cân bằng sân" },
      { at: 50, text: "Ghép cặp...", badge: "Ghép cặp" },
      { at: 75, text: "Chấm điểm AI...", badge: "Chấm điểm" },
    ],
    playTick: true,
    skippable: true,
  },
});

const REDUCED_MOTION_DURATION_SEC = 1;

export function getEffectPreludePresetKey(animationMode) {
  if (!animationMode) {
    return null;
  }

  return EFFECT_PRELUDE_PRESETS[animationMode] ? animationMode : null;
}

export function hasEffectPrelude(animationMode) {
  return Boolean(getEffectPreludePresetKey(animationMode));
}

export function resolveEffectPreludePreset(presetKey, context = {}) {
  const base = EFFECT_PRELUDE_PRESETS[presetKey];
  if (!base) {
    return null;
  }

  const reducedMotion = prefersReducedMotion();
  const durationSec = reducedMotion ? REDUCED_MOTION_DURATION_SEC : base.durationSec;

  return {
    ...base,
    presetKey,
    durationSec,
    reducedMotion,
    subline: buildPreludeSubline(presetKey, context),
    activeFlowStepKey: base.flowStepKey || ANIMATION_TO_FLOW_KEY[presetKey] || null,
  };
}

export function buildPreludeSubline(presetKey, context = {}) {
  const { playerCount = 0, courtCount = 0, matchCount = 0, groupCount = 0 } = context;

  if (presetKey === EFFECT_PRELUDE_SCOPE.COURT_SCHEDULING) {
    const parts = [];
    if (playerCount > 0) {
      parts.push(`${playerCount} người chơi`);
    }
    if (courtCount > 0) {
      parts.push(`${courtCount} sân`);
    }
    return parts.length ? parts.join(" • ") : "Cân bằng trình độ và ghép cặp";
  }

  if (presetKey === ANIMATION_MODES.PAIRING_REVEAL) {
    const parts = [];
    if (playerCount > 0) {
      parts.push(`Phân tích ${playerCount} VĐV`);
    }
    if (courtCount > 0) {
      parts.push(`${courtCount} sân`);
    }
    parts.push("Cân bằng trình độ");
    return parts.join(" • ");
  }

  if (presetKey === ANIMATION_MODES.SNAKE_GROUP || presetKey === ANIMATION_MODES.RANDOM_DRAW) {
    const parts = [];
    if (playerCount > 0) {
      parts.push(`${playerCount} đội/cặp`);
    }
    if (groupCount > 0) {
      parts.push(`${groupCount} bảng`);
    }
    return parts.length ? parts.join(" • ") : "Chuẩn bị chia bảng";
  }

  if (presetKey === ANIMATION_MODES.GROUP_MATCH_PAIRING) {
    if (matchCount > 0) {
      return `${matchCount} trận dự kiến`;
    }
    return "Ghép trận vòng bảng";
  }

  if (presetKey === ANIMATION_MODES.DAILY_FAIR_MATCH) {
    if (matchCount > 0) {
      return `Tạo ${matchCount} trận công bằng`;
    }
    return "Phân tích pool người chơi";
  }

  if (presetKey === ANIMATION_MODES.BRACKET_REVEAL) {
    return "Knock-out bracket";
  }

  return "";
}

/**
 * @param {Array<{at: number, text: string, badge?: string}>} messages
 * @param {number} progressPercent 0–100
 */
export function getPreludeMessageAtProgress(messages = [], progressPercent = 0) {
  if (!messages.length) {
    return { text: "", badge: "" };
  }

  let active = messages[0];
  for (const message of messages) {
    if (progressPercent >= message.at) {
      active = message;
    }
  }

  return {
    text: active.text || "",
    badge: active.badge || "",
  };
}

export function getPreludeProgressPercent(durationSec, secondsLeft) {
  if (durationSec <= 0) {
    return 100;
  }

  const elapsed = durationSec - secondsLeft;
  return Math.min(100, Math.max(0, Math.round((elapsed / durationSec) * 100)));
}

export function buildEffectPreludeContext(payload = {}) {
  const players = payload.waitingPlayers || payload.players || [];
  const playerCount =
    players.length ||
    payload.pairings?.length ||
    payload.entries?.length ||
    payload.steps?.length ||
    payload.totalPlayers ||
    0;

  return {
    playerCount,
    courtCount: payload.courts?.length || payload.courtsInUse || 0,
    matchCount: payload.matchCount || payload.steps?.length || payload.fairMatches?.length || 0,
    groupCount: payload.groups?.length || 0,
    courts: payload.courts || [],
    players,
  };
}

export function buildEffectPreludeParticipants(payload = {}) {
  if (payload.waitingPlayers?.length) {
    return payload.waitingPlayers;
  }

  if (payload.players?.length) {
    return payload.players;
  }

  return [];
}
