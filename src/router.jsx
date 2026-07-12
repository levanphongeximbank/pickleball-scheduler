import { lazy, Suspense } from "react";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Box, CircularProgress } from "@mui/material";



import MainLayout from "./layouts/MainLayout";
import SuperAdminRouteGuard from "./features/pairing-constraints/guards/superAdminRouteGuard.jsx";

import { AuthProvider } from "./context/AuthContext.jsx";
import { MyClubMembershipRootProvider } from "./features/club/hooks/MyClubMembershipContext.jsx";



const LoginPage = lazy(() => import("./pages/LoginPage"));

const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));

const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ForceChangePasswordPage = lazy(() => import("./pages/ForceChangePasswordPage"));

const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));

const PublicLayout = lazy(() => import("./layouts/public/PublicLayout.jsx"));
const PublicRootPage = lazy(() => import("./pages/public/PublicRootPage.jsx"));
const HomePage = lazy(() => import("./pages/public/HomePage.jsx"));
const PublicTournamentsPage = lazy(() => import("./pages/public/TournamentsPage.jsx"));
const PublicClubsPage = lazy(() => import("./pages/public/ClubsPage.jsx"));
const PublicCourtsPage = lazy(() => import("./pages/public/CourtsPage.jsx"));
const PublicRankingsPage = lazy(() => import("./pages/public/RankingsPage.jsx"));
const PublicNewsPage = lazy(() => import("./pages/public/NewsPage.jsx"));



const Dashboard = lazy(() => import("./pages/Dashboard"));

const Players = lazy(() => import("./pages/Players"));

const SkillLevelsPage = lazy(() => import("./pages/SkillLevelsPage"));

const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));

const SelectPlayers = lazy(() => import("./pages/SelectPlayers"));

const ClubManagement = lazy(() => import("./pages/ClubManagement"));
const ClubListPage = lazy(() => import("./pages/clubs/ClubListPage"));
const PlatformClubsPage = lazy(() => import("./pages/platform/PlatformClubsPage"));
const ClubDetailPage = lazy(() => import("./pages/clubs/ClubDetailPage"));

const Tournament = lazy(() => import("./pages/tournament/TournamentShell"));
const TournamentListPage = lazy(() => import("./pages/tournament/TournamentListPage"));
const TournamentCreatePage = lazy(() => import("./pages/tournament/TournamentCreatePage"));
const TournamentTypePage = lazy(() =>
  import("./pages/tournament/hubs/TournamentSectionPages.jsx").then((m) => ({
    default: m.TournamentTypePage,
  }))
);
const TournamentRegisterHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentRegisterHub,
  }))
);
const TournamentTeamsHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamsHub,
  }))
);
const TournamentTeamPresetsHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamPresetsHub,
  }))
);
const TournamentTeamBuildManualHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamBuildManualHub,
  }))
);
const TournamentTeamBuildRandomHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamBuildRandomHub,
  }))
);
const TournamentTeamBuildDraftHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamBuildDraftHub,
  }))
);
const TournamentTeamEligibilityHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentTeamEligibilityHub,
  }))
);
const TournamentScheduleHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentScheduleHub,
  }))
);
const TournamentMatchReportsHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentMatchReportsHub,
  }))
);
const TournamentConfigFormatHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentConfigFormatHub,
  }))
);
const TournamentConfigSettingsHub = lazy(() =>
  import("./pages/tournament/hubs/TournamentHubPages.jsx").then((m) => ({
    default: m.TournamentConfigSettingsHub,
  }))
);
const TournamentTypesHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentTypesHubPage,
  }))
);
const TournamentRosterHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentRosterHubPage,
  }))
);
const TournamentOrganizeHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentOrganizeHubPage,
  }))
);
const TournamentOperationsHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentOperationsHubPage,
  }))
);
const TournamentResultsHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentResultsHubPage,
  }))
);
const TournamentConfigHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.TournamentConfigHubPage,
  }))
);
const ReportsHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.ReportsHubPage,
  }))
);
const AiHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.AiHubPage,
  }))
);
const SupportHubPage = lazy(() =>
  import("./pages/tournament/hubs/TournamentNavHubPages.jsx").then((m) => ({
    default: m.SupportHubPage,
  }))
);

