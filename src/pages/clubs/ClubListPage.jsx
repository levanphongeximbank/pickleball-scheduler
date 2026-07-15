import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import BlockIcon from "@mui/icons-material/Block";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

import { useTenant } from "../../context/TenantContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { isPlatformScopedRole } from "../../auth/roles.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  CLUB_STATUSES,
  deactivateClub,
  getClubStats,
  getClubsVisibleToUser,
  canApproveClubRegistration,
  approveClubRegistration,
  rejectClubRegistration,
  isClubStorageV2Enabled,
} from "../../features/club/index.js";
import {
  ClubEmptyState,
  ClubFeedbackAlert,
  ClubPageShell,
  ClubRegistrySkeleton,
  ClubStatusBadge,
  clubRegistryPaperSx,
} from "../../features/club/ui/index.js";
import { CLUB_REGISTRY_SCOPE } from "../../features/club/registry/clubRegistryCache.js";
import { useClubRegistry } from "../../features/club/hooks/useClubRegistry.js";
import { syncClubRegistryForUser } from "../../features/club/services/clubRegistryCloudSync.js";
import { syncClubsToLegacyRegistry } from "../../features/club/services/clubOfflineCommandAdapter.js";
import ClubFormDialog from "./ClubFormDialog.jsx";
import ClubDeactivateDialog from "./ClubDeactivateDialog.jsx";

const SORT_OPTIONS = [
  { value: "name", label: "Tên CLB" },
  { value: "members", label: "Số thành viên" },
  { value: "elo", label: "ELO trung bình" },
  { value: "created", label: "Ngày tạo" },
];

