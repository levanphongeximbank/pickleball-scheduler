import { loadVenues, saveVenues, loadSubscriptions, saveSubscriptions } from "../data/venue.js";
import { PERMISSIONS } from "../auth/permissions.js";
import {
  guardClubAction,
  guardPermission,
} from "../auth/guardAction.js";
import { getCurrentUser, isRbacEnabled } from "../auth/authService.js";
import { createVenueRecord, normalizeVenue } from "../models/venue.js";
import {
  createSubscriptionRecord,
  normalizeSubscription,
  isSubscriptionActive,
  SUBSCRIPTION_PLANS,
  planIncludesFeature,
  normalizePlanId,
} from "../models/subscription.js";
import { renewSubscriptionPeriod } from "../features/subscription/index.js";
import { updateClubMeta, getClubById } from "./clubService.js";
import { guardMaxClubs } from "../auth/subscriptionGuard.js";
import {
  BILLING_STORE_MODES,
  getBillingStore,
  resolveBillingStoreMode,
} from "../features/billing/repositories/billingRepository.js";
import {
  getLegacySubscriptionForVenue,
  phase9SubscriptionToLegacy,
} from "../features/billing/bridges/subscriptionAccessBridge.js";
import { ensureCollection } from "../features/billing/services/billingStoreUtils.js";

export const DEMO_VENUE_ID = "venue-demo";

export function listVenues() {
  return loadVenues();
}

export function getVenueById(venueId) {
  return loadVenues().find((venue) => venue.id === venueId) || null;
}

export function getSubscriptionForVenue(venueId) {
  const id = String(venueId || "").trim();
  if (!id) {
    return null;
  }

  if (resolveBillingStoreMode() === BILLING_STORE_MODES.SUPABASE) {
    const fromBilling = getLegacySubscriptionForVenue(id);
    if (fromBilling) {
      return fromBilling;
    }
  }

  const map = loadSubscriptions();
  const raw = map[id];
  return raw ? normalizeSubscription(raw) : null;
}

/** Mirror Supabase billing subscriptions into legacy localStorage map. */
export function syncLegacySubscriptionsFromBilling() {
  if (resolveBillingStoreMode() !== BILLING_STORE_MODES.SUPABASE) {
    return { ok: true, changed: false };
  }

  const subscriptions = ensureCollection(getBillingStore(), "subscriptions", []);
  if (!subscriptions.length) {
    return { ok: true, changed: false };
  }

  const map = loadSubscriptions();
  let changed = false;

  for (const subscription of subscriptions) {
    const legacy = phase9SubscriptionToLegacy(subscription);
    if (!legacy?.venueId) {
      continue;
    }
    map[legacy.venueId] = legacy;
    changed = true;
  }

  if (changed) {
    saveSubscriptions(map);
  }

  return { ok: true, changed };
}

export function ensureDemoVenue() {
  const venues = loadVenues();

  if (venues.some((venue) => venue.id === DEMO_VENUE_ID)) {
    return { ok: true, venue: getVenueById(DEMO_VENUE_ID) };
  }

  const venue = createVenueRecord("Sân Demo", {
    id: DEMO_VENUE_ID,
    status: "trial",
  });

  saveVenues([...venues, venue]);

  const subscriptions = loadSubscriptions();
  if (!subscriptions[DEMO_VENUE_ID]) {
    subscriptions[DEMO_VENUE_ID] = createSubscriptionRecord(DEMO_VENUE_ID, "trial", {
      id: `sub-${DEMO_VENUE_ID}`,
    });
    saveSubscriptions(subscriptions);
  }

  return { ok: true, venue };
}