const DailyPlayLauncher = lazy(() => import("./pages/tournament/DailyPlayLauncher"));

const DailyPlaySetup = lazy(() => import("./pages/tournament/DailyPlaySetup"));

const InternalTournamentSetup = lazy(() => import("./pages/tournament/InternalTournamentSetup"));

const OfficialTournamentSetup = lazy(() => import("./pages/tournament/OfficialTournamentSetup"));

const TeamTournamentSetup = lazy(() => import("./pages/tournament/TeamTournamentSetup"));
const TeamPortal = lazy(() => import("./pages/tournament/TeamPortal"));
const TeamRefereePortal = lazy(() => import("./pages/tournament/TeamRefereePortal"));

const TournamentEligibilityPage = lazy(() =>
  import("./pages/tournament/config/TournamentEligibilityPage.jsx")
);
const TournamentAgeRulesPage = lazy(() =>
  import("./pages/tournament/config/TournamentAgeRulesPage.jsx")
);
const TournamentGenderRulesPage = lazy(() =>
  import("./pages/tournament/config/TournamentGenderRulesPage.jsx")
);
const TournamentFeePage = lazy(() => import("./pages/tournament/config/TournamentFeePage.jsx"));
const TournamentRegulationsPage = lazy(() =>
  import("./pages/tournament/config/TournamentRegulationsPage.jsx")
);
const TournamentRefereeAssignPage = lazy(() =>
  import("./pages/tournament/TournamentRefereeAssignPage.jsx")
);
const TournamentAwardsPage = lazy(() => import("./pages/tournament/TournamentAwardsPage.jsx"));
const TournamentWithdrawalPage = lazy(() =>
  import("./pages/tournament/TournamentWithdrawalPage.jsx")
);
const TournamentPublishSchedulePage = lazy(() =>
  import("./pages/tournament/TournamentPublishSchedulePage.jsx")
);

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

const SelfProfilePage = lazy(() => import("./pages/SelfProfilePage"));

const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));

const RolesPermissionsPage = lazy(() => import("./pages/admin/RolesPermissionsPage"));

const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));

const TenantManagement = lazy(() => import("./pages/admin/TenantManagement"));
const CourtClusterManagement = lazy(() => import("./pages/admin/CourtClusterManagement"));

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
const VenueHoursPage = lazy(() => import("./pages/admin/VenueHoursPage"));
const SkillLevelRequestsPage = lazy(() => import("./pages/admin/SkillLevelRequestsPage"));
const MyClubPage = lazy(() => import("./pages/player/MyClubPage.jsx"));
const DiscoverClubsPage = lazy(() => import("./pages/player/DiscoverClubsPage.jsx"));
const MyClubRequestsPage = lazy(() => import("./pages/player/MyClubRequestsPage.jsx"));
const AthleteSelfProfilePage = lazy(() => import("./pages/player/AthleteSelfProfilePage.jsx"));
const PlayerSkillOverviewPage = lazy(() => import("./pages/player/PlayerSkillOverviewPage.jsx"));
const FirstSkillAssessmentPage = lazy(() => import("./pages/player/FirstSkillAssessmentPage.jsx"));
const SkillAssessmentV5Page = lazy(() => import("./pages/player/SkillAssessmentV5Page.jsx"));
const TournamentCertificationQueuePage = lazy(() =>
  import("./pages/admin/TournamentCertificationQueuePage")
);
const RankingManagementPage = lazy(() => import("./pages/admin/RankingManagementPage"));
const StaffListPage = lazy(() => import("./pages/admin/StaffListPage"));

const CoachesPage = lazy(() => import("./pages/coaching/CoachesPage"));
const StudentsPage = lazy(() => import("./pages/coaching/StudentsPage"));
const ClassesPage = lazy(() => import("./pages/coaching/ClassesPage"));
const CoachSchedulePage = lazy(() => import("./pages/coaching/CoachSchedulePage"));
const CoachPackagesPage = lazy(() => import("./pages/coaching/CoachPackagesPage"));
const CoachAttendancePage = lazy(() => import("./pages/coaching/CoachAttendancePage"));
const CoachEvaluationPage = lazy(() => import("./pages/coaching/CoachEvaluationPage"));
const CoachListPage = lazy(() => import("./pages/coaching/CoachListPage"));
const CoachPackageRegisterPage = lazy(() => import("./pages/coaching/CoachPackageRegisterPage"));

