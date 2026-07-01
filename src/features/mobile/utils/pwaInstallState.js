export function buildPwaInstallBannerModel({ canInstall = false, isInstalled = false, isStandalone = false } = {}) {
  if (isInstalled || isStandalone) {
    return {
      showBanner: true,
      showAction: false,
      severity: "info",
      title: "Ứng dụng đã sẵn sàng",
      message: "Bạn đang dùng phiên bản ứng dụng đã cài đặt trên thiết bị.",
      actionLabel: null,
    };
  }

  if (canInstall) {
    return {
      showBanner: true,
      showAction: true,
      severity: "info",
      title: "Cài đặt ứng dụng",
      message: "Cài đặt để dùng nhanh hơn trên màn hình chính và hoạt động tốt hơn khi offline.",
      actionLabel: "Cài đặt ứng dụng",
    };
  }

  return {
    showBanner: false,
    showAction: false,
    severity: "info",
    title: null,
    message: null,
    actionLabel: null,
  };
}
