import { createElement } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupsIcon from "@mui/icons-material/Groups";
import StadiumIcon from "@mui/icons-material/Stadium";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import GridViewIcon from "@mui/icons-material/GridView";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PersonIcon from "@mui/icons-material/Person";
import EventNoteIcon from "@mui/icons-material/EventNote";
import BookOnlineIcon from "@mui/icons-material/BookOnline";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import TuneIcon from "@mui/icons-material/Tune";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import ContactsIcon from "@mui/icons-material/Contacts";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HistoryIcon from "@mui/icons-material/History";
import CategoryIcon from "@mui/icons-material/Category";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SpeedIcon from "@mui/icons-material/Speed";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ApartmentIcon from "@mui/icons-material/Apartment";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import NotificationsIcon from "@mui/icons-material/Notifications";
import StorefrontIcon from "@mui/icons-material/Storefront";
import GavelIcon from "@mui/icons-material/Gavel";
import AddIcon from "@mui/icons-material/Add";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";

/** Map iconKey → MUI icon component (fontSize handled by caller). */
export const NAV_ICON_COMPONENTS = Object.freeze({
  dashboard: DashboardIcon,
  calendar: CalendarMonthIcon,
  bookings: BookOnlineIcon,
  checkin: QrCodeScannerIcon,
  waiting: HourglassTopIcon,
  director: TuneIcon,
  status: MonitorHeartIcon,
  customers: ContactsIcon,
  players: PeopleIcon,
  skill: EmojiEventsIcon,
  history: HistoryIcon,
  groups: CategoryIcon,
  "club-list": GroupsIcon,
  "club-members": PeopleIcon,
  "club-schedule": EventNoteIcon,
  "club-internal": SportsTennisIcon,
  "tournament-list": GridViewIcon,
  "tournament-create": SportsTennisIcon,
  "tournament-register": PersonIcon,
  "tournament-pairing": ShuffleIcon,
  "tournament-draw": AccountTreeIcon,
  "tournament-schedule": CalendarMonthIcon,
  bracket: AccountTreeIcon,
  referee: GavelIcon,
  statistics: LeaderboardIcon,
  orders: ReceiptLongIcon,
  payments: PaymentsIcon,
  debt: AccountBalanceWalletIcon,
  subscription: CardMembershipIcon,
  transactions: SwapHorizIcon,
  "report-overview": AssessmentIcon,
  "report-revenue": TrendingUpIcon,
  "report-performance": SpeedIcon,
  "report-customers": ContactsIcon,
  "report-tournament": LeaderboardIcon,
  "report-peak": AccessTimeIcon,
  "ai-group": AutoAwesomeIcon,
  "ai-pairing": ShuffleIcon,
  "ai-scheduling": TuneIcon,
  "ai-time": AccessTimeIcon,
  "ai-validation": WarningAmberIcon,
  users: ManageAccountsIcon,
  roles: AdminPanelSettingsIcon,
  tenants: ApartmentIcon,
  courts: StadiumIcon,
  settings: SettingsIcon,
  audit: HistoryIcon,
  integrations: IntegrationInstructionsIcon,
  support: SupportAgentIcon,
  profile: PersonIcon,
  notifications: NotificationsIcon,
  coaches: PeopleIcon,
  messages: SupportAgentIcon,
  marketplace: StorefrontIcon,
  billing: CardMembershipIcon,
  "player-profile": PersonIcon,
  "my-club": GroupsIcon,
  "referee-hub": GavelIcon,
  "referee-tournaments": SportsTennisIcon,
  "mobile-player": PersonIcon,
  more: AddIcon,
  "referee-score": ScoreboardIcon,
});

export function getNavIcon(iconKey, fontSize = "small") {
  const Icon = NAV_ICON_COMPONENTS[iconKey] || DashboardIcon;
  if (typeof fontSize === "number") {
    return createElement(Icon, { sx: { fontSize } });
  }
  return createElement(Icon, { fontSize });
}

export function getNavIconComponent(iconKey) {
  return NAV_ICON_COMPONENTS[iconKey] || DashboardIcon;
}
