/**
 * Registration policy + regulations + confirmation messages (S1-C).
 * Blob: tournament.settings.regulations, tournament.settings.registrationPolicy
 */

export const DEFAULT_REGULATIONS = {
  templateId: "standard",
  body:
    "1. VĐV/cặp đăng ký đúng hạn và đủ điều kiện.\n2. BTC có quyền từ chối đăng ký không đủ điều kiện.\n3. Kết quả trọng tài là quyết định cuối cùng.",
};

export const DEFAULT_REGISTRATION_POLICY = {
  confirmationMessage: "Đăng ký đã được gửi. Vui lòng chờ BTC duyệt.",
  rejectionMessage: "Đăng ký bị từ chối. Liên hệ BTC để biết chi tiết.",
  waitlistMessage: "Bạn đang trong danh sách chờ.",
  unpaidFeeMessage: "Vui lòng thanh toán lệ phí trước khi được duyệt.",
  eligibilityFailedMessage: "Bạn không đủ điều kiện tham gia giải này.",
};

function patchSettings(tournament, patch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...patch,
    },
  };
}

export function normalizeRegulations(state = {}) {
  return {
    templateId: state.templateId ? String(state.templateId).trim() : DEFAULT_REGULATIONS.templateId,
    body: state.body != null ? String(state.body) : DEFAULT_REGULATIONS.body,
  };
}

export function getRegulations(tournament) {
  return normalizeRegulations(tournament?.settings?.regulations || {});
}

export function setRegulations(tournament, patch = {}) {
  const next = normalizeRegulations({ ...getRegulations(tournament), ...patch });
  return {
    ok: true,
    tournament: patchSettings(tournament, { regulations: next }),
    regulations: next,
  };
}

export function normalizeRegistrationPolicy(state = {}) {
  return {
    confirmationMessage:
      state.confirmationMessage != null
        ? String(state.confirmationMessage)
        : DEFAULT_REGISTRATION_POLICY.confirmationMessage,
    rejectionMessage:
      state.rejectionMessage != null
        ? String(state.rejectionMessage)
        : DEFAULT_REGISTRATION_POLICY.rejectionMessage,
    waitlistMessage:
      state.waitlistMessage != null
        ? String(state.waitlistMessage)
        : DEFAULT_REGISTRATION_POLICY.waitlistMessage,
    unpaidFeeMessage:
      state.unpaidFeeMessage != null
        ? String(state.unpaidFeeMessage)
        : DEFAULT_REGISTRATION_POLICY.unpaidFeeMessage,
    eligibilityFailedMessage:
      state.eligibilityFailedMessage != null
        ? String(state.eligibilityFailedMessage)
        : DEFAULT_REGISTRATION_POLICY.eligibilityFailedMessage,
  };
}

export function getRegistrationPolicy(tournament) {
  return normalizeRegistrationPolicy(tournament?.settings?.registrationPolicy || {});
}

export function setRegistrationPolicy(tournament, patch = {}) {
  const next = normalizeRegistrationPolicy({ ...getRegistrationPolicy(tournament), ...patch });
  return {
    ok: true,
    tournament: patchSettings(tournament, { registrationPolicy: next }),
    policy: next,
  };
}

export const REGULATION_TEMPLATES = [
  {
    id: "standard",
    label: "Điều lệ chuẩn CLB",
    body: DEFAULT_REGULATIONS.body,
  },
  {
    id: "open",
    label: "Giải mở",
    body:
      "1. Mở cho mọi VĐV đủ điều kiện nội dung.\n2. Đăng ký trực tuyến trước hạn.\n3. Tuân thủ điều lệ & hướng dẫn BTC.",
  },
  {
    id: "enterprise",
    label: "Giải doanh nghiệp",
    body:
      "1. Ưu tiên thành viên doanh nghiệp/CLB.\n2. Trang phục thống nhất.\n3. An toàn sân là ưu tiên hàng đầu.",
  },
];
