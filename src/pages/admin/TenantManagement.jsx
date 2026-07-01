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
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { useTenant } from "../../context/TenantContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";
import { buildRuntimeAccessState } from "../../core/platform/app/runtimeAccess.js";
import {
  createTenant,
  listTenantsWithStats,
  renameTenant,
  setTenantStatus,
  TENANT_STATUS,
} from "../../features/tenant/index.js";

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  trial: "Trial",
  suspended: "Suspended",
};

function statusColor(status) {
  if (status === TENANT_STATUS.ACTIVE) return "success";
  if (status === TENANT_STATUS.TRIAL) return "info";
  if (status === TENANT_STATUS.SUSPENDED) return "warning";
  return "default";
}

export default function TenantManagement() {
  const { switchTenant, refreshTenant, isSuperAdmin } = useTenant();
  const { refreshClubs } = useClub();
  const runtime = usePlatformRuntime();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [platformPreview, setPlatformPreview] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  const tenants = useMemo(() => listTenantsWithStats(), [message]);

  useEffect(() => {
    try {
      const primaryTenant = tenants?.[0];
      if (!primaryTenant) {
        setPlatformPreview({ status: "idle" });
        return;
      }

      const seed = runtime.ensureSeed({
        tenantInput: {
          name: primaryTenant.name,
          tenant_id: primaryTenant.id,
          plan: primaryTenant.plan || "trial",
        },
        subscriptionInput: {
          tenant_id: primaryTenant.id,
          plan: primaryTenant.plan || "trial",
          feature_flags: { mobile: true, ai: true },
        },
      });

      const accessState = buildRuntimeAccessState(
        runtime,
        {
          user_id: "demo-admin",
          tenant_id: primaryTenant.id,
          role: "SUPER_ADMIN",
        },
        "tenant.manage",
        primaryTenant.id,
        { source: "tenant.management" }
      );

      setAccessAllowed(accessState.allowed);
      setPlatformPreview({
        status: seed.subscription ? "ready" : "initialized",
        tenantName: seed.tenant?.name || primaryTenant.name,
        tenantId: seed.tenant?.tenant_id || primaryTenant.id,
        plan: seed.tenant?.plan || primaryTenant.plan || "trial",
        mobileEnabled: runtime.subscriptionService.hasFeature(seed.tenant.tenant_id, "mobile"),
        aiEnabled: runtime.subscriptionService.hasFeature(seed.tenant.tenant_id, "ai"),
        access: accessState.allowed ? "allowed" : "denied",
      });
    } catch (platformError) {
      setPlatformPreview({ status: "error", message: platformError.message });
    }
  }, [runtime, tenants]);

  if (!isSuperAdmin) {
    return (
      <Alert severity="error">Chỉ SUPER_ADMIN mới truy cập được trang này.</Alert>
    );
  }

  const handleCreate = () => {
    setError(null);
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý tenant.");
      return;
    }

    const result = createTenant(newName, { status: TENANT_STATUS.TRIAL, plan: "trial" });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Đã tạo tenant "${result.tenant.name}".`);
    setNewName("");
    setCreateOpen(false);
    refreshTenant();
  };

  const handleRename = () => {
    if (!renameTarget) return;

    setError(null);
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý tenant.");
      return;
    }

    const result = renameTenant(renameTarget.id, newName);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Đã đổi tên tenant thành "${result.tenant.name}".`);
    setRenameTarget(null);
    setNewName("");
    refreshTenant();
  };

  const handleToggleStatus = (tenant) => {
    setError(null);
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý tenant.");
      return;
    }

    const nextStatus =
      tenant.status === TENANT_STATUS.ACTIVE || tenant.status === TENANT_STATUS.TRIAL
        ? TENANT_STATUS.SUSPENDED
        : TENANT_STATUS.ACTIVE;

    const result = setTenantStatus(tenant.id, nextStatus);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Đã cập nhật trạng thái tenant "${tenant.name}".`);
    refreshTenant();
  };

  const handleManage = (tenant) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý tenant.");
      return;
    }

    const result = switchTenant(tenant.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    refreshClubs();
    setMessage(`Đang quản trị tenant "${tenant.name}".`);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Tenant Management
          </Typography>
          <Typography color="text.secondary">
            Quản lý sân / đơn vị thuê phần mềm (multi-tenant).
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)} disabled={!accessAllowed}>
          Tạo tenant
        </Button>
      </Stack>

      {platformPreview && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Platform v5 preview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {platformPreview.status === "ready"
                    ? `Tenant ${platformPreview.tenantName} đã sẵn sàng cho runtime core.`
                    : `Tenant ${platformPreview.tenantName} đang được bootstrap vào platform core.`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  color={platformPreview.status === "ready" ? "success" : "default"}
                  label={platformPreview.status === "ready" ? "Ready" : "Initialized"}
                />
                <Chip size="small" label={`Plan ${platformPreview.plan || "trial"}`} />
                <Chip size="small" label={`Mobile ${platformPreview.mobileEnabled ? "on" : "off"}`} />
                <Chip size="small" label={`AI ${platformPreview.aiEnabled ? "on" : "off"}`} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tenant Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Players</TableCell>
              <TableCell align="right">Courts</TableCell>
              <TableCell align="right">Tournaments</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id} hover>
                <TableCell>{tenant.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={STATUS_LABELS[tenant.status] || tenant.status}
                    color={statusColor(tenant.status)}
                  />
                </TableCell>
                <TableCell align="right">{tenant.stats.players}</TableCell>
                <TableCell align="right">{tenant.stats.courts}</TableCell>
                <TableCell align="right">{tenant.stats.tournaments}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => handleManage(tenant)} disabled={!accessAllowed}>
                      Manage
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setRenameTarget(tenant);
                        setNewName(tenant.name);
                      }}
                      disabled={!accessAllowed}
                    >
                      Sửa
                    </Button>
                    <Button size="small" color="warning" onClick={() => handleToggleStatus(tenant)} disabled={!accessAllowed}>
                      {tenant.status === TENANT_STATUS.SUSPENDED ||
                      tenant.status === TENANT_STATUS.INACTIVE
                        ? "Mở"
                        : "Khóa"}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Tạo tenant mới</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Tên tenant"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreate}>
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Đổi tên tenant</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Tên mới"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleRename}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
