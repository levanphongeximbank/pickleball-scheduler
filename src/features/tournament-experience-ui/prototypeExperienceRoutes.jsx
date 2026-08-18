import { Route } from "react-router-dom";

import TournamentExperiencePrototypeLayout from "./TournamentExperiencePrototypeLayout.jsx";
import PrototypeComingSoonPage from "./pages/PrototypeComingSoonPage.jsx";
import AwardsPage from "./pages/AwardsPage.jsx";
import CommunicationsCenterPage from "./pages/CommunicationsCenterPage.jsx";
import CompleteTournamentPage from "./pages/CompleteTournamentPage.jsx";
import CourtBoardPage from "./pages/CourtBoardPage.jsx";
import DirectorModePage from "./pages/DirectorModePage.jsx";
import ExceptionCenterPage from "./pages/ExceptionCenterPage.jsx";
import FullBracketPage from "./pages/FullBracketPage.jsx";
import GroupDrawRoomPage from "./pages/GroupDrawRoomPage.jsx";
import GroupStagePage from "./pages/GroupStagePage.jsx";
import KnockoutStagePage from "./pages/KnockoutStagePage.jsx";
import MatchCenterPage from "./pages/MatchCenterPage.jsx";
import MediaPresentationPage from "./pages/MediaPresentationPage.jsx";
import PairDrawRoomPage from "./pages/PairDrawRoomPage.jsx";
import PairFormationPage from "./pages/PairFormationPage.jsx";
import ParticipantsLockPage from "./pages/ParticipantsLockPage.jsx";
import PublicTournamentPage from "./pages/PublicTournamentPage.jsx";
import RefereeBoardPage from "./pages/RefereeBoardPage.jsx";
import RegistrationPublicationPage from "./pages/RegistrationPublicationPage.jsx";
import ResultsStandingsPage from "./pages/ResultsStandingsPage.jsx";
import ScheduleCourtsPage from "./pages/ScheduleCourtsPage.jsx";
import TournamentCenterPage from "./pages/TournamentCenterPage.jsx";
import TournamentOverviewPage from "./pages/TournamentOverviewPage.jsx";
import TournamentSettingsPage from "./pages/TournamentSettingsPage.jsx";
import { PROTOTYPE_SCREEN_CATALOG } from "./prototypeScreenCatalog.js";

export { PROTOTYPE_SCREEN_CATALOG };

export function PrototypeExperienceChildRoutes() {
  return (
    <>
      <Route index element={<TournamentCenterPage />} />
      <Route path="t/:tournamentId" element={<TournamentOverviewPage />} />
      <Route path="t/:tournamentId/settings" element={<TournamentSettingsPage />} />
      <Route path="t/:tournamentId/registration" element={<RegistrationPublicationPage />} />
      <Route path="t/:tournamentId/participants" element={<ParticipantsLockPage />} />
      <Route path="t/:tournamentId/pairs" element={<PairFormationPage />} />
      <Route path="t/:tournamentId/pair-draw" element={<PairDrawRoomPage />} />
      <Route path="t/:tournamentId/group-draw" element={<GroupDrawRoomPage />} />
      <Route path="t/:tournamentId/groups" element={<GroupStagePage />} />
      <Route path="t/:tournamentId/schedule" element={<ScheduleCourtsPage />} />
      <Route path="t/:tournamentId/matches" element={<MatchCenterPage />} />
      <Route path="t/:tournamentId/standings" element={<ResultsStandingsPage />} />
      <Route path="t/:tournamentId/knockout" element={<KnockoutStagePage />} />
      <Route path="t/:tournamentId/bracket" element={<FullBracketPage />} />
      <Route path="t/:tournamentId/director" element={<DirectorModePage />} />
      <Route path="t/:tournamentId/courts" element={<CourtBoardPage />} />
      <Route path="t/:tournamentId/referees" element={<RefereeBoardPage />} />
      <Route path="t/:tournamentId/exceptions" element={<ExceptionCenterPage />} />
      <Route path="t/:tournamentId/communications" element={<CommunicationsCenterPage />} />
      <Route path="t/:tournamentId/media" element={<MediaPresentationPage />} />
      <Route path="t/:tournamentId/awards" element={<AwardsPage />} />
      <Route path="t/:tournamentId/complete" element={<CompleteTournamentPage />} />
      <Route path="public/:tournamentId" element={<PublicTournamentPage />} />
      <Route path="t/:tournamentId/*" element={<PrototypeComingSoonPage />} />
    </>
  );
}

export function PrototypeExperienceLayoutRoute() {
  return (
    <Route
      path="/ux-prototype/tournament-experience"
      element={<TournamentExperiencePrototypeLayout />}
    >
      {PrototypeExperienceChildRoutes()}
    </Route>
  );
}
