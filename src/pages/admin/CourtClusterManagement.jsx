import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { listTenants } from "../../features/tenant/index.js";
import { isCourtClustersEnabled } from "../../features/court-cluster/config/clusterFlags.js";
import {
  assignUserToCluster,
  createCourtCluster,
  deleteCourtCluster,
  getClusterById,
  listAssignmentsForCluster,
  listClustersForVenue,
  setUserClusterAssignments,
  unassignUserFromCluster,
  updateCourtCluster,
} from "../../features/court-cluster/services/courtClusterService.js";
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

const DEMO_USERS = [
  { id: "demo-owner-a", label: "Chủ sân A (demo)" },
  { id: "demo-owner-b", label: "Chủ sân B (demo)" },
];

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
    userId: "",
    clusterIds: [],
  });
  const [pendingClaims, setPendingClaims] = useState([]);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoCluster, setInfoCluster] = useState(null);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);

  const canPickTenant = isSuperAdmin || isPlatformScopedRole(user?.role);
  const tenants = useMemo(() => listTenants(), [message]);
  const venueId = currentTenantId || user?.venueId || null;
  const clusters = useMemo(() => listClustersForVenue(venueId), [venueId, message]);
  const canManage =
    !rbacEnabled || can(PERMISSIONS.CLUSTER_MANAGE, { tenantId: venueId, venueId });

  useEffect(() => {
    if (!isCourtClustersEnabled()) {
      setError("Bật VITE_COURT_CLUSTERS_ENABLED=true để quản lý cụm sân.");
    }
  }, []);

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

  const handleCreate = () => {
    setError(null);
    const result = createCourtCluster({
      venueId,
      name: form.name,
      slug: form.slug || undefined,
      address: form.address,
      googleMapsUrl: form.googleMapsUrl,
      ownerUserId: user?.id || null,
      user,
    });

    if (!result.ok) {
      setError(result.error);
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

  const handleEdit = () => {
    if (!editingCluster) {
      return;
    }

    setError(null);
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
      setError(result.error);
      return;
    }

    setMessage(`Đã cập nhật cụm sân: ${result.cluster.name}`);
    setEditOpen(false);
    resetForm();
    refreshClusters();
  };

  const handleToggleStatus = (cluster) => {
    const nextStatus = cluster.status === "active" ? "inactive" : "active";
    const result = updateCourtCluster(cluster.id, { status: nextStatus }, { user });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Cập nhật trạng thái: ${result.cluster.name}`);
    refreshClusters();
  };

  const handleDelete = (clusterId) => {
    const result = deleteCourtCluster(clusterId, { user });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Đã xóa cụm sân");
    refreshClusters();
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
    const nextOwnerUserId = ownerAssignment?.userId || cluster?.ownerUserId || null;
    setOwnerUserId(nextOwnerUserId);

    if (!nextOwnerUserId) {
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

  const openAssignDialog = (clusterId = null) => {
    const initialClusterIds = clusterId ? [clusterId] : [];
    setAssignForm({ userId: DEMO_USERS[0]?.id || "", clusterIds: initialClusterIds });
    setAssignOpen(true);
  };

  const handleAssign = () => {
    setError(null);
    const result = setUserClusterAssignments(assignForm.userId, assignForm.clusterIds, { user });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    for (const clusterId of assignForm.clusterIds) {
      assignUserToCluster(assignForm.userId, clusterId, { user });
    }

    const removed = clusters
      .map((cluster) => cluster.id)
      .filter((id) => !assignForm.clusterIds.includes(id));

    for (const clusterId of removed) {
      const existing = listAssignmentsForCluster(clusterId).some(
        (item) => item.userId === assignForm.userId
      );
      if (existing && !assignForm.clusterIds.includes(clusterId)) {
        unassignUserFromCluster(assignForm.userId, clusterId, { user });
      }
    }

    setMessage("Đã cập nhật gán chủ sân cho cụm");
    setAssignOpen(false);
    refreshClusters();
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
            Tổ chức: {currentTenant?.name || venueId || "—"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {canPickTenant && tenants.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="cluster-tenant-picker">Chọn tổ chức</InputLabel>
              <Select
                labelId="cluster-tenant-picker"
                value={venueId || ""}
                label="Chọn tổ chức"
                onChange={(event) => switchTenant(event.target.value)}
              >
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            disabled={!venueId}
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
                  <TableCell>Địa chỉ</TableCell>
                  <TableCell>Số sân</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusters.map((cluster) => (
                  <TableRow key={cluster.id} hover>
                    <TableCell>{cluster.id}</TableCell>
                    <TableCell>{cluster.name}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="body2" noWrap title={cluster.address || "—"}>
                        {cluster.address || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>{cluster.courtCount || 0}</TableCell>
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
                          onClick={() => handleDelete(cluster.id)}
                          disabled={cluster.id.endsWith("-main")}
                        >
                          Xóa
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {clusters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
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
          <Button variant="contained" onClick={handleCreate} disabled={!form.name.trim()}>
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sửa cụm sân</DialogTitle>
        <DialogContent>{formFields}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleEdit} disabled={!form.name.trim()}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Gán chủ sân cho cụm</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="User ID"
              value={assignForm.userId}
              onChange={(event) =>
                setAssignForm((prev) => ({ ...prev, userId: event.target.value }))
              }
              helperText="Nhập UUID profile hoặc dùng demo ID local"
              fullWidth
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
          <Button variant="contained" onClick={handleAssign}>
            Lưu gán
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
                    <Typography variant="body2" color="text.secondary">
                      User ID: <b>{ownerUserId || "—"}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tên hiển thị: <b>{ownerProfile?.displayName || "—"}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SĐT: <b>{ownerProfile?.phone || "—"}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Email: <b>{ownerProfile?.email || "—"}</b>
                    </Typography>
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
    </Box>
  );
}
