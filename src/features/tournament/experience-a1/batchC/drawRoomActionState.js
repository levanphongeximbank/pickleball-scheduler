export const DRAW_LOCK_LABEL = "Khóa kết quả bốc thăm";

export function resolveDrawRoomActionState({
  drawnCount = 0,
  expectedTotal = 0,
  contentLocked = false,
  constraintsPass = true,
  remainingNoun = "cặp chưa bốc",
  lockAuthority = false,
} = {}) {
  const remaining = Math.max(0, Number(expectedTotal) - Number(drawnCount));
  const drawComplete = Number(expectedTotal) > 0 && remaining === 0;
  const requiredDataPresent = Number(expectedTotal) > 0;
  const lockAllowed = Boolean(lockAuthority) && drawComplete && constraintsPass && !contentLocked;
  const nextLifecycleEnabled =
    Boolean(lockAuthority) && contentLocked === true && drawComplete && requiredDataPresent && constraintsPass;
  const lockHelper = contentLocked
    ? "Đã khóa kết quả bốc thăm"
    : lockAuthority
      ? drawComplete
        ? constraintsPass
          ? "Có thể khóa kết quả bốc thăm"
          : "Chưa đạt ràng buộc"
        : `Còn ${remaining} ${remainingNoun}`
      : "Nội dung này chưa có cơ chế khóa riêng.";

  return {
    remaining,
    drawComplete,
    requiredDataPresent,
    lockAllowed,
    lockDisabled: !lockAllowed,
    nextLifecycleDisabled: !nextLifecycleEnabled,
    drawNextDisabled: true,
    lockHelper,
    statusLabel: contentLocked
      ? "ĐÃ KHÓA"
      : drawComplete
        ? lockAllowed
          ? "SẴN SÀNG"
          : "CHƯA SẴN SÀNG"
        : remaining
          ? `CHƯA SẴN SÀNG • ${remaining}`
          : "CHƯA SẴN SÀNG",
    readinessLabel: contentLocked ? "Đã khóa kết quả bốc thăm" : drawComplete ? "Sẵn sàng" : "Chưa hoàn tất bốc thăm",
    statusTone: contentLocked || lockAllowed ? "success" : "warning",
  };
}
