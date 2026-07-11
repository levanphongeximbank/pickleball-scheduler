import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useAuth } from "../../context/AuthContext.jsx";
import { isGlobalRole, isPlatformScopedRole } from "../../auth/roles.js";
import { CLUB_REGISTRY_SCOPE } from "../../features/club/registry/clubRegistryCache.js";
import { useClubRegistry } from "../../features/club/hooks/useClubRegistry.js";
import { paginateRegistryRows } from "../../features/club/services/clubRegistryService.js";
import { listTenants } from "../../features/tenant/index.js";
import {
  ClubEmptyState,
  ClubPageShell,
  ClubRegistrySkeleton,
  ClubStatusBadge,
  clubRegistryPaperSx,
} from "../../features/club/ui/index.js";

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
    return (
      <ClubPageShell title="Sổ đăng ký CLB (Platform)" maxWidth={1400}>
        <Alert severity="error">
          Chỉ Platform Admin / Super Admin được xem sổ đăng ký toàn nền tảng.
        </Alert>
      </ClubPageShell>
    );
  }

  if (registry.loading) {
    return (
      <ClubPageShell
        title="Sổ đăng ký CLB (Platform)"
        subtitle="Cross-tenant read-only registry — không tự tạo membership cho Super Admin."
        breadcrumbs={[
          { label: "Platform", href: "/platform/clubs" },
          { label: "Sổ đăng ký CLB" },
        ]}
        maxWidth={1400}
      >
        <ClubRegistrySkeleton />
      </ClubPageShell>
    );
  }

  if (registry.error) {
    return (
      <ClubPageShell
        title="Sổ đăng ký CLB (Platform)"
        breadcrumbs={[
          { label: "Platform", href: "/platform/clubs" },
          { label: "Sổ đăng ký CLB" },
        ]}
        maxWidth={1400}
      >
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
      </ClubPageShell>
    );
  }

  const hasFilters = Boolean(search || tenantFilter || statusFilter !== "all");

  return (
    <ClubPageShell
      title="Sổ đăng ký CLB (Platform)"
      subtitle="Cross-tenant read-only registry — không tự tạo membership cho Super Admin."
      breadcrumbs={[
        { label: "Platform", href: "/platform/clubs" },
        { label: "Sổ đăng ký CLB" },
      ]}
      maxWidth={1400}
    >
      <Paper sx={clubRegistryPaperSx}>
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
        <ClubEmptyState preset={hasFilters ? "registryFilter" : "registry"} />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
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
                    <ClubStatusBadge status={row.status} />
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

      {pageData.total > 0 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Box component="span" sx={{ typography: "body2", color: "text.secondary" }}>
            {pageData.total} CLB · trang {pageData.page}/{pageData.totalPages}
          </Box>
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
      )}
    </ClubPageShell>
  );
}