const SupportGuidePage = lazy(() => import("./pages/support/SupportGuidePage"));
const SupportFaqPage = lazy(() => import("./pages/support/SupportFaqPage"));

const FinanceDebtPage = lazy(() => import("./features/finance-ledger/pages/FinanceDebtPage.jsx"));
const FinanceReceiptsPage = lazy(() => import("./features/finance-ledger/pages/FinanceReceiptsPage.jsx"));
const FinanceRefundsPage = lazy(() => import("./features/finance-ledger/pages/FinanceRefundsPage.jsx"));

const CrmMessagesPage = lazy(() => import("./features/crm/pages/CrmMessagesPage.jsx"));
const CrmTemplatesPage = lazy(() => import("./features/crm/pages/CrmTemplatesPage.jsx"));
const CrmCampaignsPage = lazy(() => import("./features/crm/pages/CrmCampaignsPage.jsx"));
const CrmContactHistoryPage = lazy(() => import("./features/crm/pages/CrmContactHistoryPage.jsx"));
const CrmBookingReminderPage = lazy(() => import("./features/crm/pages/CrmBookingReminderPage.jsx"));

const CourtManagementLayout = lazy(() => import("./pages/courtManagement/CourtManagementLayout"));

const CourtManagementHome = lazy(() => import("./pages/courtManagement/CourtManagementHome"));

const CourtManagementCalendarPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCalendarPage")

);

const CourtCalendarPreviewPage = lazy(() =>

  import("./pages/courtManagement/calendar/CourtCalendarPreviewPage")

);

const PairingInterventionPreviewPage = lazy(() =>

  import("./pages/dev/PairingInterventionPreviewPage")

);

const RefereeV5PreviewPage = lazy(() => import("./pages/dev/RefereeV5PreviewPage"));

const CourtManagementBookingsPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementBookingsPage")

);

const CourtManagementRevenuePage = lazy(() =>

  import("./pages/courtManagement/CourtManagementRevenuePage")

);

const CourtManagementCustomersPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCustomersPage")

);

const CourtManagementMembersPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementMembersPage")

);

const CourtManagementCourtsPage = lazy(() =>

  import("./pages/courtManagement/CourtManagementCourtsPage")

);

const CourtManagementFuturePage = lazy(() =>

  import("./pages/courtManagement/CourtManagementFuturePage")

);

const CustomerGroupsPage = lazy(() => import("./pages/courtManagement/CustomerGroupsPage.jsx"));

