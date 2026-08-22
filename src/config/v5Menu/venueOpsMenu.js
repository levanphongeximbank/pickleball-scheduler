import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLES } from "../../auth/roles.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

/** Sidebar phẳng — tối đa 2 cấp. */
export const VENUE_OPS_MENU_ROOT = menuFolder({
  key: "venue-ops-root",
  icon: "director",
  text: "Vận hành sân",
  children: [
    menuLeaf({
      key: "venue-calendar",
      icon: "calendar",
      text: "Lịch sân",
      path: "/court-management/calendar",
      match: "court-calendar",
      permissions: [PERMISSIONS.BOOKING_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "venue-bookings",
      icon: "bookings",
      text: "Đặt sân",
      path: "/court-management/bookings",
      match: "court-bookings",
      permissions: [PERMISSIONS.BOOKING_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "venue-checkin",
      icon: "checkin",
      text: "Check-in",
      path: "/mobile/check-in",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      // Batch 1B: CASHIER IA excludes tournament check-in / waitlist / director chrome.
      excludeRoles: [ROLES.PLAYER, ROLES.CASHIER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "venue-waiting",
      icon: "waiting",
      text: "Danh sách chờ",
      path: "/select-players",
      permissions: [PERMISSIONS.SCHEDULING_VIEW, PERMISSIONS.SCHEDULING_RUN],
      excludeRoles: [ROLES.CASHIER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "venue-courts",
      icon: "courts",
      text: "Quản lý sân",
      path: "/court-management/courts",
      match: "court-courts",
      permissions: [PERMISSIONS.COURT_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "venue-director",
      icon: "director",
      text: "Điều phối sân",
      path: "/court-engine",
      match: "court-engine",
      permissions: [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
      excludeRoles: [ROLES.CASHIER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
