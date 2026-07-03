import { lazy, Suspense } from "react";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Box, CircularProgress } from "@mui/material";



import MainLayout from "./layouts/MainLayout";

import { AuthProvider } from "./context/AuthContext.jsx";



const LoginPage = lazy(() => import("./pages/LoginPage"));

const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));

const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));



const Dashboard = lazy(() => import("./pages/Dashboard"));

const Players = lazy(() => import("./pages/Players"));

const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));

const SelectPlayers = lazy(() => import("./pages/SelectPlayers"));

const ClubManagement = lazy(() => import("./pages/ClubManagement"));
const ClubListPage = lazy(() => import("./pages/clubs/ClubListPage"));
const ClubDetailPage = lazy(() => import("./pages/clubs/ClubDetailPage"));

const Tournament = lazy(() => import("./pages/tournament/TournamentShell"));

const DailyPlayLauncher = lazy(() => import("./pages/tournament/DailyPlayLauncher"));

const DailyPlaySetup = lazy(() => import("./pages/tournament/DailyPlaySetup"));

const InternalTournamentSetup = lazy(() => import("./pages/tournament/InternalTournamentSetup"));

const OfficialTournamentSetup = lazy(() => import("./pages/tournament/OfficialTournamentSetup"));

const TournamentBracketPage = lazy(() => import("./pages/tournament/TournamentBracketPage"));

const TournamentBracketHub = lazy(() => import("./pages/tournament/TournamentBracketHub"));

const TournamentDirectorMode = lazy(() => import("./pages/tournament/TournamentDirectorMode"));

const TournamentEnginePage = lazy(() => import("./pages/tournament/TournamentEnginePage"));

const RefereeScoreboard = lazy(() => import("./pages/referee/RefereeScoreboard"));

const RefereeHub = lazy(() => import("./pages/referee/RefereeHub"));

const RefereeSessionScoreboard = lazy(() => import("./pages/referee/RefereeSessionScoreboard"));

const CourtEnginePage = lazy(() => import("./pages/CourtEnginePage"));

const Statistics = lazy(() => import("./features/statistics"));

const Settings = lazy(() => import("./pages/Settings"));

const MyProfilePage = lazy(() => import("./pages/MyProfilePage"));

const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));

const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));

const TenantManagement = lazy(() => import("./pages/admin/TenantManagement"));

const CheckInDashboardPage = lazy(() => import("./pages/mobile/CheckInDashboardPage"));
const QrScanPage = lazy(() => import("./pages/mobile/QrScanPage"));
const QrGeneratePage = lazy(() => import("./pages/mobile/QrGeneratePage"));
const PlayerHomePage = lazy(() => import("./pages/mobile/PlayerHomePage"));
const OperationsMobileDashboardPage = lazy(() => import("./pages/mobile/OperationsMobileDashboardPage"));
const NotificationSettingsPage = lazy(() => import("./pages/mobile/NotificationSettingsPage"));
const MobileRouteGate = lazy(() => import("./features/mobile/guards/MobileRouteGate.jsx"));
const IntegrationSettingsPage = lazy(() => import("./pages/settings/IntegrationSettingsPage"));
const IntegrationPaymentsPage = lazy(() => import("./pages/settings/IntegrationPaymentsPage"));
const ZaloIntegrationPage = lazy(() => import("./pages/settings/ZaloIntegrationPage"));
const MarketplacePage = lazy(() => import("./pages/marketplace/MarketplacePage"));
const MarketplaceProductPage = lazy(() => import("./pages/marketplace/MarketplaceProductPage"));
const MarketplaceOrdersPage = lazy(() => import("./pages/marketplace/MarketplaceOrdersPage"));
const AdminMarketplacePage = lazy(() => import("./pages/admin/AdminMarketplacePage"));
const AdminIntegrationMonitoringPage = lazy(() =>
  import("./pages/admin/AdminIntegrationMonitoringPage")
);
const BillingPage = lazy(() => import("./pages/billing/BillingPage"));
const AdminBillingPage = lazy(() => import("./pages/admin/AdminBillingPage"));

const CourtManagementLayout = lazy(() => import("./pages/courtManagement/CourtManagementLayout"));

const CourtManagementHome = lazy(() => import("./pages/courtManagement/CourtManagementHome"));

const CourtManagementCalendarPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCalendarPage")

);

const CourtManagementBookingsPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementBookingsPage")

);

const CourtManagementRevenuePage = lazy(() =>

  import("./pages/courtManagement/CourtManagementRevenuePage")

);

const CourtManagementCustomersPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCustomersPage")

);

const CourtManagementCourtsPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCourtsPage")

);

const CourtManagementFuturePage = lazy(() =>

  import("./pages/courtManagement/CourtManagementFuturePage")

);



function RouterFallback() {

  return (

    <Box

      sx={{

        minHeight: "50vh",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

      }}

    >

      <CircularProgress size={28} />

    </Box>

  );

}



