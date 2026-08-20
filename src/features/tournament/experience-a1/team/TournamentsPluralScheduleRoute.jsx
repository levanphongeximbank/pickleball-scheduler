import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { Alert, Box } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isTeamTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";

const TeamSchedulePage = lazy(() => import("./TeamSchedulePage.jsx"));
const TournamentEnginePage = lazy(() => import("../../../../pages/tournament/TournamentEnginePage.jsx"));

/**
 * Plural `/tournaments/:id/schedule` serves:
 * - Team Tournament → canonical Team Schedule Experience (Wave T3)
 * - Individual / other → existing Tournament Engine schedule tab
 */
export default function TournamentsPluralScheduleRoute() {
  const { tournamentId } = useParams();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(
    activeClub,
    tournamentId,
    revision
  );

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">Đang xác định loại giải…</Alert>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }

  const isTeam = isTeamTournament(tournament);

  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2 }}>
          <Alert severity="info">Đang tải lịch…</Alert>
        </Box>
      }
    >
      {isTeam ? <TeamSchedulePage /> : <TournamentEnginePage />}
    </Suspense>
  );
}
