import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DirectionsIcon from "@mui/icons-material/Directions";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditIcon from "@mui/icons-material/Edit";

import { useTenant } from "../../context/TenantContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCluster } from "../../context/ClusterContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { isPlatformScopedRole } from "../../auth/roles.js";
import { listTenants, getTenantById } from "../../features/tenant/index.js";
import { isCourtClustersEnabled } from "../../features/court-cluster/config/clusterFlags.js";
import {
  createCourtCluster,
  getClusterById,
  isClusterAssigned,
  listAssignmentsForCluster,
  ADMIN_ALL_TENANTS_ID,
  listClustersForAdminManagement,
  listClustersForVenue,
  updateCourtCluster,
} from "../../features/court-cluster/services/courtClusterService.js";
import {
  assignClusterOwnerToUser,
  persistCourtClusterToCloud,
  removeClusterOwner,
  removeCourtCluster,
  syncClustersForVenueToCloud,
} from "../../features/court-cluster/services/courtClusterAdminService.js";
import { pullClusterContextForUser } from "../../features/court-cluster/services/courtClusterCloudSync.js";
import { isValidProfileUserId } from "../../features/court-cluster/utils/profileUserId.js";
import { listUsers } from "../../features/identity/services/userManagementService.js";
import { openClusterInGoogleMaps } from "../../features/court-cluster/utils/clusterMapsUtils.js";
import {
  listPendingCourtClaimRequests,
  reviewCourtClaimRequest,
} from "../../features/court-cluster/services/courtClaimRequestService.js";
import { fetchProfileByUserId } from "../../auth/profileService.js";

const EMPTY_FORM = {
  name: "",
  slug: "",
  address: "",
  googleMapsUrl: "",
};

