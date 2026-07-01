import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import SyncIcon from "@mui/icons-material/Sync";

import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { getCheckinDashboard, buildCheckinSummaryForPlayers } from "../../features/mobile/services/checkInService.js";
import { getOfflineSnapshotSummary } from "../../features/mobile/services/offlineCache.js";
import {
  flushOfflineQueue,
  getOfflineQueueStatusSummary,
} from "../../features/mobile/services/offlineQueue.js";
import { useOfflineStatus } from "../../features/mobile/hooks/useOfflineStatus.js";
import { buildOfflineQueueBannerModel } from "../../features/mobile/utils/offlineQueueStatus.js";
import CheckInStatusChip from "../../features/mobile/components/CheckInStatusChip.jsx";
import ResponsiveDataView from "../../features/mobile/components/ResponsiveDataView.jsx";
import { CHECKIN_STATUS } from "../../features/mobile/constants/checkInStatus.js";
import { MOBILE_PAGE_GUTTER } from "../../components/tournament/mobileUi.js";

export default function CheckInDashboardPage() {
  const { activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [checkins, setCheckins] = useState([]);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0, late: 0, invalid: 0 });
  const [cacheSummary, setCacheSummary] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSummary, setQueueSummary] = useState(getOfflineQueueStatusSummary());
  const { isOffline, pendingCount, refreshPending } = useOfflineStatus();

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId]
  );

  const refresh = useCallback(async () => {
    const result = await getCheckinDashboard({
      tenantId: currentTenantId,
      filters: { search, status: statusFilter || undefined },
    });
    if (result.ok) {
      setCheckins(result.checkins);
      setStats(result.stats);
    }
  }, [currentTenantId, search, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setQueueSummary(getOfflineQueueStatusSummary());
  }, [pendingCount, isOffline, isSyncing, activeClubId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCacheSummary() {
      if (!activeClubId) {
        return;
      }
      const result = await getOfflineSnapshotSummary(activeClubId);
      if (!cancelled) {
        setCacheSummary(result.ok ? result : null);
      }
    }
    loadCacheSummary();
    return () => {
      cancelled = true;
    };
  }, [activeClubId]);

  const summary = useMemo(
    () => buildCheckinSummaryForPlayers({ players, checkins }),
    [players, checkins]
  );
  const queueBanner = useMemo(
    () => buildOfflineQueueBannerModel({ pendingCount, isOffline, isSyncing }),
    [pendingCount, isOffline, isSyncing]
  );

  const handleSyncNow = async () => {
    setIsSyncing(true);
    const result = await flushOfflineQueue();
    refreshPending();
    setQueueSummary(getOfflineQueueStatusSummary());
    setIsSyncing(false);
    if (result.conflicts?.length > 0) {
      window.alert(`Đồng bộ xong nhưng có ${result.conflicts.length} xung đột. Vui lòng kiểm tra thủ công.`);
    }
  };

  const columns = [
    { field: "name", headerName: "Tên", render: (row) => row.player?.name || row.entity_id },
    { field: "phone", headerName: "SĐT", render: (row) => row.player?.phone || "—" },
    { field: "code", headerName: "Mã", render: (row) => row.player?.id?.slice(-6) || "—" },
    {
      field: "status",
      headerName: "Trạng thái",
      render: (row) => <CheckInStatusChip status={row.status} />,
    },
  ];

  const filteredRows = summary.rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) {
      return false;
    }
    if (!search) {
      return true;
    }
    const q = search.toLowerCase();
    return (
      String(row.player?.name || "").toLowerCase().includes(q) ||
      String(row.player?.phone || "").includes(q) ||
      String(row.player?.id || "").toLowerCase().includes(q)
    );
  });

  return (
    <Box sx={{ px: MOBILE_PAGE_GUTTER, pb: { xs: 10, md: 3 } }}>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        Check-in Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tổng quan check-in giải / CLB / sân
      </Typography>

      {cacheSummary?.hasSnapshot && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {isOffline
            ? "Bạn đang xem dữ liệu cache gần nhất cho CLB này. Các thay đổi mới sẽ tự đồng bộ khi mạng trở lại."
            : `Đã có bản cache offline cho ${cacheSummary.itemCount} mục, sẵn sàng khi mạng không ổn định.`}
        </Alert>
      )}

      {queueSummary && (queueSummary.total > 0 || queueSummary.lastSyncAt) && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>Tình trạng đồng bộ</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chờ gửi: {queueSummary.pending} • Đã gửi: {queueSummary.synced} • Xung đột: {queueSummary.conflict}
                </Typography>
                {queueSummary.lastSyncAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                    Cập nhật lần cuối: {new Date(queueSummary.lastSyncAt).toLocaleString("vi-VN")}
                  </Typography>
                )}
              </Box>
              {queueBanner.showAction && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {queueBanner.showBanner && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {queueBanner.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {queueBanner.message}
                </Typography>
                {pendingCount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {pendingCount} thao tác đang chờ xử lý từ thiết bị này.
                  </Typography>
                )}
              </Box>
              {queueBanner.showAction && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? "Đang đồng bộ..." : queueBanner.actionLabel}
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <Button
          component={Link}
          to="/mobile/qr-scan"
          variant="contained"
          startIcon={<QrCodeScannerIcon />}
          sx={{ minHeight: 48 }}
        >
          Quét QR
        </Button>
        <Button
          component={Link}
          to="/mobile/qr-generate"
          variant="outlined"
          startIcon={<QrCode2Icon />}
          sx={{ minHeight: 48 }}
        >
          Tạo QR
        </Button>
      </Stack>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: "Đăng ký", value: summary.totalRegistered, color: "#0f766e", hint: "Tổng người tham gia" },
          { label: "Đã check-in", value: summary.checkedIn, color: "#16a34a", hint: "Đã xác nhận" },
          { label: "Chưa check-in", value: summary.notCheckedIn, color: "#64748b", hint: "Còn chờ" },
          { label: "Đến muộn", value: stats.late, color: "#d97706", hint: "Muộn hơn kế hoạch" },
          { label: "Không hợp lệ", value: stats.invalid, color: "#dc2626", hint: "Cần kiểm tra" },
        ].map((item) => (
          <Grid key={item.label} size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ color: item.color }}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {item.hint}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Tìm tên, SĐT, mã VĐV..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ minWidth: { sm: 160 } }}
        >
          <option value="">Tất cả</option>
          {Object.values(CHECKIN_STATUS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </TextField>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label="Danh sách VĐV" />
        <Tab label="Lịch sử scan" />
      </Tabs>

      {tab === 0 && (
        <ResponsiveDataView
          columns={columns}
          rows={filteredRows}
          getRowKey={(row) => row.player?.id}
          emptyMessage="Chưa có VĐV đăng ký."
        />
      )}

      {tab === 1 && (
        <Stack spacing={1}>
          {checkins.length === 0 && (
            <Alert severity="info">Chưa có lịch sử check-in.</Alert>
          )}
          {checkins.map((c) => (
            <Card key={c.id} variant="outlined" sx={{ borderRadius: 2, borderColor: "divider" }}>
              <CardContent sx={{ py: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800} sx={{ mb: 0.25 }}>
                      {c.entity_type}: {c.entity_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {new Date(c.checked_in_at).toLocaleString("vi-VN")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nguồn: {c.source}
                    </Typography>
                  </Box>
                  <CheckInStatusChip status={c.status} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
