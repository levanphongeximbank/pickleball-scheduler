import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import { AuthProvider } from "./context/AuthContext.jsx";

const LoginPage = lazy(() => import("./pages/LoginPage"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Players = lazy(() => import("./pages/Players"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const SelectPlayers = lazy(() => import("./pages/SelectPlayers"));
const ClubManagement = lazy(() => import("./pages/ClubManagement"));
const Tournament = lazy(() => import("./pages/tournament/TournamentShell"));
const DailyPlaySetup = lazy(() => import("./pages/tournament/DailyPlaySetup"));
const InternalTournamentSetup = lazy(() => import("./pages/tournament/InternalTournamentSetup"));
const OfficialTournamentSetup = lazy(() => import("./pages/tournament/OfficialTournamentSetup"));
const TournamentBracketPage = lazy(() => import("./pages/tournament/TournamentBracketPage"));
const TournamentBracketHub = lazy(() => import("./pages/tournament/TournamentBracketHub"));
const TournamentDirectorMode = lazy(() => import("./pages/tournament/TournamentDirectorMode"));
const RefereeScoreboard = lazy(() => import("./pages/referee/RefereeScoreboard"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Settings = lazy(() => import("./pages/Settings"));
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
            <Route path="/referee/:token" element={<RefereeScoreboard />} />
            <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/profile/:playerId" element={<PlayerProfile />} />
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
            <Route path="/club" element={<ClubManagement />} />
            <Route path="/tournament" element={<Tournament />} />
            <Route path="/tournament/bracket" element={<TournamentBracketHub />} />
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
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
