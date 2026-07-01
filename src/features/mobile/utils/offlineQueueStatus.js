export function buildOfflineQueueBannerModel({ pendingCount = 0, isOffline = false, isSyncing = false } = {}) {
  if (!pendingCount) {
    return {
      showBanner: false,
      showAction: false,
      severity: "success",
      title: null,
      message: null,
      actionLabel: null,
    };
  }

  if (isOffline) {
    return {
      showBanner: true,
      showAction: false,
      severity: "warning",
      title: "Đang chờ đồng bộ",
      message: `Bạn có ${pendingCount} thao tác chưa được gửi. Hệ thống sẽ tự đồng bộ khi mạng trở lại.`,
      actionLabel: null,
    };
  }

  if (isSyncing) {
    return {
      showBanner: true,
      showAction: false,
      severity: "info",
      title: "Đang đồng bộ",
      message: `Đang gửi ${pendingCount} thao tác lên hệ thống...`,
      actionLabel: "Đang đồng bộ...",
    };
  }

  return {
    showBanner: true,
    showAction: true,
    severity: "info",
    title: "Có thao tác cần đồng bộ",
    message: `Bạn có ${pendingCount} thao tác đang chờ gửi. Nhấn đồng bộ ngay để cập nhật dữ liệu.`,
    actionLabel: "Đồng bộ ngay",
  };
}
