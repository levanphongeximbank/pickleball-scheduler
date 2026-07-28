export const BILLING_RUNTIME_MODE = Object.freeze({
  UNAVAILABLE: "UNAVAILABLE",
  MISSING_SCOPE: "MISSING_SCOPE",
  LEGACY_LOCAL: "LEGACY_LOCAL",
  DURABLE: "DURABLE",
});

export const BILLING_RUNTIME_ERROR_CODE = Object.freeze({
  AUTHORITY_UNAVAILABLE: "BILLING_AUTHORITY_UNAVAILABLE",
  TENANT_MISSING: "TENANT_MISSING",
  LOCAL_AUTHORITY_FORBIDDEN: "BILLING_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
});

export const BILLING_UNAVAILABLE_USER_MESSAGE =
  "Billing chưa khả dụng sau hard cutover. Không có dữ liệu gói, usage, invoice hoặc thanh toán đáng tin cậy để hiển thị trong môi trường này.";

export const BILLING_MISSING_SCOPE_USER_MESSAGE =
  "Chưa xác định được tenant/venue hợp lệ cho Billing. Liên hệ SUPER_ADMIN nếu tài khoản chưa được gán đúng tenant.";

export const BILLING_LEGACY_DEMO_BANNER =
  "Billing đang chạy ở chế độ tương thích local/demo. Dữ liệu chỉ để kiểm thử, không bền vững và không dùng làm nguồn sự thật vận hành.";

export const BILLING_USAGE_UNAVAILABLE_MESSAGE =
  "Chưa có nguồn usage/quota đáng tin cậy để hiển thị.";
