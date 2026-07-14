import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import {
  getTournament,
  listTournaments,
  updateTournament,
} from "../../domain/tournamentService.js";
import { isIndividualTournament, TOURNAMENT_ROUTES } from "../../config/tournamentRoutes.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualPlayerPortalPanel from "../../components/tournament/IndividualPlayerPortalPanel.jsx";
import {
  TournamentEmptyState,
  TournamentErrorState,
  TournamentLoadingState,
} from "../../components/tournament/TournamentUiState.jsx";
import {
  buildPlayerPortalDashboard,
  listPlayerTournaments,
} from "../../features/individual-tournament/engines/playerPortalEngine.js";
import {
  buildPlayerNotifications,
  bumpPortalOptimisticVersion,
  getPortalOptimisticVersion,
  markAllNotificationsRead,
  dismissNotification,
} from "../../features/individual-tournament/engines/playerNotificationEngine.js";
import { touchButtonSx, MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";

const POLL_MS = 20000;

function resolvePlayerId(user) {
  if (!user) return "";
  return (
    user.playerId ||
    user.linkedPlayerId ||
    user.profile?.playerId ||
    user.id ||
    ""
  );
}

export default function IndividualPlayerPortalPage() {
  const { tournamentId: routeTournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = routeTournamentId || searchParams.get("tournamentId") || "";
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const playerId = resolvePlayerId(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entryId, setEntryId] = useState(searchParams.get("entryId") || "");
  const [message, setMessage] = useState(null);

  const tournaments = useMemo(
    () => listTournaments(activeClubId).filter(isIndividualTournament),
    [activeClubId, revision]
  );

  const myTournaments = useMemo(
    () => listPlayerTournaments(tournaments, playerId),
    [tournaments, playerId]
  );

  const tournament = useMemo(() => {
    if (!tournamentId || !activeClubId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  // Soft polling fallback for live results / schedule updates
  useEffect(() => {
    if (!tournamentId || !activeClubId) return undefined;
    const timer = setInterval(() => {
      refreshClubs();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [tournamentId, activeClubId, refreshClubs]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      // Sync tick — data from club blob
      setLoading(false);
    } catch (err) {
      setError(err?.message || "Lỗi tải dữ liệu");
      setLoading(false);
    }
  }, [tournamentId, revision, playerId]);

  const dashboard = useMemo(() => {
    if (!tournament) return null;
    return buildPlayerPortalDashboard(tournament, {
      playerId,
      entryId: entryId || undefined,
    });
  }, [tournament, playerId, entryId]);

  useEffect(() => {
    if (dashboard?.enrolled && dashboard.entry?.id && !entryId) {
      setEntryId(dashboard.entry.id);
    }
  }, [dashboard, entryId]);

  const notificationFeed = useMemo(() => {
    if (!tournament || !dashboard?.enrolled) {
      return { notifications: [], unreadCount: 0 };
    }
    return buildPlayerNotifications(tournament, {
      entryId: dashboard.entry.id,
    });
  }, [tournament, dashboard]);

  const persist = useCallback(
    (nextTournament) => {
      if (!activeClubId || !tournamentId || !nextTournament) return false;
      const bumped = bumpPortalOptimisticVersion(
        nextTournament,
        getPortalOptimisticVersion(tournament)
      );
      if (!bumped.ok) {
        setMessage({ type: "error", text: bumped.error });
        refreshClubs();
        return false;
      }
      const result = updateTournament(activeClubId, tournamentId, {
        settings: bumped.tournament.settings,
      });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error || "Không lưu được." });
        return false;
      }
      refreshClubs();
      return true;
    },
    [activeClubId, tournamentId, tournament, refreshClubs]
  );

  const selectTournament = (id) => {
    if (routeTournamentId) {
      // navigated via path
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (id) next.set("tournamentId", id);
    else next.delete("tournamentId");
    setSearchParams(next);
  };

  if (!user?.id) {
    return (
      <TournamentConfigPageShell title="Cổng VĐV" description="Đăng nhập để xem giải của bạn.">
        <Alert severity="warning">Vui lòng đăng nhập để mở cổng vận động viên.</Alert>
      </TournamentConfigPageShell>
    );
  }

  return (
    <TournamentConfigPageShell
      title="Cổng vận động viên"
      description="Giải của tôi · lịch · BXH · nhánh · giải thưởng · thông báo"
      noCard
    >
      <Box sx={{ px: isMobile ? MOBILE_PAGE_GUTTER : 0 }}>
        {message ? (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              Giải của tôi
            </Typography>
            {myTournaments.length === 0 ? (
              <TournamentEmptyState
                title="Bạn chưa tham gia giải nào"
                description="Đăng ký giải cá nhân để theo dõi lịch và kết quả tại đây."
                actionLabel="Tới đăng ký"
                onAction={() => {
                  window.location.href = TOURNAMENT_ROUTES.register;
                }}
              />
            ) : (
              <TextField
                select
                fullWidth
                size="small"
                label="Chọn giải"
                value={tournamentId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (routeTournamentId) {
                    window.location.href = `/tournament/my/${id}`;
                    return;
                  }
                  selectTournament(id);
                }}
                inputProps={{ "aria-label": "Chọn giải của tôi" }}
              >
                <MenuItem value="">— Chọn giải —</MenuItem>
                {myTournaments.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} ({t.status})
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Paper>
          <Stack spacing={1} justifyContent="center">
            <Button
              component={RouterLink}
              to={TOURNAMENT_ROUTES.list}
              startIcon={<ArrowBackIcon />}
              sx={touchButtonSx}
            >
              Danh sách giải
            </Button>
            {tournamentId ? (
              <Button
                component={RouterLink}
                to={`/tournament/${tournamentId}/public`}
                sx={touchButtonSx}
              >
                Xem trang công khai
              </Button>
            ) : null}
          </Stack>
        </Stack>

        {!tournamentId ? (
          loading ? (
            <TournamentLoadingState />
          ) : (
            <TournamentEmptyState title="Chọn một giải để mở dashboard" />
          )
        ) : !tournament ? (
          <TournamentErrorState
            title="Không tìm thấy giải"
            description="Giải có thể thuộc CLB khác hoặc đã bị xóa."
            onRetry={() => refreshClubs()}
          />
        ) : (
          <IndividualPlayerPortalPanel
            loading={loading}
            error={error}
            onRetry={() => refreshClubs()}
            dashboard={dashboard}
            notifications={notificationFeed.notifications}
            unreadCount={notificationFeed.unreadCount}
            tournament={tournament}
            entryOptions={dashboard?.availableEntries || []}
            selectedEntryId={entryId || dashboard?.entry?.id || ""}
            onSelectEntry={(id) => {
              setEntryId(id);
              const next = new URLSearchParams(searchParams);
              next.set("entryId", id);
              setSearchParams(next);
            }}
            onMarkAllRead={() => {
              const result = markAllNotificationsRead(tournament, {
                entryId: dashboard?.entry?.id,
              });
              if (result.ok) persist(result.tournament);
            }}
            onDismissNotification={(id) => {
              const result = dismissNotification(tournament, id);
              if (result.ok) persist(result.tournament);
            }}
          />
        )}
      </Box>
    </TournamentConfigPageShell>
  );
}
