import { PERMISSIONS } from "../auth/permissions.js";

export const COURT_MANAGEMENT_TABS = [
  {
    key: "status",
    label: "Trạng thái sân",
    path: "/court-management",
    permissions: [PERMISSIONS.COURTS_VIEW],
  },
  {
    key: "calendar",
    label: "Lịch sân",
    path: "/court-management/calendar",
    permissions: [PERMISSIONS.BOOKINGS_VIEW],
  },
  {
    key: "bookings",
    label: "Booking",
    path: "/court-management/bookings",
    permissions: [PERMISSIONS.BOOKINGS_VIEW],
  },
  {
    key: "revenue",
    label: "Doanh thu",
    path: "/court-management/revenue",
    permissions: [PERMISSIONS.REVENUE_VIEW, PERMISSIONS.ACCOUNTING_VIEW],
  },
  {
    key: "customers",
    label: "Khách hàng",
    path: "/court-management/customers",
    permissions: [PERMISSIONS.CUSTOMERS_VIEW],
  },
  {
    key: "courts",
    label: "Danh sách sân",
    path: "/court-management/courts",
    permissions: [PERMISSIONS.COURTS_VIEW],
  },
  {
    key: "future",
    label: "Cài đặt & Mở rộng",
    path: "/court-management/future",
    permissions: [PERMISSIONS.COURTS_MANAGE, PERMISSIONS.VENUE_MANAGE],
  },
];