const CourtOpsLogPage = lazy(() => import("./pages/courtManagement/CourtOpsLogPage.jsx"));



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

        <MyClubMembershipRootProvider>

        <Suspense fallback={<RouterFallback />}>

          <Routes>

            <Route path="/login" element={<LoginPage />} />

            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/change-password" element={<ForceChangePasswordPage />} />

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/coming-soon/:moduleKey" element={<ComingSoonPage />} />

            <Route path="/referee/:token" element={<RefereeScoreboard />} />

            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicRootPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/tournaments" element={<PublicTournamentsPage />} />
              <Route path="/clubs" element={<PublicClubsPage />} />
              <Route path="/courts" element={<PublicCourtsPage />} />
              <Route path="/rankings" element={<PublicRankingsPage />} />
              <Route path="/news" element={<PublicNewsPage />} />
            </Route>

            <Route
              path="/onboarding/pick-vn-rating"
              element={<Navigate to="/player/skill-assessment" replace />}
            />

            <Route element={<MainLayout />}>

            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/dev/pairing-intervention-preview"
              element={
                <SuperAdminRouteGuard>
                  <PairingInterventionPreviewPage />
                </SuperAdminRouteGuard>
              }
            />
            <Route
              path="/dev/referee-v5"
              element={
                <SuperAdminRouteGuard>
                  <RefereeV5PreviewPage />
                </SuperAdminRouteGuard>
              }
            />
            <Route path="/dashboard/rankings" element={<RankingManagementPage />} />

            <Route path="/players/skill" element={<SkillLevelsPage />} />

            <Route path="/players" element={<Players />} />

            <Route path="/players/profile/:playerId" element={<PlayerProfile />} />

            <Route path="/profile" element={<SelfProfilePage />} />
            <Route path="/discover-clubs" element={<DiscoverClubsPage />} />
            <Route path="/my-club/requests" element={<MyClubRequestsPage />} />
            <Route path="/my-club" element={<MyClubPage />} />
            <Route path="/clubs/discover" element={<Navigate to="/discover-clubs" replace />} />
            <Route path="/club/activity" element={<Navigate to="/my-club?view=schedule" replace />} />
            <Route path="/player/profile" element={<AthleteSelfProfilePage />} />
            <Route path="/player/skill" element={<PlayerSkillOverviewPage />} />
            <Route path="/player/skill-assessment" element={<FirstSkillAssessmentPage />} />
            <Route path="/player/skill-assessment-v5" element={<SkillAssessmentV5Page />} />

            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/admin/roles" element={<RolesPermissionsPage />} />
            <Route path="/audit" element={<AuditLogPage />} />

            <Route path="/referee" element={<RefereeHub />} />

            <Route path="/referee/match/:matchId" element={<RefereeSessionScoreboard />} />

            <Route path="/courts-ops" element={<Navigate to="/court-management/courts" replace />} />

            <Route path="/court-management" element={<CourtManagementLayout />}>

              <Route index element={<CourtManagementHome />} />

              <Route path="calendar/preview" element={<CourtCalendarPreviewPage />} />

              <Route path="calendar" element={<CourtManagementCalendarPage />} />

              <Route path="bookings" element={<CourtManagementBookingsPage />} />

              <Route path="revenue" element={<CourtManagementRevenuePage />} />

              <Route path="customers" element={<CourtManagementCustomersPage />} />

              <Route path="members" element={<CourtManagementMembersPage />} />

              <Route path="customer-groups" element={<CustomerGroupsPage />} />

              <Route path="ops-log" element={<CourtOpsLogPage />} />

              <Route path="courts" element={<CourtManagementCourtsPage />} />

              <Route path="future" element={<CourtManagementFuturePage />} />

            </Route>

            <Route path="/select-players" element={<SelectPlayers />} />

            <Route path="/manage/clubs" element={<ClubListPage />} />
            <Route path="/manage/clubs/:clubId" element={<ClubDetailPage />} />
            <Route path="/platform/clubs" element={<PlatformClubsPage />} />
            <Route path="/club" element={<ClubManagement />} />

            <Route path="/tournament/list" element={<TournamentListPage />} />
            <Route path="/tournament/create" element={<TournamentCreatePage />} />
            <Route path="/tournament/types" element={<TournamentTypesHubPage />} />
            <Route path="/tournament/types/:category" element={<TournamentTypePage />} />
            <Route path="/tournament/roster" element={<TournamentRosterHubPage />} />
            <Route path="/tournament/organize" element={<TournamentOrganizeHubPage />} />
            <Route path="/tournament/operations" element={<TournamentOperationsHubPage />} />
            <Route path="/tournament/results" element={<TournamentResultsHubPage />} />
            <Route path="/tournament/register" element={<TournamentRegisterHub />} />
            <Route path="/tournament/teams/presets" element={<TournamentTeamPresetsHub />} />
            <Route path="/tournament/teams/build/manual" element={<TournamentTeamBuildManualHub />} />
            <Route path="/tournament/teams/build/random" element={<TournamentTeamBuildRandomHub />} />
            <Route path="/tournament/teams/build/draft" element={<TournamentTeamBuildDraftHub />} />
            <Route path="/tournament/teams" element={<TournamentTeamsHub />} />
            <Route path="/tournament/schedule" element={<TournamentScheduleHub />} />
            <Route path="/tournament/match-reports" element={<TournamentMatchReportsHub />} />
            <Route path="/tournament/config" element={<TournamentConfigHubPage />} />
            <Route path="/tournament/config/format" element={<TournamentConfigFormatHub />} />
            <Route path="/tournament/config/settings" element={<TournamentConfigSettingsHub />} />
            <Route path="/tournament/config/age-rules" element={<TournamentAgeRulesPage />} />
            <Route path="/tournament/config/gender-rules" element={<TournamentGenderRulesPage />} />
            <Route path="/tournament/config/fee" element={<TournamentFeePage />} />
            <Route path="/tournament/config/regulations" element={<TournamentRegulationsPage />} />
            <Route path="/tournament/eligibility" element={<TournamentTeamEligibilityHub />} />
            <Route path="/tournament/eligibility/check" element={<TournamentEligibilityPage />} />
            <Route path="/tournament/entry-fee" element={<TournamentFeePage />} />
            <Route path="/tournament/publish-schedule" element={<TournamentPublishSchedulePage />} />
            <Route path="/tournament/referee-assign" element={<TournamentRefereeAssignPage />} />
            <Route path="/tournament/awards" element={<TournamentAwardsPage />} />
            <Route path="/tournament/withdrawal" element={<TournamentWithdrawalPage />} />

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

              path="/tournament/team/:tournamentId"

              element={<TeamTournamentSetup />}

            />

            <Route

              path="/team-portal/:tournamentId"

              element={<TeamPortal />}

            />

            <Route

              path="/team-referee/:tournamentId"

              element={<TeamRefereePortal />}

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
            <Route path="/reports" element={<ReportsHubPage />} />
            <Route path="/ai" element={<AiHubPage />} />
            <Route path="/support" element={<SupportHubPage />} />
            <Route path="/support/guide" element={<SupportGuidePage />} />
            <Route path="/support/faq" element={<SupportFaqPage />} />

            <Route path="/coaching/coaches" element={<CoachesPage />} />
            <Route path="/coaching/coach-list" element={<CoachListPage />} />
            <Route path="/coaching/register" element={<CoachPackageRegisterPage />} />
            <Route path="/coaching/students" element={<StudentsPage />} />
            <Route path="/coaching/classes" element={<ClassesPage />} />
            <Route path="/coaching/schedule" element={<CoachSchedulePage />} />
            <Route path="/coaching/packages" element={<CoachPackagesPage />} />
            <Route path="/coaching/attendance" element={<CoachAttendancePage />} />
            <Route path="/coaching/evaluations" element={<CoachEvaluationPage />} />

            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/integrations" element={<IntegrationSettingsPage />} />
            <Route path="/settings/integrations/payments" element={<IntegrationPaymentsPage />} />
            <Route path="/settings/integrations/zalo-oa" element={<ZaloIntegrationPage />} />

            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/marketplace/orders" element={<MarketplaceOrdersPage />} />
            <Route path="/marketplace/:productId" element={<MarketplaceProductPage />} />

            <Route path="/admin/tenants" element={<TenantManagement />} />
            <Route path="/admin/court-clusters" element={<CourtClusterManagement />} />
            <Route path="/admin/hours" element={<VenueHoursPage />} />
            <Route path="/admin/skill-level-requests" element={<SkillLevelRequestsPage />} />
            <Route
              path="/admin/tournament-certifications"
              element={<TournamentCertificationQueuePage />}
            />
            <Route path="/admin/staff" element={<StaffListPage />} />
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
            <Route path="/billing/upgrade" element={<BillingPage title="Nâng cấp gói" view="upgrade" />} />
            <Route path="/billing/support" element={<BillingPage title="Support" view="support" />} />

            <Route path="/finance/debt" element={<FinanceDebtPage />} />
            <Route path="/finance/receipts" element={<FinanceReceiptsPage />} />
            <Route path="/finance/refunds" element={<FinanceRefundsPage />} />

            <Route path="/crm/messages" element={<CrmMessagesPage />} />
            <Route path="/crm/templates" element={<CrmTemplatesPage />} />
            <Route path="/crm/campaigns" element={<CrmCampaignsPage />} />
            <Route path="/crm/history" element={<CrmContactHistoryPage />} />
            <Route path="/crm/reminders/booking" element={<CrmBookingReminderPage />} />

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

        </MyClubMembershipRootProvider>

      </AuthProvider>

    </BrowserRouter>

  );

}


