import { loadCourtsForClub } from "../../../domain/clubStorage.js";
import { listBookingsForDate } from "../../../domain/bookingService.js";
import { listTournaments } from "../../../domain/tournamentService.js";
import { getCheckinDashboard } from "./checkInService.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function timeToMinutes(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function buildCourtStatus(bookings, courts, nowMinutes) {
  const courtMap = new Map((courts || []).map((c) => [String(c.id), c]));
  const statusByCourt = {};

  (courts || []).forEach((court) => {
    statusByCourt[court.id] = {
      courtId: court.id,
      courtName: court.name || court.number || court.id,
      state: "idle",
      bookingId: null,
      endsInMinutes: null,
    };
  });

  (bookings || []).forEach((booking) => {
    const courtId = String(booking.courtId);
    const start = timeToMinutes(booking.startTime);
    const end = timeToMinutes(booking.endTime);
    if (nowMinutes >= start && nowMinutes < end) {
      statusByCourt[courtId] = {
        courtId,
        courtName: courtMap.get(courtId)?.name || courtId,
        state: "playing",
        bookingId: booking.id,
        endsInMinutes: Math.max(0, end - nowMinutes),
      };
    } else if (nowMinutes < start && start - nowMinutes <= 60) {
      const current = statusByCourt[courtId];
      if (current?.state === "idle") {
        statusByCourt[courtId] = {
          ...current,
          state: "upcoming",
          bookingId: booking.id,
          startsInMinutes: start - nowMinutes,
        };
      }
    }
  });

  return Object.values(statusByCourt);
}

export function canAccessOperationsDashboard(user, scope = {}) {
  if (!user) {
    return false;
  }
  const role = normalizeRole(user.role);
  const allowedRoles = [
    ROLES.PLATFORM_ADMIN,
    ROLES.TENANT_OWNER,
    ROLES.VENUE_MANAGER,
    ROLES.CASHIER,
  ];
  if (!allowedRoles.includes(role)) {
    return false;
  }
  if (!isRbacEnabled()) {
    return true;
  }
  return (
    can(user, PERMISSIONS.BOOKING_VIEW, scope, { rbacEnabled: true }) ||
    can(user, PERMISSIONS.COURT_VIEW, scope, { rbacEnabled: true }) ||
    can(user, PERMISSIONS.FINANCE_VIEW, scope, { rbacEnabled: true })
  );
}

export function getOperationsDashboardMode(user) {
  const role = normalizeRole(user?.role);
  if (role === ROLES.CASHIER) {
    return "cashier";
  }
  if (role === ROLES.VENUE_MANAGER) {
    return "staff";
  }
  if (role === ROLES.TENANT_OWNER || role === ROLES.PLATFORM_ADMIN) {
    return "owner";
  }
  return "staff";
}

export async function loadOperationsDashboard({
  clubId,
  tenantId,
  user,
  subscriptionWarning = null,
} = {}) {
  if (!clubId) {
    return { ok: false, error: "Chưa chọn CLB.", code: "NO_CLUB" };
  }

  const today = todayIsoDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const courts = loadCourtsForClub(clubId);
  const bookings = listBookingsForDate(today, clubId);
  const tournaments = (listTournaments(clubId) || []).filter(
    (t) => t.status === "active" || t.status === "ready"
  );

  const checkinResult = await getCheckinDashboard({ tenantId, clubId });
  const checkinsToday = checkinResult.ok ? (checkinResult.checkins || []).length : 0;

  const courtStatus = buildCourtStatus(bookings, courts, nowMinutes);
  const playingCourts = courtStatus.filter((c) => c.state === "playing");
  const idleCourts = courtStatus.filter((c) => c.state === "idle");
  const endingSoon = playingCourts.filter((c) => c.endsInMinutes != null && c.endsInMinutes <= 30);

  const paidToday = bookings
    .filter((b) => b.paymentStatus === "paid" || b.status === "paid")
    .reduce((sum, b) => sum + Number(b.totalAmount || b.amount || 0), 0);

  const unpaidBookings = bookings.filter(
    (b) => b.paymentStatus !== "paid" && b.status !== "cancelled"
  );

  const mode = getOperationsDashboardMode(user);

  return {
    ok: true,
    mode,
    date: today,
    metrics: {
      bookingsToday: bookings.length,
      courtsPlaying: playingCourts.length,
      courtsIdle: idleCourts.length,
      courtsEndingSoon: endingSoon.length,
      checkinsToday,
      revenueToday: paidToday,
      activeTournaments: tournaments.length,
    },
    bookings: bookings.slice(0, 20),
    unpaidBookings: mode === "cashier" ? unpaidBookings.slice(0, 15) : [],
    courtStatus,
    tournaments: tournaments.slice(0, 5),
    subscriptionWarning,
    quickActions: {
      canCreateBooking:
        !isRbacEnabled() ||
        can(user, PERMISSIONS.BOOKING_CREATE, { clubId, tenantId }, { rbacEnabled: true }),
      canCheckIn:
        !isRbacEnabled() ||
        can(user, PERMISSIONS.TOURNAMENT_VIEW, { clubId, tenantId }, { rbacEnabled: true }),
      canRecordPayment:
        mode === "cashier" &&
        (!isRbacEnabled() ||
          can(user, PERMISSIONS.FINANCE_EDIT, { clubId, tenantId }, { rbacEnabled: true })),
      canManageBilling: false,
    },
  };
}
