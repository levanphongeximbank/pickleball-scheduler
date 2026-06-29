import { loadClubs } from "../data/club.js";
import { loadCourtsForClub } from "../domain/clubStorage.js";
import { getClubById } from "../domain/clubService.js";
import { getSubscriptionForVenue } from "../domain/venueService.js";
import {
  SUBSCRIPTION_PLANS,
  isSubscriptionActive,
  planIncludesFeature,
} from "../models/subscription.js";
import { isRbacEnabled } from "./authService.js";
import { loadStaffForVenue } from "../data/staff.js";
import { USER_STATUS } from "../models/user.js";

function countActiveStaffForVenue(venueId) {
  return loadStaffForVenue(venueId).filter(
    (member) => member.status !== USER_STATUS.SUSPENDED
  ).length;
}

const FEATURE_LABELS = Object.freeze({
  director_mode: "Director Mode",
  cloud_sync: "Đồng bộ cloud",
  accounting: "Kế toán",
  statistics: "Thống kê nâng cao",
});

function shouldEnforceSubscription(options = {}) {
  return options.rbacEnabled ?? isRbacEnabled();
}

export function countClubsForVenue(venueId) {
  return loadClubs().filter((club) => club.venueId === venueId).length;
}

export function countCourtsForVenue(venueId) {
  const clubIds = loadClubs()
    .filter((club) => club.venueId === venueId)
    .map((club) => club.id);

  return clubIds.reduce((total, clubId) => total + loadCourtsForClub(clubId).length, 0);
}

export function getVenuePlanContext(venueId) {
  const subscription = venueId ? getSubscriptionForVenue(venueId) : null;
  const planId = subscription?.planId || "trial";
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.trial;

  return {
    subscription,
    planId,
    plan,
    active: subscription ? isSubscriptionActive(subscription) : true,
  };
}

/** Gói venue còn hiệu lực — chỉ khi RBAC bật và CLB đã gắn venue. */
export function guardSubscriptionForVenue(venueId, options = {}) {
  if (!shouldEnforceSubscription(options) || !venueId) {
    return { ok: true };
  }

  const { subscription, active, planId } = getVenuePlanContext(venueId);

  if (!subscription) {
    return { ok: true, planId };
  }

  if (!active) {
    return {
      ok: false,
      error: "Gói thuê venue đã hết hạn hoặc bị tạm dừng. Gia hạn trong Cài đặt → Tenant / Venue.",
      code: "SUBSCRIPTION_INACTIVE",
      venueId,
    };
  }

  return { ok: true, planId, subscription };
}

export function guardPlanFeature(venueId, feature, options = {}) {
  const base = guardSubscriptionForVenue(venueId, options);
  if (!base.ok) {
    return base;
  }

  if (!shouldEnforceSubscription(options) || !venueId) {
    return { ok: true };
  }

  const planId = base.planId || getVenuePlanContext(venueId).planId;
  if (!planIncludesFeature(planId, feature)) {
    const planName = SUBSCRIPTION_PLANS[planId]?.name || planId;
    const label = FEATURE_LABELS[feature] || feature;

    return {
      ok: false,
      error: `${label} không có trong gói ${planName}. Nâng cấp gói trong Cài đặt.`,
      code: "PLAN_FEATURE_LOCKED",
      feature,
      planId,
      venueId,
    };
  }

  return { ok: true };
}

export function guardMaxClubs(venueId, options = {}) {
  const base = guardSubscriptionForVenue(venueId, options);
  if (!base.ok) {
    return base;
  }

  if (!shouldEnforceSubscription(options) || !venueId) {
    return { ok: true };
  }

  const { plan } = getVenuePlanContext(venueId);
  const count = countClubsForVenue(venueId);

  if (count >= plan.maxClubs) {
    return {
      ok: false,
      error: `Gói hiện tại cho phép tối đa ${plan.maxClubs} CLB. Nâng cấp gói để thêm CLB.`,
      code: "PLAN_CLUB_LIMIT",
      maxClubs: plan.maxClubs,
      current: count,
      venueId,
    };
  }

  return { ok: true };
}

export function guardMaxCourtsForClub(clubId, { isNew = false } = {}, options = {}) {
  const club = getClubById(clubId);
  const venueId = club?.venueId;
  const base = guardSubscriptionForVenue(venueId, options);

  if (!base.ok) {
    return base;
  }

  if (!shouldEnforceSubscription(options) || !venueId) {
    return { ok: true };
  }

  const { plan } = getVenuePlanContext(venueId);
  let total = countCourtsForVenue(venueId);

  if (isNew) {
    total += 1;
  }

  if (total > plan.maxCourts) {
    return {
      ok: false,
      error: `Gói hiện tại cho phép tối đa ${plan.maxCourts} sân trên venue. Nâng cấp gói để thêm sân.`,
      code: "PLAN_COURT_LIMIT",
      maxCourts: plan.maxCourts,
      current: total,
      venueId,
    };
  }

  return { ok: true };
}

export function guardSubscriptionForClub(clubId, feature = null, options = {}) {
  const club = getClubById(clubId);
  const venueId = club?.venueId;
  const activeCheck = guardSubscriptionForVenue(venueId, options);

  if (!activeCheck.ok) {
    return activeCheck;
  }

  if (feature) {
    return guardPlanFeature(venueId, feature, options);
  }

  return { ok: true };
}

export function guardMaxUsers(venueId, options = {}) {
  const base = guardSubscriptionForVenue(venueId, options);
  if (!base.ok) {
    return base;
  }

  if (!shouldEnforceSubscription(options) || !venueId) {
    return { ok: true };
  }

  const { plan } = getVenuePlanContext(venueId);
  const count = countActiveStaffForVenue(venueId);

  if (count >= plan.maxUsers) {
    return {
      ok: false,
      error: `Gói hiện tại cho phép tối đa ${plan.maxUsers} user. Nâng cấp gói hoặc xóa nhân sự.`,
      code: "PLAN_USER_LIMIT",
      maxUsers: plan.maxUsers,
      current: count,
      venueId,
    };
  }

  return { ok: true };
}
