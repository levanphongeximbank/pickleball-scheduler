/**
 * Canonical primary /tournament hub.
 * Wave A1 strangler: feature-gated Tournament Center, legacy hub remains at ?experience=legacy
 */
import { useSearchParams } from "react-router-dom";

import CanonicalTournamentHubPage from "../../features/tournament/pages/CanonicalTournamentHubPage.jsx";
import TournamentCenterExperiencePage from "../../features/tournament/experience-a1/pages/TournamentCenterExperiencePage.jsx";
import {
  isA1LegacyHubRequested,
  isTournamentExperienceA1Enabled,
} from "../../features/tournament/experience-a1/flags.js";

export default function TournamentShell() {
  const [searchParams] = useSearchParams();
  if (isTournamentExperienceA1Enabled() && !isA1LegacyHubRequested(searchParams)) {
    return <TournamentCenterExperiencePage />;
  }
  return <CanonicalTournamentHubPage />;
}
