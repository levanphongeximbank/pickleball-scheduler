/**
 * Phase 20 — Single source of truth for tenant subscription access (Phase 9 billing).
 * Legacy Sprint 4 subscriptionGuard remains for plan feature limits only.
 */
import { GRACE_PERIOD_DAYS, SUBSCRIPTION_STATUS } from "../constants/billingConstants.js";
import { getBillingStore } from "../repositories/billingRepository.js";
import { resolveNow } from "./billingStoreUtils.js";
import { TenantAccessService } from "./tenantAccessService.js";
import { SubscriptionService } from "./subscriptionService.js";

export const TENANT_ACCESS_STATUS = Object.freeze({
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE_GRACE: "past_due_grace",
  PAST_DUE_LOCKED: "past_due_locked",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
  NO_SUBSCRIPTION: "no_subscription",
  TENANT_NOT_FOUND: "tenant_not_found",
  LOADING: "loading",
});

const STATUS_MESSAGES_VI = Object.freeze({
  [TENANT_ACCESS_STATUS.TRIALING]: "Gói dùng thử đang hoạt động.",
  [TENANT_ACCESS_STATUS.ACTIVE]: "Gói đang hoạt động.",
  [TENANT_ACCESS_STATUS.PAST_DUE_GRACE]:
    "Gói quá hạn nhưng vẫn trong thời gian ân hạn. Vui lòng thanh toán sớm.",
  [TENANT_ACCESS_STATUS.PAST_DUE_LOCKED]:
    "Gói quá hạn và đã hết thời gian ân hạn. Vui lòng vào trang Thanh toán hoặc liên hệ hỗ trợ.",
  [TENANT_ACCESS_STATUS.EXPIRED]:
    "Gói dùng thử hoặc gói thuê đã hết hạn. Vui lòng vào trang Thanh toán hoặc liên hệ hỗ trợ.",
  [TENANT_ACCESS_STATUS.CANCELLED]:
    "Gói đã bị hủy. Vui lòng vào trang Thanh toán để gia hạn.",
  [TENANT_ACCESS_STATUS.SUSPENDED]:
    "Tài khoản/sân đang bị tạm khóa. Vui lòng liên hệ hỗ trợ.",
  [TENANT_ACCESS_STATUS.NO_SUBSCRIPTION]:
    "Chưa có gói sử dụng. Vui lòng vào trang Thanh toán hoặc liên hệ hỗ trợ.",
  [TENANT_ACCESS_STATUS.TENANT_NOT_FOUND]:
    "Không tìm thấy tenant/venue hợp lệ. Kiểm tra cấu hình profiles.venue_id.",
});

function createServices(store = getBillingStore()) {
  return {
    store,
    tenantAccess: new TenantAccessService({ store }),
    subscription: new SubscriptionService({ store }),
  };
}

function mapAccessToStatus(access, subscription) {
  if (!access) {
    return TENANT_ACCESS_STATUS.NO_SUBSCRIPTION;
  }

  if (access.reason === "no_subscription") {
    return TENANT_ACCESS_STATUS.NO_SUBSCRIPTION;
  }

  if (access.lockLevel === "grace" || access.reason === "grace_period") {
    return TENANT_ACCESS_STATUS.PAST_DUE_GRACE;
  }

  if (access.reason === "grace_period_ended") {
    return TENANT_ACCESS_STATUS.PAST_DUE_LOCKED;
  }

  if (access.reason === "trial_expired" || access.reason === "subscription_expired") {
    return TENANT_ACCESS_STATUS.EXPIRED;
  }

  if (access.reason === "subscription_cancelled" || access.lockLevel === "cancelled") {
    return TENANT_ACCESS_STATUS.CANCELLED;
  }

  if (access.reason === "subscription_suspended" || access.lockLevel === "suspended") {
    return TENANT_ACCESS_STATUS.SUSPENDED;
  }

  if (access.reason === "trialing" || subscription?.status === SUBSCRIPTION_STATUS.TRIALING) {
    return TENANT_ACCESS_STATUS.TRIALING;
  }

  if (access.reason === "active" || subscription?.status === SUBSCRIPTION_STATUS.ACTIVE) {
    return TENANT_ACCESS_STATUS.ACTIVE;
  }

  if (!access.allowed) {
    return TENANT_ACCESS_STATUS.EXPIRED;
  }

  return TENANT_ACCESS_STATUS.ACTIVE;
}

/**
 * Normalized subscription + access state for UI and guards.
 */
export function getTenantSubscriptionState({ store, tenantId, tenantExists = true, now } = {}) {
  if (!tenantId) {
    return {
      status: TENANT_ACCESS_STATUS.TENANT_NOT_FOUND,
      allowed: false,
      subscription: null,
      message: STATUS_MESSAGES_VI[TENANT_ACCESS_STATUS.TENANT_NOT_FOUND],
      lockLevel: "none",
      graceDays: GRACE_PERIOD_DAYS,
    };
  }

  if (tenantExists === false) {
    return {
      status: TENANT_ACCESS_STATUS.TENANT_NOT_FOUND,
      allowed: false,
      subscription: null,
      message: STATUS_MESSAGES_VI[TENANT_ACCESS_STATUS.TENANT_NOT_FOUND],
      lockLevel: "none",
      graceDays: GRACE_PERIOD_DAYS,
    };
  }

  const { tenantAccess, subscription: subscriptionService } = createServices(store);
  const subscription = subscriptionService.getByTenant(tenantId);
  const access = tenantAccess.evaluateAccess({ tenantId, now: resolveNow(now) });
  const status = mapAccessToStatus(access, subscription);

  return {
    status,
    allowed: Boolean(access.allowed),
    subscription,
    message: STATUS_MESSAGES_VI[status] || access.reason,
    lockLevel: access.lockLevel || "none",
    graceDays: GRACE_PERIOD_DAYS,
    reason: access.reason,
  };
}

/**
 * Resolve tenant access — primary API for route gates and services.
 */
export function resolveTenantAccessStatus(params = {}) {
  return getTenantSubscriptionState(params);
}

export function isTenantOperational(params = {}) {
  return resolveTenantAccessStatus(params).allowed === true;
}

export function getTenantAccessMessage(status) {
  return STATUS_MESSAGES_VI[status] || STATUS_MESSAGES_VI[TENANT_ACCESS_STATUS.NO_SUBSCRIPTION];
}
