import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  canAccessOperationsDashboard,
  loadOperationsDashboard,
} from "../../features/mobile/services/operationsDashboardService.js";
import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";

function MetricCard({ label, value, color = "primary" }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={900} color={`${color}.main`}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function OperationsMobileDashboardPage() {
  const auth = useAuth();
  const { activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  const scope = { clubId: activeClubId, tenantId: currentTenantId, venueId: currentTenantId };
  const allowed = canAccessOperationsDashboard(auth.user, scope);

  const refresh = useCallback(async () => {
    if (!activeClubId || !allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await loadOperationsDashboard({
      clubId: activeClubId,
      tenantId: currentTenantId,
      user: auth.user,
    });
    if (!result.ok) {
      setError(result.error || "Không tải được dữ liệu vận hành.");
      setDashboard(null);
    } else {
      setDashboard(result);
    }
    setLoading(false);
  }, [activeClubId, allowed, auth.user, currentTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!allowed) {
    return (
      <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
        <Alert severity="warning">
          Bạn không có quyền xem dashboard vận hành mobile.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ px: MOBILE_PAGE_GUTTER, py: 6, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Đang tải dữ liệu vận hành...
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

  const { metrics, mode, courtStatus, bookings, unpaidBookings, tournaments, quickActions } =
    dashboard || {};

  const modeLabel =
    mode === "owner" ? "Chủ sân" : mode === "cashier" ? "Thu ngân" : "Nhân viên";

  return (
    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <DashboardIcon color="primary" />
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Vận hành
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {modeLabel} · {dashboard?.date}
          </Typography>
        </Box>
      </Stack>

      {dashboard?.subscriptionWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {dashboard.subscriptionWarning}
        </Alert>
      )}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <MetricCard label="Booking hôm nay" value={metrics?.bookingsToday ?? 0} />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Check-in" value={metrics?.checkinsToday ?? 0} color="success" />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Sân đang chơi" value={metrics?.courtsPlaying ?? 0} />
        </Grid>
        <Grid item xs={6}>
          <MetricCard label="Sân trống" value={metrics?.courtsIdle ?? 0} color="info" />
        </Grid>
        {mode !== "cashier" && (
          <Grid item xs={6}>
            <MetricCard
              label="Sắp kết thúc"
              value={metrics?.courtsEndingSoon ?? 0}
              color="warning"
            />
          </Grid>
        )}
        {mode === "owner" && (
          <Grid item xs={6}>
            <MetricCard
              label="Doanh thu hôm nay"
              value={`${(metrics?.revenueToday || 0).toLocaleString("vi-VN")}đ`}
            />
          </Grid>
        )}
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {quickActions?.canCreateBooking && (
          <Button component={Link} to="/court-management" variant="contained" size="small">
            Tạo booking
          </Button>
        )}
        {quickActions?.canCheckIn && (
          <Button component={Link} to="/mobile/check-in" variant="outlined" size="small">
            Check-in
          </Button>
        )}
        {quickActions?.canRecordPayment && (
          <Button component={Link} to="/court-management" variant="outlined" size="small">
            Ghi nhận thanh toán
          </Button>
        )}
      </Stack>

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        Trạng thái sân
      </Typography>
      {courtStatus?.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chưa có sân nào trong CLB.
        </Alert>
      )}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {(courtStatus || []).map((court) => (
          <Card key={court.courtId} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700}>{court.courtName}</Typography>
                <Chip
                  size="small"
                  label={
                    court.state === "playing"
                      ? `Đang chơi${court.endsInMinutes != null ? ` · còn ${court.endsInMinutes}p` : ""}`
                      : court.state === "upcoming"
                        ? "Sắp bắt đầu"
                        : "Trống"
                  }
                  color={
                    court.state === "playing"
                      ? "success"
                      : court.state === "upcoming"
                        ? "warning"
                        : "default"
                  }
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {mode === "cashier" ? (
        <>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Booking cần thanh toán
          </Typography>
          {unpaidBookings?.length === 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Không có booking chờ thanh toán hôm nay.
            </Alert>
          )}
          <Stack spacing={1} sx={{ mb: 2 }}>
            {(unpaidBookings || []).map((b) => (
              <Card key={b.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.25 }}>
                  <Typography fontWeight={700}>
                    {b.customerName || b.customer || "Khách"} · {b.startTime}–{b.endTime}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {b.courtName || b.courtId} · {b.paymentStatus || "chưa thanh toán"}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      ) : (
        <>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Booking hôm nay
          </Typography>
          {bookings?.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Chưa có booking nào hôm nay.
            </Alert>
          )}
          <Stack spacing={1} sx={{ mb: 2 }}>
            {(bookings || []).slice(0, 8).map((b) => (
              <Card key={b.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.25 }}>
                  <Typography fontWeight={700}>
                    {b.customerName || b.customer || "Khách"} · {b.startTime}–{b.endTime}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {b.courtName || b.courtId}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {mode === "owner" && (
        <>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Giải đang chạy
          </Typography>
          {tournaments?.length === 0 ? (
            <Alert severity="info">Không có giải đang hoạt động.</Alert>
          ) : (
            <Stack spacing={1}>
              {tournaments.map((t) => (
                <Card key={t.id} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.25 }}>
                    <Typography fontWeight={700}>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.status}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
