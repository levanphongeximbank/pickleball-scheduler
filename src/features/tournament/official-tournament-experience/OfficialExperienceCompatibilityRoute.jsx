/**
 * Compatibility gate for /tournament/official/:tournamentId
 *
 * Default: demote to canonical Overview.
 * Escape: ?experience=legacy keeps OfficialTournamentSetup (operator-critical full setup).
 */

import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";

import OfficialTournamentSetup from "../../../pages/tournament/OfficialTournamentSetup.jsx";
import {
  isOfficialLegacyExperienceRequested,
  resolveOfficialCanonicalOpenPath,
} from "./officialOpenPaths.js";

export default function OfficialExperienceCompatibilityRoute() {
  const { tournamentId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  if (isOfficialLegacyExperienceRequested(searchParams)) {
    return <OfficialTournamentSetup />;
  }

  const eventId = searchParams.get("eventId") || searchParams.get("event") || "";
  const to = resolveOfficialCanonicalOpenPath(tournamentId, { eventId });
  return <Navigate to={to} replace state={location.state} />;
}
