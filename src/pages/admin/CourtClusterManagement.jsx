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
  listAssignmentsForCluster,
  listClustersForVenue,
  setUserClusterAssignments,
  unassignUserFromCluster,
  updateCourtCluster,
} from "../../features/court-cluster/services/courtClusterService.js";
import { openClusterInGoogleMaps } from "../../features/court-cluster/utils/clusterMapsUtils.js";

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
    </Box>
  );
}
