export const DRAW_ROOM_PHASE = {
  IN_PROGRESS: "DRAW_IN_PROGRESS",
  COMPLETE: "DRAW_COMPLETE",
  LOCKED: "DRAW_LOCKED",
};

export const DRAW_LOCK_LABEL = "Khóa kết quả bốc thăm";

/**
 * Shared Draw Room lock / next-lifecycle gating.
 * Prototype fixture only — no draw/domain authority.
 */
export function resolveDrawRoomActionState({
  drawnCount = 0,
  expectedTotal = 0,
  locked = false,
  constraintsPass = true,
  remainingNoun = "cặp chưa bốc",
} = {}) {
  const remaining = Math.max(0, expectedTotal - drawnCount);
  const drawComplete = expectedTotal > 0 && remaining === 0;
  const phase = locked
    ? DRAW_ROOM_PHASE.LOCKED
    : drawComplete
      ? DRAW_ROOM_PHASE.COMPLETE
      : DRAW_ROOM_PHASE.IN_PROGRESS;
  const lockAllowed = phase === DRAW_ROOM_PHASE.COMPLETE && constraintsPass;
  const nextLifecycleEnabled = phase === DRAW_ROOM_PHASE.LOCKED;
  const lockHelper = locked
    ? "Đã khóa kết quả bốc thăm"
    : drawComplete
      ? (constraintsPass ? "Có thể khóa kết quả bốc thăm" : "Chưa đạt ràng buộc")
      : `Còn ${remaining} ${remainingNoun}`;

  return {
    phase,
    remaining,
    drawComplete,
    lockAllowed,
    lockDisabled: !lockAllowed,
    nextLifecycleDisabled: !nextLifecycleEnabled,
    drawNextDisabled: locked || drawComplete,
    lockHelper,
    statusLabel: locked ? "ĐÃ KHÓA" : lockAllowed ? "SẴN SÀNG" : `CHƯA SẴN SÀNG • ${remaining}`,
    statusTone: locked || lockAllowed ? "success" : "warning",
  };
}
