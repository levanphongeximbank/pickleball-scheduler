import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import HistoryIcon from "@mui/icons-material/History";

import {
  CLUB_ACTIVITY_DAY_LABELS,
  canApproveClubMembershipRequests,
  getTodayClubActivitySessions,
  listClubActivitySessions,
  listPendingMembershipRequests,
} from "../index.js";
import { CLUB_ROUTE_PATHS } from "../routing/clubMembershipRouteLogic.js";

/** Home dashboard insight tiles — read-only, no new RPC contracts. */
export default function MyClubHomeInsights({
  clubId,
  tenantId,
  clubRecord,
  user,
  revision = 0,
  showRequestsLink = false,
  onViewSchedule,
  onViewRequests,
}) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPending, setLoadingPending] = useState(false);

  const canReview =
    Boolean(clubRecord && user && canApproveClubMembershipRequests(user, clubRecord));

  useEffect(() => {
    let cancelled = false;
    if (!clubId || !user?.id || !canReview) {
      setPendingCount(0);
      return undefined;
    }
    setLoadingPending(true);
    void listPendingMembershipRequests(clubId, tenantId, user).then((rows) => {
      if (!cancelled) {
        setPendingCount(rows?.length ?? 0);
        setLoadingPending(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, user, clubRecord, revision, canReview]);

  const todaySessions = useMemo(() => {
    void revision;
    if (!clubId) {
      return [];
    }
    return getTodayClubActivitySessions(clubId, tenantId);
  }, [clubId, tenantId, revision]);

  const nextSession = useMemo(() => {
    void revision;
    if (!clubId) {
      return null;
    }
    const sessions = listClubActivitySessions(clubId, tenantId);
    if (!sessions.length) {
      return null;
    }
    const today = new Date().getDay();
    const sorted = [...sessions].sort((a, b) => {
      const dayA = a.dayOfWeek >= today ? a.dayOfWeek : a.dayOfWeek + 7;
      const dayB = b.dayOfWeek >= today ? b.dayOfWeek : b.dayOfWeek + 7;
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      return String(a.startTime).localeCompare(String(b.startTime));
    });
    return sorted[0];
  }, [clubId, tenantId, revision]);

  const scheduleLabel = todaySessions.length
    ? `Hôm nay: ${todaySessions.length} buổi`
    : nextSession
      ? `${CLUB_ACTIVITY_DAY_LABELS[nextSession.dayOfWeek] || "Tuần"} · ${nextSession.startTime}–${nextSession.endTime}`
      : "Chưa có lịch sinh hoạt";

  return (
    <Grid container spacing={2} sx={{ mt: 0.5 }}>
      <Grid item xs={12} sm={4}>
        <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <EventIcon color="primary" fontSize="small" aria-hidden />
              <Typography variant="subtitle2" fontWeight={700}>
                Lịch sinh hoạt
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {scheduleLabel}
            </Typography>
            <Button size="small" sx={{ mt: 1, px: 0 }} onClick={onViewSchedule}>
              Xem lịch
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {canReview && (
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PendingActionsIcon color="warning" fontSize="small" aria-hidden />
                <Typography variant="subtitle2" fontWeight={700}>
                  Yêu cầu chờ duyệt
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {loadingPending ? "…" : pendingCount}
              </Typography>
              {showRequestsLink && pendingCount > 0 && (
                <Button
                  size="small"
                  component={RouterLink}
                  to={CLUB_ROUTE_PATHS.REQUESTS}
                  sx={{ mt: 1, px: 0 }}
                  onClick={onViewRequests}
                >
                  Duyệt ngay
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      <Grid item xs={12} sm={canReview ? 4 : 8}>
        <Card variant="outlined" sx={{ height: "100%", borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <HistoryIcon color="action" fontSize="small" aria-hidden />
              <Typography variant="subtitle2" fontWeight={700}>
                Hoạt động gần đây
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {todaySessions.length
                ? `${todaySessions.length} buổi sinh hoạt hôm nay.`
                : "Theo dõi giải đấu và lịch CLB tại tab Lịch sinh hoạt."}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
