export const DRAW_LOCK_LABEL = "Khóa kết quả bốc thăm";

export function resolveDrawRoomActionState({
  drawnCount = 0,
  expectedTotal = 0,
  locked = false,
  constraintsPass = true,
  remainingNoun = "cặp chưa bốc",
  lockAuthority = false,
} = {}) {
  const remaining = Math.max(0, Number(expectedTotal) - Number(drawnCount));
  const drawComplete = Number(expectedTotal) > 0 && remaining === 0;
  const lockAllowed = Boolean(lockAuthority) && drawComplete && constraintsPass && !locked;
  const nextLifecycleEnabled = locked === true;
  const lockHelper = locked
    ? "Đã khóa kết quả bốc thăm"
    : lockAuthority
      ? drawComplete
        ? constraintsPass
          ? "Có thể khóa kết quả bốc thăm"
          : "Chưa đạt ràng buộc"
        : `Còn ${remaining} ${remainingNoun}`
      : "Khóa kết quả bốc thăm chưa có trên hệ thống này.";

  return {
    remaining,
    drawComplete,
    lockAllowed,
    lockDisabled: !lockAllowed,
    nextLifecycleDisabled: !nextLifecycleEnabled,
    drawNextDisabled: true,
    lockHelper,
    statusLabel: locked ? "ĐÃ KHÓA" : lockAllowed ? "SẴN SÀNG" : remaining ? `CHƯA SẴN SÀNG • ${remaining}` : "CHƯA SẴN SÀNG",
    statusTone: locked || lockAllowed ? "success" : "warning",
  };
}
