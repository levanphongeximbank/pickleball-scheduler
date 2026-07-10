import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useAuth } from "../../context/AuthContext.jsx";
import { isGlobalRole, isPlatformScopedRole } from "../../auth/roles.js";
import { CLUB_REGISTRY_SCOPE } from "../../features/club/registry/clubRegistryCache.js";
import { useClubRegistry } from "../../features/club/hooks/useClubRegistry.js";
import { paginateRegistryRows } from "../../features/club/services/clubRegistryService.js";
import { CLUB_STATUS_LABELS } from "../../features/club/index.js";
import { listTenants } from "../../features/tenant/index.js";

export default function PlatformClubsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("");
  const [page, setPage] = useState(1);

  const allowed = Boolean(
    user && (isGlobalRole(user.role) || isPlatformScopedRole(user.role))
  );

  const filters = useMemo(
    () => ({
      search,
      status: statusFilter,
      tenantFilter: tenantFilter || null,
      includeInactive: statusFilter === "all",
    }),
    [search, statusFilter, tenantFilter]
  );

  const registry = useClubRegistry({
    scope: CLUB_REGISTRY_SCOPE.PLATFORM,
    filters,
    enabled: allowed,
  });

  const pageData = useMemo(
    () => paginateRegistryRows(registry.clubs || [], { page, pageSize: 25 }),
    [registry.clubs, page]
  );

  const tenants = useMemo(() => listTenants(), []);

  if (!allowed) {
    return <Alert severity="error">Chỉ Platform Admin / Super Admin được xem sổ đăng ký toàn nền tảng.</Alert>;
  }

  if (registry.loading) {
    return (
      <Box>
        <Skeleton variant="text" width="50%" height={40} />
        <Skeleton variant="rounded" height={360} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (registry.error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void registry.reload()}>
            Thử lại
          </Button>
        }
      >
        {registry.error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Sổ đăng ký CLB (Platform)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cross-tenant read-only registry — không tự tạo membership cho Super Admin.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Tìm kiếm"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            fullWidth
          />
          <TextField
            select
            label="Tenant"
            size="small"
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả tenant</MenuItem>
            {tenants.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name || t.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Trạng thái"
            size="small"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="pending_approval">Chờ duyệt</MenuItem>
            <MenuItem value="inactive">Vô hiệu</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {pageData.total === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Không có CLB phù hợp bộ lọc.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Tên CLB</TableCell>
                <TableCell>Mã</TableCell>
                <TableCell>Chủ sở hữu</TableCell>
                <TableCell>Chủ tịch</TableCell>
                <TableCell align="right">Thành viên</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData.rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.tenantId}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.code || "—"}</TableCell>
                  <TableCell>{row.ownerName || "—"}</TableCell>
                  <TableCell>{row.presidentName || "—"}</TableCell>
                  <TableCell align="right">{row.memberCount ?? 0}</TableCell>
                  <TableCell>
                    <Chip size="small" label={CLUB_STATUS_LABELS[row.status] || row.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Xem chi tiết tenant registry">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/manage/clubs/${row.id}`)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {pageData.total} CLB · trang {pageData.page}/{pageData.totalPages}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Trước
          </Button>
          <Button
            disabled={page >= pageData.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
