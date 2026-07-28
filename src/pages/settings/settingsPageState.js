/**
 * Settings page state model — each status is explicit (never overload null).
 */

export const SETTINGS_PAGE_STATUS = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  EMPTY: "empty",
  UNAUTHORIZED: "unauthorized",
  UNAVAILABLE: "unavailable",
  RUNTIME_ERROR: "runtime_error",
});

/**
 * @param {{
 *   activeClubId?: string|null,
 *   activeClub?: { id?: string, name?: string }|null,
 *   accessAllowed?: boolean,
 *   platformPreview?: { status?: string, message?: string }|null,
 *   localCloudDbReadable?: boolean,
 *   cloudSyncMode?: string|null,
 * }} input
 */
export function resolveSettingsPageState(input = {}) {
  const {
    activeClubId = null,
    activeClub = null,
    accessAllowed = true,
    platformPreview = null,
    localCloudDbReadable = true,
    cloudSyncMode = "local",
  } = input;

  if (platformPreview?.status === "error") {
    return {
      status: SETTINGS_PAGE_STATUS.RUNTIME_ERROR,
      message:
        platformPreview.message ||
        "Không thể khởi tạo runtime platform cho trang Cài đặt.",
    };
  }

  if (platformPreview == null) {
    return {
      status: SETTINGS_PAGE_STATUS.LOADING,
      message: "Đang tải cấu hình Cài đặt…",
    };
  }

  if (accessAllowed === false) {
    return {
      status: SETTINGS_PAGE_STATUS.UNAUTHORIZED,
      message: "Bạn không có quyền thao tác cài đặt hệ thống trên runtime hiện tại.",
    };
  }

  if (!activeClubId || !activeClub) {
    return {
      status: SETTINGS_PAGE_STATUS.EMPTY,
      message: "Chưa chọn câu lạc bộ. Chọn CLB trên thanh công cụ để xem Cài đặt.",
    };
  }

  // Local cloud-db is forbidden under secure/hard-cutover. Only surface UNAVAILABLE
  // when the page would otherwise depend on that local map (non-Supabase mode).
  if (localCloudDbReadable === false && cloudSyncMode !== "supabase") {
    return {
      status: SETTINGS_PAGE_STATUS.UNAVAILABLE,
      message:
        "Đồng bộ local (pickleball-cloud-db-v1) không khả dụng trên runtime bảo mật. Cấu hình Supabase để đồng bộ cloud.",
      clubId: activeClubId,
    };
  }

  return {
    status: SETTINGS_PAGE_STATUS.READY,
    message: null,
    clubId: activeClubId,
  };
}