export default function CourtClusterManagement() {
  const { currentTenantId, currentTenant, switchTenant, isSuperAdmin } = useTenant();
  const { user, can, rbacEnabled } = useAuth();
  const { refreshClusters } = useCluster();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingCluster, setEditingCluster] = useState(null);
  const [assignForm, setAssignForm] = useState({
    user: null,
    clusterIds: [],
  });
  const [assignUsers, setAssignUsers] = useState([]);
  const [assignUsersLoading, setAssignUsersLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoCluster, setInfoCluster] = useState(null);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [removeOwnerSaving, setRemoveOwnerSaving] = useState(false);
  const [removeOwnerConfirmOpen, setRemoveOwnerConfirmOpen] = useState(false);
  const [clusterRevision, setClusterRevision] = useState(0);
  const [venueFilter, setVenueFilter] = useState(ADMIN_ALL_TENANTS_ID);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const canPickTenant = isSuperAdmin || isPlatformScopedRole(user?.role);
  const tenants = useMemo(() => listTenants(), [message]);
  const effectiveVenueId = canPickTenant
    ? venueFilter === ADMIN_ALL_TENANTS_ID
      ? ADMIN_ALL_TENANTS_ID
      : venueFilter || currentTenantId || user?.venueId || null
    : currentTenantId || user?.venueId || null;
  const venueId =
    effectiveVenueId === ADMIN_ALL_TENANTS_ID ? ADMIN_ALL_TENANTS_ID : effectiveVenueId;
  const createVenueId =
    effectiveVenueId === ADMIN_ALL_TENANTS_ID ? null : effectiveVenueId;
  const clusters = useMemo(
    () => listClustersForAdminManagement(user, venueId),
    [user, venueId, message, clusterRevision]
  );
  const showVenueColumn =
    canPickTenant &&
    (venueFilter === ADMIN_ALL_TENANTS_ID ||
      clusters.some((cluster) => cluster.venueId !== effectiveVenueId));
  const organizationLabel =
    venueFilter === ADMIN_ALL_TENANTS_ID
      ? "Tất cả"
      : getTenantById(effectiveVenueId)?.name || effectiveVenueId || "—";
  const canManage =
    !rbacEnabled ||
    can(PERMISSIONS.CLUSTER_MANAGE, {
      tenantId: effectiveVenueId === ADMIN_ALL_TENANTS_ID ? null : effectiveVenueId,
      venueId: effectiveVenueId === ADMIN_ALL_TENANTS_ID ? null : effectiveVenueId,
    });

  useEffect(() => {
    if (!canPickTenant && currentTenantId) {
      setVenueFilter(currentTenantId);
    }
  }, [canPickTenant, currentTenantId]);

  useEffect(() => {
    if (!isCourtClustersEnabled()) {
      setError("Bật VITE_COURT_CLUSTERS_ENABLED=true để quản lý cụm sân.");
    }
  }, []);

  useEffect(() => {
    if (!canManage || !user?.id) {
      return;
    }
    void pullClusterContextForUser(user).then((result) => {
      if (result.ok) {
        refreshClusters();
        setClusterRevision((value) => value + 1);
      }
    });
  }, [canManage, refreshClusters, user]);

  const loadPendingClaims = async () => {
    const result = await listPendingCourtClaimRequests();
    if (result.ok) {
      setPendingClaims(result.requests || []);
    }
  };

  useEffect(() => {
    if (canManage) {
      void loadPendingClaims();
    }
  }, [canManage, message]);

  const handleReviewClaim = async (requestId, action) => {
    setReviewingId(requestId);
    setError(null);
    const result = await reviewCourtClaimRequest({
      requestId,
      action,
      reviewNote,
    });
    setReviewingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(action === "approve" ? "Đã duyệt yêu cầu gắn cụm." : "Đã từ chối yêu cầu.");
    setReviewNote("");
    refreshClusters();
    await loadPendingClaims();
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingCluster(null);
  };

  const handleCreate = async () => {
    setError(null);
    setCreateSaving(true);
    const result = createCourtCluster({
      venueId: createVenueId,
      name: form.name,
      slug: form.slug || undefined,
      address: form.address,
      googleMapsUrl: form.googleMapsUrl,
      ownerUserId: user?.id || null,
      user,
    });

    if (!result.ok) {
      setCreateSaving(false);
      setError(result.error);
      return;
    }

    const cloudResult = await persistCourtClusterToCloud(result.cluster, { venueId, actor: user });
    setCreateSaving(false);

    if (!cloudResult.ok) {
      setError(cloudResult.error || "Không đồng bộ được cụm lên Supabase.");
      return;
    }

    setMessage(`Đã tạo cụm sân: ${result.cluster.name}`);
    setCreateOpen(false);
    resetForm();
    refreshClusters();
  };

  const openEditDialog = (cluster) => {
    setEditingCluster(cluster);
    setForm({
      name: cluster.name || "",
      slug: cluster.slug || "",
      address: cluster.address || "",
      googleMapsUrl: cluster.googleMapsUrl || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingCluster) {
      return;
    }

    setError(null);
    setEditSaving(true);
    const result = updateCourtCluster(
      editingCluster.id,
      {
        name: form.name,
        slug: form.slug || undefined,
        address: form.address,
        googleMapsUrl: form.googleMapsUrl,
      },
      { user }
    );

    if (!result.ok) {
      setEditSaving(false);
      setError(result.error);
      return;
    }

    const cloudResult = await persistCourtClusterToCloud(result.cluster, { venueId, actor: user });
    setEditSaving(false);

    if (!cloudResult.ok) {
      setError(cloudResult.error || "Không đồng bộ được cụm lên Supabase.");
      return;
    }

    setMessage(`Đã cập nhật cụm sân: ${result.cluster.name}`);
    setEditOpen(false);
    resetForm();
    refreshClusters();
  };

  const handleToggleStatus = async (cluster) => {
    const nextStatus = cluster.status === "active" ? "inactive" : "active";
    const result = updateCourtCluster(cluster.id, { status: nextStatus }, { user });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const cloudResult = await persistCourtClusterToCloud(result.cluster, { venueId, actor: user });
    if (!cloudResult.ok) {
      setError(cloudResult.error || "Không đồng bộ trạng thái lên Supabase.");
      return;
    }

    setMessage(`Cập nhật trạng thái: ${result.cluster.name}`);
    refreshClusters();
  };

  const handleSyncToCloud = async () => {
    setError(null);
    setSyncSaving(true);
    const result = await syncClustersForVenueToCloud({
      clusters,
      venueId,
      actor: user,
    });
    setSyncSaving(false);

    if (!result.ok) {
      setError(result.error || "Đồng bộ cụm lên cloud thất bại.");
      return;
    }

    setMessage(`Đã đồng bộ ${result.synced ?? clusters.length} cụm lên Supabase.`);
    refreshClusters();
    setClusterRevision((value) => value + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      return;
    }

    const deletedName = deleteTarget.name;
    setDeleteSaving(true);
    setError(null);
    const result = await removeCourtCluster({
      clusterId: deleteTarget.id,
      venueId: effectiveVenueId === ADMIN_ALL_TENANTS_ID ? null : effectiveVenueId,
      actor: user,
    });
    setDeleteSaving(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Đã xóa cụm sân: ${deletedName}`);
    refreshClusters();
    setClusterRevision((value) => value + 1);
  };

  const openDeleteConfirm = (cluster) => {
    setDeleteTarget(cluster);
    setDeleteConfirmOpen(true);
  };

  const openClusterInfoDialog = async (cluster) => {
    setInfoOpen(true);
    setInfoCluster(cluster);
    setOwnerUserId(null);
    setOwnerLoading(false);
    setOwnerError(null);
    setOwnerProfile(null);

    const assignments = listAssignmentsForCluster(cluster.id) || [];
    const ownerAssignment = assignments.find((a) => a.role === "CLUSTER_OWNER");
    const nextOwnerUserId = cluster?.ownerUserId || ownerAssignment?.userId || null;
    setOwnerUserId(nextOwnerUserId);

    if (!nextOwnerUserId) {
      return;
    }

    if (!isValidProfileUserId(nextOwnerUserId)) {
      setOwnerError(
        "Gán chủ sân chưa đồng bộ cloud (ID không hợp lệ). Dùng Gán chủ và chọn user từ danh sách."
      );
      return;
    }

    setOwnerLoading(true);
    const result = await fetchProfileByUserId(nextOwnerUserId);
    setOwnerLoading(false);

    if (!result.ok) {
      setOwnerError(result.error || "Không tải được thông tin chủ sở hữu.");
      return;
    }

    setOwnerProfile(result.user);
  };

  const hasClusterOwner = Boolean(
    ownerUserId || listAssignmentsForCluster(infoCluster?.id || "").some((a) => a.role === "CLUSTER_OWNER")
  );
  const ownerIdIsValid = isValidProfileUserId(ownerUserId);

  const handleRemoveOwner = async () => {
    if (!infoCluster?.id) {
      return;
    }

    setError(null);
    setRemoveOwnerSaving(true);
    const result = await removeClusterOwner({ clusterId: infoCluster.id, venueId, actor: user });
    setRemoveOwnerSaving(false);
    setRemoveOwnerConfirmOpen(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Đã xóa gán chủ sân cho cụm.");
    setOwnerUserId(null);
    setOwnerProfile(null);
    setOwnerError(null);
    refreshClusters();
    const refreshed = getClusterById(infoCluster.id);
    if (refreshed) {
      setInfoCluster(refreshed);
    }
  };

  const loadAssignUsers = async () => {
    setAssignUsersLoading(true);
    const result = await listUsers({ search: "" });
    setAssignUsersLoading(false);
    if (result.ok) {
      setAssignUsers(result.users || []);
    }
  };

  const openAssignDialog = (clusterId = null) => {
    const initialClusterIds = clusterId ? [clusterId] : [];
    setAssignForm({ user: null, clusterIds: initialClusterIds });
    setAssignOpen(true);
    void loadAssignUsers();
  };

  const handleAssign = async () => {
    setError(null);
    setAssignSaving(true);
    const result = await assignClusterOwnerToUser({
      userId: assignForm.user?.id,
      clusterIds: assignForm.clusterIds,
      venueId,
      actor: user,
    });
    setAssignSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Đã cập nhật gán chủ sân cho cụm (Supabase)");
    setAssignOpen(false);
    refreshClusters();
    setClusterRevision((value) => value + 1);
  };

  if (!canManage) {
    return <Alert severity="warning">Bạn không có quyền quản lý cụm sân.</Alert>;
  }

  const formFields = (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <TextField
        label="Tên cụm sân"
        value={form.name}
        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        placeholder="Cụm sân Nam Long"
        fullWidth
        required
      />
      <TextField
        label="Slug (tuỳ chọn)"
        value={form.slug}
        onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
        placeholder="nam-long"
        fullWidth
      />
      <TextField
        label="Địa chỉ"
        value={form.address}
        onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
        placeholder="123 Đường Nam Long, Quận 7, TP.HCM"
        fullWidth
        multiline
        minRows={2}
      />
      <TextField
        label="Link Google Maps"
        value={form.googleMapsUrl}
        onChange={(event) => setForm((prev) => ({ ...prev, googleMapsUrl: event.target.value }))}
        placeholder="https://www.google.com/maps/dir/?api=1&destination=..."
        fullWidth
        helperText="Bấm Chỉ đường sẽ mở link này trên Google Maps"
      />
    </Stack>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Quản lý cụm sân
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tổ chức: {organizationLabel}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {canPickTenant && tenants.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="cluster-tenant-picker">Chọn tổ chức</InputLabel>
              <Select
                labelId="cluster-tenant-picker"
                value={venueFilter || ADMIN_ALL_TENANTS_ID}
                label="Chọn tổ chức"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setVenueFilter(nextValue);
                  if (nextValue !== ADMIN_ALL_TENANTS_ID) {
                    switchTenant(nextValue);
                  }
                  setClusterRevision((value) => value + 1);
                }}
              >
                <MenuItem value={ADMIN_ALL_TENANTS_ID}>Tất cả</MenuItem>
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button variant="outlined" onClick={() => openAssignDialog()}>
            Gán chủ sân
          </Button>
          {canPickTenant && (
            <Button variant="outlined" onClick={handleSyncToCloud} disabled={syncSaving || clusters.length === 0}>
              {syncSaving ? "Đang đồng bộ…" : "Đồng bộ lên cloud"}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            disabled={!createVenueId}
          >
            Thêm cụm sân
          </Button>
        </Stack>
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pendingClaims.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
              Yêu cầu gắn cụm sân ({pendingClaims.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Người yêu cầu</TableCell>
                    <TableCell>Cụm sân</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell>Thời gian</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingClaims.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {request.userDisplayName || request.userId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.userEmail || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(request.clusterIds || []).map((clusterId) => {
                          const cluster = getClusterById(clusterId);
                          return (
                            <Chip
                              key={clusterId}
                              size="small"
                              label={cluster?.name || clusterId}
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          );
                        })}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap title={request.message}>
                          {request.message || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {request.requestedAt
                          ? new Date(request.requestedAt).toLocaleString("vi-VN")
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={reviewingId === request.id}
                            onClick={() => handleReviewClaim(request.id, "approve")}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            disabled={reviewingId === request.id}
                            onClick={() => handleReviewClaim(request.id, "reject")}
                          >
                            Từ chối
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TextField
              size="small"
              label="Ghi chú duyệt (áp dụng lần duyệt tiếp theo)"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Tên cụm</TableCell>
                  {showVenueColumn && <TableCell>Tổ chức</TableCell>}
                  <TableCell>Địa chỉ</TableCell>
                  <TableCell>Số sân</TableCell>
                  <TableCell>Chủ sân</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusters.map((cluster) => (
                  <TableRow key={cluster.id} hover>
                    <TableCell>{cluster.id}</TableCell>
                    <TableCell>{cluster.name}</TableCell>
                    {showVenueColumn && (
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {tenants.find((tenant) => tenant.id === cluster.venueId)?.name ||
                            cluster.venueId}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="body2" noWrap title={cluster.address || "—"}>
                        {cluster.address || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>{cluster.courtCount || 0}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isClusterAssigned(cluster.id) ? "Đã gán" : "Chưa gán"}
                        color={isClusterAssigned(cluster.id) ? "primary" : "warning"}
                        variant={isClusterAssigned(cluster.id) ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={cluster.status === "active" ? "Hoạt động" : "Tạm dừng"}
                        color={cluster.status === "active" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        <Tooltip title="Chỉ đường Google Maps">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={!cluster.googleMapsUrl}
                              onClick={() => openClusterInGoogleMaps(cluster)}
                            >
                              <DirectionsIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Thông tin cụm sân">
                          <span>
                            <IconButton size="small" color="primary" onClick={() => void openClusterInfoDialog(cluster)}>
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Button size="small" startIcon={<EditIcon />} onClick={() => openEditDialog(cluster)}>
                          Sửa
                        </Button>
                        <Button size="small" onClick={() => openAssignDialog(cluster.id)}>
                          Gán chủ
                        </Button>
                        <Button size="small" onClick={() => handleToggleStatus(cluster)}>
                          {cluster.status === "active" ? "Tạm dừng" : "Kích hoạt"}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => openDeleteConfirm(cluster)}
                        >
                          Xóa
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {clusters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showVenueColumn ? 8 : 7}>
                      <Typography variant="body2" color="text.secondary">
                        Chưa có cụm sân. Tạo cụm đầu tiên (vd. Nam Long, Nam Lý).
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Thêm cụm sân</DialogTitle>
        <DialogContent>{formFields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createSaving || !form.name.trim()}>
            {createSaving ? "Đang tạo…" : "Tạo"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sửa cụm sân</DialogTitle>
        <DialogContent>{formFields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editSaving || !form.name.trim()}>
            {editSaving ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Gán chủ sân cho cụm</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={assignUsers}
              loading={assignUsersLoading}
              value={assignForm.user}
              onChange={(_event, nextUser) =>
                setAssignForm((prev) => ({ ...prev, user: nextUser }))
              }
              getOptionLabel={(option) =>
                `${option.displayName || option.email || option.id} (${option.email || option.id})`
              }
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Chủ sân"
                  placeholder="Tìm theo tên hoặc email"
                  helperText="Chọn tài khoản từ danh sách người dùng"
                  fullWidth
                />
              )}
            />
            <Typography variant="subtitle2">Cụm được gán</Typography>
            {clusters.map((cluster) => (
              <FormControlLabel
                key={cluster.id}
                control={
                  <Checkbox
                    checked={assignForm.clusterIds.includes(cluster.id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAssignForm((prev) => ({
                        ...prev,
                        clusterIds: checked
                          ? [...prev.clusterIds, cluster.id]
                          : prev.clusterIds.filter((id) => id !== cluster.id),
                      }));
                    }}
                  />
                }
                label={`${cluster.name} (${cluster.id})`}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={assignSaving || !assignForm.user?.id || assignForm.clusterIds.length === 0}
          >
            {assignSaving ? "Đang lưu…" : "Lưu gán"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={infoOpen}
        onClose={() => {
          setInfoOpen(false);
          setInfoCluster(null);
          setOwnerUserId(null);
          setOwnerLoading(false);
          setOwnerError(null);
          setOwnerProfile(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Thông tin cụm sân</DialogTitle>
        <DialogContent>
          {!infoCluster ? (
            <Typography variant="body2" color="text.secondary">
              — 
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {infoCluster.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {infoCluster.id}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Địa chỉ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {infoCluster.address || "—"}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  Số sân: <b>{infoCluster.courtCount || 0}</b>
                </Typography>
                <Chip
                  size="small"
                  label={infoCluster.status === "active" ? "Hoạt động" : "Tạm dừng"}
                  color={infoCluster.status === "active" ? "success" : "default"}
                />
              </Stack>

              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Google Maps
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {infoCluster.googleMapsUrl || "—"}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DirectionsIcon fontSize="small" />}
                    disabled={!infoCluster.googleMapsUrl}
                    onClick={() => openClusterInGoogleMaps(infoCluster)}
                    sx={{ textTransform: "none" }}
                  >
                    Chỉ đường
                  </Button>
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Chủ sở hữu (CLUSTER_OWNER)
                </Typography>
                {ownerLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Đang tải...
                  </Typography>
                ) : (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">
                        ID chủ sân:
                      </Typography>
                      <Typography
                        variant="body2"
                        component="code"
                        sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                      >
                        {ownerUserId || "—"}
                      </Typography>
                      {ownerUserId && !ownerIdIsValid && (
                        <Chip size="small" color="warning" label="Legacy (email)" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Tên hiển thị: <b>{ownerProfile?.displayName || "—"}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SĐT: <b>{ownerProfile?.phone || "—"}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Email: <b>{ownerProfile?.email || "—"}</b>
                    </Typography>
                    {hasClusterOwner && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          disabled={removeOwnerSaving}
                          onClick={() => setRemoveOwnerConfirmOpen(true)}
                        >
                          Xóa gán chủ sân
                        </Button>
                      </Box>
                    )}
                  </Stack>
                )}
                {ownerError && (
                  <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75 }}>
                    {ownerError}
                  </Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setInfoOpen(false);
              setInfoCluster(null);
              setOwnerUserId(null);
              setOwnerLoading(false);
              setOwnerError(null);
              setOwnerProfile(null);
            }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={removeOwnerConfirmOpen} onClose={() => setRemoveOwnerConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Xóa gán chủ sân?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Thao tác này gỡ chủ sân khỏi cụm <b>{infoCluster?.name}</b> trên cloud và trình duyệt.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveOwnerConfirmOpen(false)}>Huỷ</Button>
          <Button color="error" variant="contained" onClick={handleRemoveOwner} disabled={removeOwnerSaving}>
            {removeOwnerSaving ? "Đang xóa…" : "Xóa gán"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Xóa cụm sân?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Bạn sắp xóa cụm <b>{deleteTarget?.name}</b> khỏi hệ thống
            {deleteTarget?.venueId ? ` (tổ chức: ${deleteTarget.venueId})` : ""}. Thao tác không
            hoàn tác trên cloud.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Huỷ</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteSaving}>
            {deleteSaving ? "Đang xóa…" : "Xóa cụm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
