import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { listTournamentsQuery } from "../../features/tournament/services/tournamentQueries.js";
import {
  isInternalRefereeAssignedToMatch,
  listInternalRefereeHubAssignments,
} from "../../features/tournament/internal/internalRefereeDiscovery.js";
import { commitInternalRefereeMatchResult } from "../../features/tournament/internal/internalRefereeCanonicalCommit.js";
import { resolveCanonicalExpectedVersion } from "../../features/tournament/internal/canonicalTournamentCas.js";
import { listInternalRefereeTokenClubScopes } from "../../features/tournament/internal/internalRefereeTokenScoreboard.js";
import { buildInternalRefereePortalHref } from "../../features/tournament/internal/internalRefereeCanonicalPath.js";
import RefereeScoreboard from "./RefereeScoreboard.jsx";

/**
 * Authenticated Internal referee session (IT-E2E-BROWSER-017).
 * Shared /referee/match/:matchId shape. Outside MainLayout. No public token banner.
 */
export default function InternalRefereeMatchPage() {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const tournamentId = String(
    searchParams.get("tournamentId") || location.state?.tournamentId || ""
  ).trim();
  const clubIdFromQuery = String(
    searchParams.get("clubId") || location.state?.clubId || ""
  ).trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [tournament, setTournament] = useState(null);

  const loadAssignment = useCallback(async () => {
    if (!user?.id) {
      setError("NOT_AUTHENTICATED");
      setLoading(false);
      return;
    }
    const wantedMatch = String(matchId || "").trim();
    if (!wantedMatch || !tournamentId) {
      setError("MISSING_MATCH");
      setLoading(false);
      return;
    }

    const scopes = clubIdFromQuery
      ? [{ clubId: clubIdFromQuery, tenantId: String(user.venueId || user.tenantId || "") }]
      : await listInternalRefereeTokenClubScopes(user);
    let found = null;
    let foundTournament = null;
    for (const scope of scopes) {
      if (!scope.clubId || !scope.tenantId) continue;
      if (
        String(user.venueId || user.tenantId || "") &&
        String(scope.tenantId) !== String(user.venueId || user.tenantId || "")
      ) {
        continue;
      }
      const listed = await listTournamentsQuery(
        { id: scope.clubId, clubId: scope.clubId, tenantId: scope.tenantId },
        {},
        { tenantId: scope.tenantId }
      );
      if (!listed?.ok) continue;
      const tournaments = listed.tournaments || [];
      const discovered = listInternalRefereeHubAssignments({
        tournaments,
        user,
        clubId: scope.clubId,
        tenantId: scope.tenantId,
      });
      found = (discovered.matches || []).find(
        (item) =>
          String(item.matchId) === wantedMatch &&
          String(item.tournamentId) === tournamentId
      );
      foundTournament = tournaments.find((item) => String(item.id) === tournamentId) || null;
      if (found) break;
    }

    if (!found || !foundTournament) {
      setError("NOT_ASSIGNED");
      setLoading(false);
      return;
    }
    if (
      String(foundTournament.tenantId || "") !== String(user.venueId || user.tenantId || "")
    ) {
      setError("CROSS_TENANT");
      setLoading(false);
      return;
    }
    const event = foundTournament.events?.[0];
    const match = (event?.matches || []).find((item) => String(item.id) === wantedMatch);
    const roster = foundTournament.settings?.refereeRoster || [];
    if (!isInternalRefereeAssignedToMatch(user, match, roster)) {
      setError("NOT_ASSIGNED");
      setLoading(false);
      return;
    }
    setAssignment(found);
    setTournament(foundTournament);
    setLoading(false);
  }, [clubIdFromQuery, matchId, tournamentId, user]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  const canonicalCommit = useCallback(
    async ({ token, scoreA, scoreB }) => {
      if (!tournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }
      return commitInternalRefereeMatchResult({
        token,
        scoreA,
        scoreB,
        expectedVersion: resolveCanonicalExpectedVersion(tournament),
      });
    },
    [tournament]
  );

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">Đang mở phiên chấm giải nội bộ...</Typography>
      </Box>
    );
  }

  if (error || !assignment?.refereeToken) {
    const message =
      error === "CROSS_TENANT"
        ? "Không được chấm trận của tenant khác."
        : error === "NOT_ASSIGNED"
          ? "Bạn không được phân công trận này."
          : error === "MISSING_MATCH"
            ? "Thiếu trận hoặc giải."
            : "Không mở được phiên chấm nội bộ.";
    return (
      <Box sx={{ p: 3 }} data-testid="internal-referee-canonical-denied">
        <Alert severity="error">{message}</Alert>
      </Box>
    );
  }

  return (
    <Box data-testid="internal-referee-canonical-session">
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Button
          component={RouterLink}
          to={buildInternalRefereePortalHref({
            tournamentId,
            clubId: tournament.clubId,
          })}
          size="small"
        >
          Danh sách trận giải
        </Button>
      </Box>
      <RefereeScoreboard
        sessionToken={assignment.refereeToken}
        sessionMode
        canonicalCommit={canonicalCommit}
      />
    </Box>
  );
}
