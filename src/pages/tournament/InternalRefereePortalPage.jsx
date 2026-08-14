import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SportsIcon from "@mui/icons-material/Sports";

import { useAuth } from "../../context/AuthContext.jsx";
import { listTournamentsQuery } from "../../features/tournament/services/tournamentQueries.js";
import { commitInternalRefereeMatchResult } from "../../features/tournament/internal/internalRefereeCanonicalCommit.js";
import { resolveCanonicalExpectedVersion } from "../../features/tournament/internal/canonicalTournamentCas.js";
import { listInternalRefereeTokenClubScopes } from "../../features/tournament/internal/internalRefereeTokenScoreboard.js";
import {
  INTERNAL_REFEREE_PORTAL_FILTER,
  listInternalRefereePortalAssignments,
  projectInternalRefereePortalAfterCommit,
  resolveInternalRefereePortalLoadPresentation,
} from "../../features/tournament/internal/internalRefereePortal.js";
import { projectInternalLiveGroupStandings } from "../../features/tournament/internal/internalGroupStandings.js";
import InternalGroupStandingsTable from "../../components/tournament/internal/InternalGroupStandingsTable.jsx";
import RefereeScoreboard from "../referee/RefereeScoreboard.jsx";

function formatWhen(value) {
  if (!value) return "Chưa xếp giờ";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Date(parsed).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tournament-level Internal referee workspace (IT-E2E-BROWSER-018).
 * Reuses Team's portal pattern: assignment list + one selected scorer.
 * Scoring stays 016 ensure + shared live + 017 canonical commit.
 */
export default function InternalRefereePortalPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const clubIdFromQuery = String(
    searchParams.get("clubId") || location.state?.clubId || ""
  ).trim();
  const matchFromQuery = String(searchParams.get("match") || "").trim();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [portal, setPortal] = useState(null);
  const hasPortalRef = useRef(false);
  const selectedMatchIdRef = useRef(matchFromQuery);

  const selectedMatchId = matchFromQuery || selectedMatchIdRef.current || "";

  const applyPortal = useCallback((nextTournament, nextPortal) => {
    setTournament(nextTournament);
    setPortal(nextPortal);
    hasPortalRef.current = Boolean(nextPortal?.ok && nextTournament);
  }, []);

  const loadPortal = useCallback(async () => {
    if (!user?.id) {
      setError("NOT_AUTHENTICATED");
      setLoading(false);
      return;
    }
    const wantedTournament = String(tournamentId || "").trim();
    if (!wantedTournament) {
      setError("MISSING_TOURNAMENT");
      setLoading(false);
      return;
    }

    const presentation = resolveInternalRefereePortalLoadPresentation({
      hasPortal: hasPortalRef.current,
    });
    if (presentation.initialLoading) setLoading(true);
    else setRefreshing(true);

    const scopes = clubIdFromQuery
      ? [{ clubId: clubIdFromQuery, tenantId: String(user.venueId || user.tenantId || "") }]
      : await listInternalRefereeTokenClubScopes(user);

    let foundTournament = null;
    let foundPortal = null;
    let foundCode = "NOT_FOUND";
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
      const candidate = (listed.tournaments || []).find(
        (item) => String(item.id) === wantedTournament
      );
      if (!candidate) continue;
      const projected = listInternalRefereePortalAssignments({
        tournament: candidate,
        user,
      });
      foundTournament = candidate;
      foundPortal = projected;
      foundCode = projected.code || null;
      break;
    }

    if (!foundTournament) {
      if (presentation.initialLoading) {
        setError(foundCode || "NOT_FOUND");
        setTournament(null);
        setPortal(null);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (foundPortal?.code === "CROSS_TENANT") {
      if (presentation.initialLoading) {
        setError("CROSS_TENANT");
        setTournament(null);
        setPortal(null);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    applyPortal(foundTournament, foundPortal);
    const assigned = foundPortal?.matches || [];
    if (assigned.length === 1 && !selectedMatchIdRef.current) {
      selectedMatchIdRef.current = assigned[0].matchId;
    }
    setLoading(false);
    setRefreshing(false);
  }, [applyPortal, clubIdFromQuery, tournamentId, user]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (matchFromQuery) selectedMatchIdRef.current = matchFromQuery;
  }, [matchFromQuery]);

  const matches = useMemo(() => portal?.matches || [], [portal]);
  const selectedMatch = useMemo(
    () => matches.find((item) => String(item.matchId) === String(selectedMatchId)) || null,
    [matches, selectedMatchId]
  );
  const standingsProjection = useMemo(
    () => projectInternalLiveGroupStandings(tournament?.events?.[0]),
    [tournament]
  );

  const selectMatch = (matchId) => {
    const id = String(matchId || "").trim();
    selectedMatchIdRef.current = id;
    const next = new URLSearchParams(searchParams);
    if (id) next.set("match", id);
    else next.delete("match");
    setSearchParams(next, { replace: true });
  };

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

  const handleCanonicalCommitted = useCallback(
    (result) => {
      if (!result?.ok || !selectedMatch?.matchId || !tournament) return;
      const projected = projectInternalRefereePortalAfterCommit({
        tournament,
        user,
        completedMatchId: selectedMatch.matchId,
        scoreA: result.scoreA ?? result.score_a,
        scoreB: result.scoreB ?? result.score_b,
      });
      if (projected.ok) {
        applyPortal(projected.tournament, projected.portal);
      }
      loadPortal();
    },
    [applyPortal, loadPortal, selectedMatch, tournament, user]
  );

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">Đang mở workspace trọng tài giải nội bộ...</Typography>
      </Box>
    );
  }

  if (error || !portal) {
    const message =
      error === "CROSS_TENANT"
        ? "Không được chấm trận của tenant khác."
        : error === "NOT_ASSIGNED"
          ? "Bạn không được phân công trận nào trong giải này."
          : "Không mở được workspace trọng tài giải nội bộ.";
    return (
      <Box sx={{ p: 3 }} data-testid="internal-referee-portal-denied">
        <Alert severity="error">{message}</Alert>
        <Button component={RouterLink} to="/tournaments" sx={{ mt: 2 }}>
          Về Giải của tôi
        </Button>
      </Box>
    );
  }

  const showScorer = Boolean(selectedMatch?.refereeToken);

  return (
    <Box data-testid="internal-referee-tournament-portal" sx={{ p: { xs: 1.5, sm: 2 }, pb: 4 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to="/tournaments"
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Giải của tôi
        </Button>
        {refreshing ? <Chip size="small" label="Đang cập nhật" /> : null}
      </Stack>

      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 2 }}>
        <SportsIcon color="primary" />
        <Box>
          <Typography variant="overline" color="text.secondary">
            Workspace trọng tài
          </Typography>
          <Typography variant="h5" fontWeight={800} data-testid="internal-referee-portal-title">
            {portal.tournamentName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {matches.length} trận được phân công
          </Typography>
        </Box>
      </Stack>

      {standingsProjection.visible ? (
        <Box sx={{ mb: 2 }} data-testid="internal-referee-portal-standings">
          <InternalGroupStandingsTable
            projection={standingsProjection}
            compact
            title="BXH vòng bảng"
          />
        </Box>
      ) : null}

      {!matches.length ? (
        <Alert severity="info">Bạn không được phân công trận nào trong giải này.</Alert>
      ) : (
        <Stack spacing={1.25} sx={{ mb: 2 }} data-testid="internal-referee-portal-match-list">
          {matches.map((match) => {
            const selected = String(match.matchId) === String(selectedMatchId);
            return (
              <Paper
                key={match.matchId}
                variant="outlined"
                data-testid={`internal-referee-portal-match-${match.matchId}`}
                data-next={match.isNext ? "true" : "false"}
                data-status={match.status}
                data-score={match.scoreLabel}
                sx={{
                  p: 1.5,
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: match.isNext ? "action.hover" : "background.paper",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={800}>{match.matchId}</Typography>
                      {match.isNext ? (
                        <Chip
                          size="small"
                          color="primary"
                          label="Trận tiếp theo"
                          data-testid="internal-referee-portal-next"
                        />
                      ) : null}
                      <Chip size="small" label={match.statusLabel} />
                      {match.scoreLabel !== "—" ? (
                        <Chip size="small" variant="outlined" label={match.scoreLabel} />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {match.team1Name} vs {match.team2Name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[match.stageLabel, match.courtLabel, formatWhen(match.scheduledStart)]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                  <Button
                    variant={selected ? "contained" : "outlined"}
                    onClick={() => selectMatch(match.matchId)}
                    sx={{ minHeight: 44, whiteSpace: "nowrap" }}
                  >
                    {match.actionLabel}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {showScorer ? (
        <Box data-testid="internal-referee-portal-scorer">
          {selectedMatch.bucket === INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED ? (
            <Alert severity="success" sx={{ mb: 1.5 }}>
              {selectedMatch.matchId}: {selectedMatch.scoreLabel} đã chốt.
            </Alert>
          ) : null}
          <Button size="small" onClick={() => selectMatch("")} sx={{ mb: 1 }}>
            Đóng bảng điểm — về danh sách trận
          </Button>
          <RefereeScoreboard
            key={selectedMatch.refereeToken}
            sessionToken={selectedMatch.refereeToken}
            sessionMode
            embedded
            canonicalCommit={canonicalCommit}
            onCanonicalCommitted={handleCanonicalCommitted}
          />
        </Box>
      ) : null}
    </Box>
  );
}