export default function Router() {

  return (

    <BrowserRouter>

      <AuthProvider>

        <Suspense fallback={<RouterFallback />}>

          <Routes>

            <Route path="/login" element={<LoginPage />} />

            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/coming-soon/:moduleKey" element={<ComingSoonPage />} />

            <Route path="/referee/:token" element={<RefereeScoreboard />} />

            <Route element={<MainLayout />}>

            <Route path="/" element={<Dashboard />} />

            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/players" element={<Players />} />

            <Route path="/players/profile/:playerId" element={<PlayerProfile />} />

            <Route path="/profile" element={<MyProfilePage />} />

            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/audit" element={<AuditLogPage />} />

            <Route path="/referee" element={<RefereeHub />} />

            <Route path="/referee/match/:matchId" element={<RefereeSessionScoreboard />} />

            <Route path="/courts" element={<Navigate to="/court-management/courts" replace />} />

            <Route path="/court-management" element={<CourtManagementLayout />}>

              <Route index element={<CourtManagementHome />} />

              <Route path="calendar" element={<CourtManagementCalendarPage />} />

              <Route path="bookings" element={<CourtManagementBookingsPage />} />

              <Route path="revenue" element={<CourtManagementRevenuePage />} />

              <Route path="customers" element={<CourtManagementCustomersPage />} />

              <Route path="courts" element={<CourtManagementCourtsPage />} />

              <Route path="future" element={<CourtManagementFuturePage />} />

            </Route>

            <Route path="/select-players" element={<SelectPlayers />} />

            <Route path="/clubs" element={<ClubListPage />} />
            <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
            <Route path="/club" element={<ClubManagement />} />

            <Route path="/tournament" element={<Tournament />} />

            <Route path="/tournament/bracket" element={<TournamentBracketHub />} />

            <Route path="/daily-play" element={<DailyPlayLauncher />} />

            <Route path="/tournament/daily/:tournamentId" element={<DailyPlaySetup />} />

            <Route

              path="/tournament/internal/:tournamentId"

              element={<InternalTournamentSetup />}

            />

            <Route

              path="/tournament/internal/:tournamentId/bracket"

              element={<TournamentBracketPage />}

            />

            <Route

              path="/tournament/official/:tournamentId/bracket"

              element={<TournamentBracketPage />}

            />

            <Route

              path="/tournament/official/:tournamentId"

              element={<OfficialTournamentSetup />}

            />

            <Route

              path="/tournament/director/:tournamentId"

              element={<TournamentDirectorMode />}

            />

            <Route path="/tournaments/:tournamentId/engine" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/seed" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/draw" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/schedule" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/courts" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/ranking" element={<TournamentEnginePage />} />
            <Route path="/tournaments/:tournamentId/logs" element={<TournamentEnginePage />} />

            <Route path="/court-engine" element={<CourtEnginePage />} />

            <Route path="/statistics" element={<Statistics />} />

            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/integrations" element={<IntegrationSettingsPage />} />
            <Route path="/settings/integrations/payments" element={<IntegrationPaymentsPage />} />
            <Route path="/settings/integrations/zalo-oa" element={<ZaloIntegrationPage />} />

            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/marketplace/orders" element={<MarketplaceOrdersPage />} />
            <Route path="/marketplace/:productId" element={<MarketplaceProductPage />} />

            <Route path="/admin/tenants" element={<TenantManagement />} />
            <Route path="/admin/marketplace" element={<AdminMarketplacePage />} />
            <Route path="/admin/marketplace/products" element={<AdminMarketplacePage />} />
            <Route path="/admin/marketplace/orders" element={<AdminMarketplacePage />} />
            <Route path="/admin/integration-logs" element={<AdminIntegrationMonitoringPage />} />
            <Route path="/admin/payment-transactions" element={<AdminIntegrationMonitoringPage />} />
            <Route path="/admin/api-clients" element={<AdminIntegrationMonitoringPage />} />
            <Route path="/admin/api-logs" element={<AdminIntegrationMonitoringPage />} />
            <Route path="/admin/webhook-events" element={<AdminIntegrationMonitoringPage />} />

            <Route path="/billing" element={<BillingPage />} />
            <Route path="/billing/current-plan" element={<BillingPage title="Gói hiện tại" view="current-plan" />} />
            <Route path="/billing/usage" element={<BillingPage title="Usage" view="usage" />} />
            <Route path="/billing/invoices" element={<BillingPage title="Invoices" view="invoices" />} />
            <Route path="/billing/payment" element={<BillingPage title="Payment" view="payment" />} />
            <Route path="/billing/upgrade" element={<BillingPage title="Upgrade" view="upgrade" />} />
            <Route path="/billing/support" element={<BillingPage title="Support" view="support" />} />

            <Route path="/admin/billing" element={<AdminBillingPage />} />
            <Route path="/admin/billing/tenants" element={<AdminBillingPage view="tenants" />} />
            <Route path="/admin/billing/plans" element={<AdminBillingPage view="plans" />} />
            <Route path="/admin/billing/invoices" element={<AdminBillingPage view="invoices" />} />
            <Route path="/admin/billing/payments" element={<AdminBillingPage view="payments" />} />
            <Route path="/admin/billing/audit" element={<AdminBillingPage view="audit" />} />

            <Route path="/mobile" element={<MobileRouteGate />}>
              <Route path="check-in" element={<CheckInDashboardPage />} />
              <Route path="qr-scan" element={<QrScanPage />} />
              <Route path="qr-generate" element={<QrGeneratePage />} />
              <Route path="player" element={<PlayerHomePage />} />
              <Route path="operations" element={<OperationsMobileDashboardPage />} />
              <Route path="notifications" element={<NotificationSettingsPage />} />
            </Route>

          </Route>

        </Routes>

        </Suspense>

      </AuthProvider>

    </BrowserRouter>

  );

}


