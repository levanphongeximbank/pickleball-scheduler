/**
 * Offline capability matrix — Phase 8 hardening.
 * Defines which actions are safe offline vs blocked vs pending-draft.
 */

export const OFFLINE_CAPABILITY_MODE = Object.freeze({
  ALLOW: "allow",
  BLOCK: "block",
  PENDING_DRAFT: "pending_draft",
  READ_ONLY: "read_only",
});

export const OFFLINE_CAPABILITY_MATRIX = Object.freeze({
  checkin: {
    mode: OFFLINE_CAPABILITY_MODE.PENDING_DRAFT,
    label: "Check-in QR",
    description: "Lưu tạm — validate lại tenant/venue khi đồng bộ.",
    syncValidate: true,
  },
  referee_note: {
    mode: OFFLINE_CAPABILITY_MODE.ALLOW,
    label: "Ghi chú trọng tài",
    description: "Ghi audit log khi đồng bộ — không ảnh hưởng điểm chính thức.",
    syncValidate: false,
  },
  match_score: {
    mode: OFFLINE_CAPABILITY_MODE.BLOCK,
    label: "Cập nhật điểm trận",
    description: "Không cho phép offline — rủi ro xung đột dữ liệu.",
    syncValidate: true,
  },
  booking_create: {
    mode: OFFLINE_CAPABILITY_MODE.BLOCK,
    label: "Tạo booking",
    description: "Cần kết nối mạng để xác nhận slot.",
  },
  payment: {
    mode: OFFLINE_CAPABILITY_MODE.BLOCK,
    label: "Thanh toán",
    description: "Không hỗ trợ thanh toán offline.",
  },
  match_finalize: {
    mode: OFFLINE_CAPABILITY_MODE.BLOCK,
    label: "Chốt trận",
    description: "Cần xác nhận server khi chốt kết quả.",
  },
  subscription_update: {
    mode: OFFLINE_CAPABILITY_MODE.BLOCK,
    label: "Cập nhật gói",
    description: "Thao tác billing cần online.",
  },
  read_cache: {
    mode: OFFLINE_CAPABILITY_MODE.READ_ONLY,
    label: "Xem dữ liệu cache",
    description: "Chỉ đọc snapshot đã lưu.",
  },
});

export function getOfflineCapability(actionType) {
  return (
    OFFLINE_CAPABILITY_MATRIX[actionType] || {
      mode: OFFLINE_CAPABILITY_MODE.BLOCK,
      label: actionType,
      description: "Thao tác không được phép offline.",
    }
  );
}

export function listBlockedOfflineActions() {
  return Object.entries(OFFLINE_CAPABILITY_MATRIX)
    .filter(([, cap]) => cap.mode === OFFLINE_CAPABILITY_MODE.BLOCK)
    .map(([type, cap]) => ({ type, ...cap }));
}

export function listPendingDraftOfflineActions() {
  return Object.entries(OFFLINE_CAPABILITY_MATRIX)
    .filter(([, cap]) => cap.mode === OFFLINE_CAPABILITY_MODE.PENDING_DRAFT)
    .map(([type, cap]) => ({ type, ...cap }));
}
