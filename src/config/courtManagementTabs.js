import { PERMISSIONS } from "../auth/permissions.js";

export const COURT_MANAGEMENT_TABS = [
  {
    key: "home",
    label: "Tổng quan",
    path: "/court-management",
    permissions: [PERMISSIONS.COURT_VIEW],
  },
  {
    key: "calendar",
    label: "Lịch",
    path: "/court-management/calendar",
    permissions: [PERMISSIONS.BOOKING_VIEW],
  },
  {
    key: "bookings",
    label: "Đặt sân",
    path: "/court-management/bookings",
    permissions: [PERMISSIONS.BOOKING_VIEW],
  },
  {
    key: "revenue",
    label: "Doanh thu",
    path: "/court-management/revenue",
    permissions: [PERMISSIONS.FINANCE_VIEW],
  },
  {
    key: "customers",
    label: "Khách hàng",
    path: "/court-management/customers",
    permissions: [PERMISSIONS.CUSTOMER_VIEW],
  },
  {
    key: "members",
    label: "Hội viên",
    path: "/court-management/members",
    permissions: [PERMISSIONS.CUSTOMER_VIEW],
  },
  {
    key: "courts",
    label: "Sân",
    path: "/court-management/courts",
    permissions: [PERMISSIONS.COURT_VIEW],
  },
  {
    key: "future",
    label: "Tính năng tương lai",
    path: "/court-management/future",
    permissions: [PERMISSIONS.COURT_UPDATE, PERMISSIONS.VENUE_UPDATE],
  },
];
