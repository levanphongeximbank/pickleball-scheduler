import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import GavelIcon from "@mui/icons-material/Gavel";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SettingsIcon from "@mui/icons-material/Settings";

import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { ROLES } from "../../identity/constants/roles.js";

/** Primary bottom-nav items (mobile). */
export const MOBILE_BOTTOM_NAV = [
  {
    key: "dashboard",
    label: "Tổng quan",
    path: "/",
    icon: DashboardIcon,
    match: "exact",
    permissions: [
      PERMISSIONS.STATISTICS_VIEW,
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.BOOKING_VIEW,
    ],
    excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
  },
  {
    key: "players",
    label: "VĐV",
    path: "/players",
    icon: PeopleIcon,
    permissions: [PERMISSIONS.PLAYER_VIEW],
    excludeRoles: [ROLES.REFEREE, ROLES.CASHIER],
  },
  {
    key: "checkin",
    label: "Quét QR",
    path: "/mobile/check-in",
    icon: QrCodeScannerIcon,
    permissions: [PERMISSIONS.TOURNAMENT_VIEW],
    excludeRoles: [ROLES.PLAYER],
  },
  {
    key: "tournament",
    label: "Giải",
    path: "/tournament",
    icon: SportsTennisIcon,
    match: "tournament-home",
    permissions: [PERMISSIONS.TOURNAMENT_VIEW],
  },
  {
    key: "player-home",
    label: "Của tôi",
    path: "/mobile/player",
    icon: PersonIcon,
    roles: [ROLES.PLAYER, ROLES.CLUB_OWNER, ROLES.REFEREE],
  },
];

/** Referee-focused bottom nav override. */
export const MOBILE_REFEREE_NAV = [
  {
    key: "referee",
    label: "Chấm trận",
    path: "/referee",
    icon: GavelIcon,
    permissions: [PERMISSIONS.MATCH_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
  },
  {
    key: "checkin",
    label: "Check-in",
    path: "/mobile/check-in",
    icon: QrCodeScannerIcon,
    permissions: [PERMISSIONS.TOURNAMENT_VIEW],
  },
  {
    key: "player-home",
    label: "Của tôi",
    path: "/mobile/player",
    icon: PersonIcon,
    roles: [ROLES.REFEREE],
  },
];

/** Drawer quick links — filtered by permission. */
export const MOBILE_QUICK_LINKS = [
  {
    key: "operations",
    label: "Dashboard vận hành",
    path: "/mobile/operations",
    icon: DashboardIcon,
    permissions: [
      PERMISSIONS.BOOKING_VIEW,
      PERMISSIONS.COURT_VIEW,
      PERMISSIONS.FINANCE_VIEW,
    ],
    excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
  },
  {
    key: "qr-scan",
    label: "Quét QR Check-in",
    path: "/mobile/qr-scan",
    permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE],
    excludeRoles: [ROLES.PLAYER],
  },
  {
    key: "notifications",
    label: "Thông báo",
    path: "/mobile/notifications",
    icon: NotificationsIcon,
  },
  {
    key: "settings",
    label: "Cài đặt",
    path: "/settings",
    icon: SettingsIcon,
    permissions: [PERMISSIONS.SETTINGS_VIEW],
    excludeRoles: [ROLES.REFEREE],
  },
];

export const MOBILE_DRAWER_WIDTH = 280;
export const MOBILE_BREAKPOINT = "md";
