import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import CheckInStatusChip from "../../features/mobile/components/CheckInStatusChip.jsx";
import QrDisplayCard from "../../features/mobile/components/QrDisplayCard.jsx";
import {
  buildCheckinSummaryForPlayers,
  getCheckinDashboard,
} from "../../features/mobile/services/checkInService.js";
import {
  filterNotificationsByRole,
  listNotifications,
} from "../../features/mobile/services/notificationService.js";
import { loadPlayerMobileHome } from "../../features/mobile/services/playerMobileService.js";
import { createQrToken } from "../../features/mobile/services/qrTokenService.js";
import { QR_ENTITY_TYPES } from "../../features/mobile/constants/qrEntityTypes.js";
import { CHECKIN_STATUS } from "../../features/mobile/constants/checkInStatus.js";
import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";
import { ROLES } from "../../auth/roles.js";

export default function PlayerHomePage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const { activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const { activeLeagueId, activeSeasonId } = useSeasonLeague();
  const [tab, setTab] = useState(() => (searchParams.get("tab") === "qr" ? 1 : 0));
  const [notifications, setNotifications] = useState([]);
  const [checkinStatus, setCheckinStatus] = useState(CHECKIN_STATUS.PENDING);
  const [personalQr, setPersonalQr] = useState(null);
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const playerId = auth.user?.playerId || null;
  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId]
  );
  const player = players.find((p) => p.id === playerId) || players[0] || null;

  const refresh = useCallback(async () => {
    if (!activeClubId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const home = loadPlayerMobileHome({
      clubId: activeClubId,
      playerId: player?.id,
      tenantId: currentTenantId,
      leagueId: activeLeagueId,
      seasonId: activeSeasonId,
    });

    if (!home.ok) {
      setError(home.error || "Không tải được dữ liệu người chơi.");
      setHomeData(null);
    } else {
      setHomeData(home);
    }

    const [notifResult, checkinResult] = await Promise.all([
      listNotifications({ tenantId: currentTenantId, userId: auth.user?.id }),
      getCheckinDashboard({ tenantId: currentTenantId }),
    ]);

    if (notifResult.ok) {
      const filtered = filterNotificationsByRole(notifResult.notifications, {
        user: auth.user,
        clubId: activeClubId,
      });
      setNotifications(filtered);
    }

    if (checkinResult.ok && player) {
      const summary = buildCheckinSummaryForPlayers({
        players: [player],
        checkins: checkinResult.checkins,
      });
      const row = summary.rows[0];
      setCheckinStatus(row?.status || CHECKIN_STATUS.PENDING);
    }

    setLoading(false);
  }, [
    activeClubId,
    activeLeagueId,
    activeSeasonId,
    currentTenantId,
    auth.user,
    player,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadPersonalQr = async () => {
    if (!player) {
      return;
    }
    const result = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: player.id,
      tenantId: currentTenantId,
    });
    if (result.ok) {
      setPersonalQr(result);
    }
  };

  const isPlayerRole = auth.user?.role === ROLES.PLAYER || Boolean(playerId);

  if (loading) {
    return (
      <Box sx={{ px: MOBILE_PAGE_GUTTER, py: 6, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Đang tải dữ liệu...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={refresh}>
          Thử lại
        </Button>
      </Box>
    );
  }

  const schedule = homeData?.schedule || [];
  const upcomingMatches = homeData?.upcomingMatches || [];
  const tournaments = homeData?.tournaments || [];
  const recentResults = homeData?.recentResults || [];
  const ranking = homeData?.ranking;
  const stats = homeData?.stats;

  return (
    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <PersonIcon color="primary" />
        <Typography variant="h5" fontWeight={900}>
          Trang của tôi
        </Typography>
      </Stack>

      {!isPlayerRole && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chế độ xem Player — dữ liệu lấy từ hồ sơ VĐV trong CLB hiện tại.
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>
            {player?.name || auth.user?.displayName || "VĐV"}
          </Typography>
          {stats && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {stats.wins}W / {stats.losses}L · Tỷ lệ thắng {stats.winRate}%
            </Typography>
          )}
          {ranking && (
            <Typography variant="body2" color="text.secondary">
              BXH giải: hạng #{ranking.rank} · {ranking.points} điểm
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Check-in:
            </Typography>
            <CheckInStatusChip status={checkinStatus} />
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        <Tab label="Lịch thi đấu" />
        <Tab label="QR cá nhân" />
        <Tab label="Thông báo" />
        <Tab label="Kết quả" />
      </Tabs>

      {tab === 0 && (
        <Stack spacing={1.5}>
          {schedule.length === 0 && upcomingMatches.length === 0 && tournaments.length === 0 && (
            <Alert severity="info">
              Chưa có lịch chơi hoặc giải gắn với tài khoản của bạn.
            </Alert>
          )}
          {schedule.map((item) => (
            <Card key={item.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography fontWeight={700}>
                  {item.type === "match" ? item.label : item.customerName || "Booking"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.startTime || item.time || ""}
                  {item.courtName ? ` · ${item.courtName}` : ""}
                  {item.status ? ` · ${item.status}` : ""}
                </Typography>
              </CardContent>
            </Card>
          ))}
          {tournaments.slice(0, 5).map((t) => (
            <Card key={t.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography fontWeight={700}>{t.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.status} · {t.type || "tournament"}
                </Typography>
                <Button component={Link} to="/tournament" size="small" sx={{ mt: 1 }}>
                  Xem chi tiết
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={2} alignItems="center">
          <Alert severity="info" sx={{ width: "100%" }}>
            QR cá nhân giúp bạn check-in nhanh và được xác nhận đúng tài khoản của mình.
          </Alert>
          <Button variant="contained" onClick={loadPersonalQr} sx={{ minHeight: 48 }}>
            {personalQr?.payload ? "Tạo lại QR cá nhân" : "Tạo QR cá nhân"}
          </Button>
          {!personalQr?.payload && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Chưa có QR cho tài khoản này. Nhấn nút trên để tạo mã ngay.
            </Typography>
          )}
          {personalQr?.payload && (
            <QrDisplayCard
              payload={personalQr.payload}
              title="QR Check-in cá nhân"
              subtitle={player?.name}
            />
          )}
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={1}>
          {notifications.length === 0 && (
            <Alert severity="info">
              Chưa có thông báo nào. Bạn có thể bật thông báo để nhận lịch và cập nhật mới.
            </Alert>
          )}
          {notifications.map((n) => (
            <Card key={n.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography fontWeight={700}>{n.title}</Typography>
                <Typography variant="body2">{n.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(n.created_at).toLocaleString("vi-VN")}
                </Typography>
              </CardContent>
            </Card>
          ))}
          <Button component={Link} to="/mobile/notifications" variant="outlined" sx={{ minHeight: 48 }}>
            Cài đặt thông báo
          </Button>
        </Stack>
      )}

      {tab === 3 && (
        <Stack spacing={1.5}>
          {recentResults.length === 0 && !ranking && (
            <Alert severity="info">
              Chưa có kết quả trận hoặc BXH cho giải hiện tại.
            </Alert>
          )}
          {ranking && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography fontWeight={800}>BXH mùa giải</Typography>
                <Typography variant="body2">
                  Hạng #{ranking.rank} · {ranking.points} điểm · {ranking.wins}W/{ranking.losses}L
                </Typography>
              </CardContent>
            </Card>
          )}
          {recentResults.map((match) => (
            <Card key={match.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography fontWeight={700}>
                  {match.resultLabel || match.outcome?.won ? "Thắng" : "Thua"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {match.tournamentName || match.tournamentId} · {match.scoreA}-{match.scoreB}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