export default function ClubListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTenantId, currentTenant, revision, refreshTenant, isSuperAdmin } = useTenant();
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editClub, setEditClub] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [syncSaving, setSyncSaving] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);

  const storageV2 = isClubStorageV2Enabled();
  const registryFilters = useMemo(
    () => ({
      search,
      status: statusFilter,
      includeInactive: statusFilter === "all",
    }),
    [search, statusFilter]
  );

  const registry = useClubRegistry({
    scope: CLUB_REGISTRY_SCOPE.TENANT,
    tenantId: storageV2 ? currentTenantId : null,
    filters: registryFilters,
    enabled: storageV2 && Boolean(currentTenantId) && isAuthenticated,
  });

  const canSyncCloud = !storageV2 && (isSuperAdmin || isPlatformScopedRole(user?.role));

  useEffect(() => {
    if (storageV2 || !isAuthenticated || !user?.id) {
      return;
    }
    void syncClubRegistryForUser(user).then((result) => {
      if (result.ok) {
        setLocalRevision((value) => value + 1);
      }
    });
  }, [isAuthenticated, storageV2, user, revision]);

  const canCreate =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.CLUB_CREATE, { venueId: currentTenantId, tenantId: currentTenantId });
  const canUpdate =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.CLUB_UPDATE, { venueId: currentTenantId, tenantId: currentTenantId });

  const clubsWithStats = useMemo(() => {
    if (storageV2) {
      return (registry.clubs || []).map((row) => ({
        club: {
          id: row.id,
          name: row.name,
          code: row.code,
          status: row.status,
          createdAt: row.createdAt,
          tenantId: row.tenantId,
          governance: {
            ownerUserId: row._raw?.governance?.ownerUserId || row._raw?.owner_user_id,
            presidentUserId: row._raw?.governance?.presidentUserId || row._raw?.president_user_id,
          },
        },
        stats: {
          memberCount: row.memberCount ?? 0,
          avgElo: 0,
          tournamentCount: 0,
          ownerName: row.ownerName,
          presidentName: row.presidentName,
        },
      }));
    }

    const clubs = getClubsVisibleToUser(currentTenantId, user).filter((c) => !c.isDefault);
    return clubs.map((club) => ({
      club,
      stats: getClubStats(
        club.id,
        club.tenantId || club.venueId || currentTenantId
      ) || {
        memberCount: 0,
        avgElo: 0,
        tournamentCount: 0,
      },
    }));
  }, [currentTenantId, user, revision, localRevision, registry.clubs, storageV2]);

  useEffect(() => {
    if (searchParams.get("create") === "1" && canCreate) {
      setEditClub(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canCreate, setSearchParams]);

  const filtered = useMemo(() => {
    let rows = [...clubsWithStats];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        ({ club }) =>
          club.name.toLowerCase().includes(q) ||
          String(club.code || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      rows = rows.filter(({ club }) => club.status === statusFilter);
    }

    rows.sort((a, b) => {
      switch (sortBy) {
        case "members":
          return b.stats.memberCount - a.stats.memberCount;
        case "elo":
          return b.stats.avgElo - a.stats.avgElo;
        case "created":
          return new Date(b.club.createdAt) - new Date(a.club.createdAt);
        default:
          return a.club.name.localeCompare(b.club.name, "vi");
      }
    });

    return rows;
  }, [clubsWithStats, search, statusFilter, sortBy]);

  const bumpList = () => {
    if (storageV2) {
      void registry.invalidate();
    } else {
      setLocalRevision((v) => v + 1);
    }
    refreshTenant();
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditClub(null);
    bumpList();
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const result = await deactivateClub(deactivateTarget.id, currentTenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeactivateTarget(null);
    bumpList();
  };

  const handleApprove = (club) => {
    const result = approveClubRegistration(club.id, currentTenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    bumpList();
  };

  const handleReject = (club) => {
    const result = rejectClubRegistration(club.id, currentTenantId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    bumpList();
  };

  const handleSyncToCloud = async () => {
    if (storageV2) {
      setError(
        "Đồng bộ legacy club_upsert_registry đã nghỉ hưu khi Club Storage V2 bật."
      );
      return;
    }

    setError(null);
    setMessage(null);
    setSyncSaving(true);

    const clubs = clubsWithStats.map(({ club }) => club);
    const result = await syncClubsToLegacyRegistry({
      clubs,
      venueId: canSyncCloud ? null : currentTenantId,
      actor: user,
    });

    setSyncSaving(false);

    if (!result.ok) {
      setError(result.error || "Đồng bộ CLB lên cloud thất bại.");
      return;
    }

    let successText = `Đã đồng bộ ${result.synced ?? 0} CLB lên Supabase.`;
    if (result.skipped > 0) {
      successText += ` Bỏ qua ${result.skipped} CLB thiếu Chủ tịch UUID hợp lệ.`;
    }
    setMessage(successText);
    setLocalRevision((value) => value + 1);
    refreshTenant();
  };

  const handlePullFromCloud = async () => {
    setError(null);
    setMessage(null);
    setSyncSaving(true);

    const result = await syncClubRegistryForUser(user);
    setSyncSaving(false);

    if (!result.ok) {
      setError(result.error || "Không tải được danh sách CLB từ cloud.");
      return;
    }

    setMessage(
      `Đã tải ${result.pulled ?? 0} CLB từ cloud` +
        (result.pushed ? `, đẩy thêm ${result.pushed} CLB local.` : ".")
    );
    setLocalRevision((value) => value + 1);
    refreshTenant();
  };

  if (!currentTenantId) {
    return (
      <Alert severity="info">
        {isSuperAdmin || isPlatformScopedRole(user?.role)
          ? "Chọn tenant ở header trước khi quản lý sổ đăng ký CLB."
          : "Chưa xác định được tenant. Vui lòng đăng nhập hoặc liên hệ quản trị."}
      </Alert>
    );
  }

  if (storageV2 && registry.loading) {
    return (
      <ClubPageShell
        title="Quản lý CLB"
        subtitle={`Tenant: ${currentTenant?.name || currentTenantId}`}
        breadcrumbs={[
          { label: "Quản lý", href: "/manage/clubs" },
          { label: "Sổ đăng ký CLB" },
        ]}
        maxWidth={1400}
      >
        <ClubRegistrySkeleton />
      </ClubPageShell>
    );
  }

  if (storageV2 && registry.error) {
    return (
      <ClubPageShell
        title="Quản lý CLB"
        subtitle={`Tenant: ${currentTenant?.name || currentTenantId}`}
        breadcrumbs={[
          { label: "Quản lý", href: "/manage/clubs" },
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

  const headerActions = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {canSyncCloud && (
        <>
          <Button
            variant="outlined"
            startIcon={<CloudDownloadIcon />}
            onClick={() => void handlePullFromCloud()}
            disabled={syncSaving}
          >
            {syncSaving ? "Đang tải…" : "Tải từ cloud"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudSyncIcon />}
            onClick={() => void handleSyncToCloud()}
            disabled={syncSaving || filtered.length === 0}
          >
            {syncSaving ? "Đang đồng bộ…" : "Đồng bộ lên cloud"}
          </Button>
        </>
      )}
      <PermissionGate permission={PERMISSIONS.CLUB_CREATE} scope={{ venueId: currentTenantId }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditClub(null);
            setFormOpen(true);
          }}
          disabled={!canCreate}
        >
          Tạo CLB mới
        </Button>
      </PermissionGate>
    </Stack>
  );

  return (
    <ClubPageShell
      title="Quản lý CLB"
      subtitle={`Tenant: ${currentTenant?.name || currentTenantId} · ${currentTenantId}`}
      breadcrumbs={[
        { label: "Quản lý", href: "/manage/clubs" },
        { label: "Sổ đăng ký CLB" },
      ]}
      actions={headerActions}
      maxWidth={1400}
    >
      <ClubFeedbackAlert
        message={message ? { type: "success", text: message } : null}
        onClose={() => setMessage(null)}
      />
      <ClubFeedbackAlert message={error ? { type: "error", text: error } : null} onClose={() => setError(null)} />

      <Paper sx={clubRegistryPaperSx}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Tìm theo tên / mã CLB"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            select
            label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value={CLUB_STATUSES.ACTIVE}>Đang hoạt động</MenuItem>
            <MenuItem value={CLUB_STATUSES.PENDING_SETUP}>Chờ thiết lập</MenuItem>
            <MenuItem value={CLUB_STATUSES.PENDING_APPROVAL}>Chờ chủ sân duyệt</MenuItem>
            <MenuItem value={CLUB_STATUSES.INACTIVE}>Vô hiệu hóa</MenuItem>
          </TextField>
          <TextField
            select
            label="Sắp xếp"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {filtered.length === 0 ? (
        <ClubEmptyState
          preset={search || statusFilter !== "all" ? "registryFilter" : "registry"}
          actionLabel={canCreate && !search && statusFilter === "all" ? "Tạo CLB đầu tiên" : undefined}
          onAction={
            canCreate && !search && statusFilter === "all"
              ? () => {
                  setEditClub(null);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên CLB</TableCell>
                <TableCell>Mã</TableCell>
                {storageV2 && <TableCell>Chủ sở hữu</TableCell>}
                {storageV2 && <TableCell>Chủ tịch</TableCell>}
                <TableCell align="right">Thành viên</TableCell>
                {!storageV2 && <TableCell align="right">ELO TB</TableCell>}
                {!storageV2 && <TableCell align="right">Giải nội bộ</TableCell>}
                <TableCell>Trạng thái</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(({ club, stats }) => (
                <TableRow key={club.id} hover>
                  <TableCell>{club.name}</TableCell>
                  <TableCell>{club.code || "—"}</TableCell>
                  {storageV2 && <TableCell>{stats.ownerName || "—"}</TableCell>}
                  {storageV2 && <TableCell>{stats.presidentName || "—"}</TableCell>}
                  <TableCell align="right">{stats.memberCount}</TableCell>
                  {!storageV2 && <TableCell align="right">{stats.avgElo || "—"}</TableCell>}
                  {!storageV2 && <TableCell align="right">{stats.tournamentCount}</TableCell>}
                  <TableCell>
                    <ClubStatusBadge status={club.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(club.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Xem chi tiết">
                      <IconButton size="small" onClick={() => navigate(`/manage/clubs/${club.id}`)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canApproveClubRegistration(user, club) && (
                      <>
                        <Tooltip title="Duyệt CLB">
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ ml: 0.5 }}
                            onClick={() => handleApprove(club)}
                          >
                            Duyệt
                          </Button>
                        </Tooltip>
                        <Tooltip title="Từ chối">
                          <Button
                            size="small"
                            color="inherit"
                            sx={{ ml: 0.5 }}
                            onClick={() => handleReject(club)}
                          >
                            Từ chối
                          </Button>
                        </Tooltip>
                      </>
                    )}
                    {canUpdate && (
                      <>
                        <Tooltip title="Chỉnh sửa">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditClub(club);
                              setFormOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {club.status === CLUB_STATUSES.ACTIVE && (
                          <Tooltip title="Vô hiệu hóa">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => setDeactivateTarget(club)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ClubFormDialog
        open={formOpen}
        club={editClub}
        tenantId={currentTenantId}
        onClose={() => {
          setFormOpen(false);
          setEditClub(null);
        }}
        onSuccess={handleFormSuccess}
      />

      <ClubDeactivateDialog
        open={Boolean(deactivateTarget)}
        club={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
      />
    </ClubPageShell>
  );
}
