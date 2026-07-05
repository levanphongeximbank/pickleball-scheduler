/** Nhãn phiên bản sản phẩm — đồng bộ login, sidebar, mobile. */
export const APP_PRODUCT_NAME = "Pickleball Scheduler Pro";
export const APP_VERSION_LABEL = "V5.2 Production Pilot";

export function getLoginSubtitle({ supabaseAvailable = false } = {}) {
  if (supabaseAvailable) {
    return `Đăng nhập bảo mật — ${APP_VERSION_LABEL}`;
  }
  return `Đăng nhập dev — ${APP_VERSION_LABEL}`;
}

export function getProductVersionLine() {
  return `${APP_PRODUCT_NAME} — ${APP_VERSION_LABEL}`;
}
