/** Nhãn phiên bản sản phẩm — đồng bộ login, sidebar, mobile (không tag RC1). */
export const APP_PRODUCT_NAME = "Pickleball Scheduler Pro";
export const APP_VERSION_LABEL = "V5.0 SaaS Preview RC1";

export function getLoginSubtitle({ supabaseAvailable = false } = {}) {
  if (supabaseAvailable) {
    return `Đăng nhập bảo mật — ${APP_VERSION_LABEL}`;
  }
  return `Đăng nhập dev — ${APP_VERSION_LABEL}`;
}

export function getProductVersionLine() {
  return `${APP_PRODUCT_NAME} — ${APP_VERSION_LABEL}`;
}