export function createVenue(name, options = {}) {
  if (isRbacEnabled()) {
    const sysCheck = guardPermission(PERMISSIONS.VENUE_UPDATE);
    const ownerCheck = guardPermission(PERMISSIONS.VENUE_UPDATE, {
      venueId: getCurrentUser()?.venueId || null,
    });

    if (!sysCheck.ok && !ownerCheck.ok) {
      return {
        ok: false,
        error: "Không có quyền tạo venue/tenant.",
        code: "FORBIDDEN",
      };
    }
  }

  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Tên sân không được để trống." };
  }

  const venue = createVenueRecord(trimmed, options);
  const venues = loadVenues();
  saveVenues([...venues, venue]);

  const subscriptions = loadSubscriptions();
  subscriptions[venue.id] = createSubscriptionRecord(
    venue.id,
    options.planId || "trial",
    { id: options.subscriptionId || `sub-${venue.id}` }
  );
  saveSubscriptions(subscriptions);

  return { ok: true, venue, subscription: subscriptions[venue.id] };
}

export function assignClubToVenue(clubId, venueId) {
  const clubCheck = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!clubCheck.ok) {
    return clubCheck;
  }

  if (isRbacEnabled()) {
    const sysCheck = guardPermission(PERMISSIONS.VENUE_UPDATE);
    const venueCheck = guardPermission(PERMISSIONS.VENUE_UPDATE, { venueId });

    if (!sysCheck.ok && !venueCheck.ok) {
      return {
        ok: false,
        error: "Không có quyền gán CLB vào venue này.",
        code: "FORBIDDEN",
      };
    }
  }

  const venue = getVenueById(venueId);
  if (!venue) {
    return { ok: false, error: "Không tìm thấy venue." };
  }

  const club = getClubById(clubId);
  if (club && club.venueId !== venueId) {
    const limitCheck = guardMaxClubs(venueId);
    if (!limitCheck.ok) {
      return limitCheck;
    }
  }

  return updateClubMeta(clubId, { venueId });
}

export function getVenueSummaryForClub(clubId) {
  const club = getClubById(clubId);
  const venue = club?.venueId ? getVenueById(club.venueId) : null;
  const subscription = club?.venueId ? getSubscriptionForVenue(club.venueId) : null;

  return {
    club,
    venue,
    subscription,
    subscriptionActive: isSubscriptionActive(subscription),
  };
}

export function getSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

export function upgradeSubscription(venueId, planId) {
  if (isRbacEnabled()) {
    const sysCheck = guardPermission(PERMISSIONS.SUBSCRIPTION_UPDATE);
    const ownerCheck = guardPermission(PERMISSIONS.SUBSCRIPTION_VIEW, { venueId });
    const manageCheck = guardPermission(PERMISSIONS.VENUE_UPDATE, { venueId });

    if (!sysCheck.ok && !ownerCheck.ok && !manageCheck.ok) {
      return {
        ok: false,
        error: "Không có quyền nâng cấp gói thuê.",
        code: "FORBIDDEN",
      };
    }
  }

  const canonical = normalizePlanId(planId);
  const plan = SUBSCRIPTION_PLANS[canonical];
  if (!plan) {
    return { ok: false, error: "Gói không hợp lệ." };
  }

  const venue = getVenueById(venueId);
  if (!venue) {
    return { ok: false, error: "Không tìm thấy venue." };
  }

  const renewed = renewSubscriptionPeriod(venueId, { planId: canonical });
  if (!renewed.ok) {
    return renewed;
  }

  const subscriptions = loadSubscriptions();
  const existing = subscriptions[venueId];
  if (existing && !existing.id) {
    subscriptions[venueId] = { ...renewed.subscription, id: `sub-${venueId}` };
    saveSubscriptions(subscriptions);
  }

  const venues = loadVenues().map((item) =>
    item.id === venueId
      ? normalizeVenue({
          ...item,
          subscriptionId: renewed.subscription.id,
          status: canonical === "trial" ? "trial" : "active",
          updatedAt: new Date().toISOString(),
        })
      : item
  );
  saveVenues(venues);

  return {
    ok: true,
    subscription: renewed.subscription,
    plan,
    features: plan.features,
    hasDirectorMode: planIncludesFeature(canonical, "director_mode"),
  };
}
