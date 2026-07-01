import { useCallback, useEffect, useMemo, useState } from "react";
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
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { ROLE_LABELS } from "../auth/roles.js";
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";
import { USER_STATUS } from "../models/user.js";
import {
  createManagedUser,
  listManageableRoles,
  listUsers,
  requestManagedPasswordReset,
  setManagedUserStatus,
  updateManagedUser,
} from "../features/identity/services/userManagementService.js";

const STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Hoạt động",
  [USER_STATUS.INVITED]: "Đã mời",
  [USER_STATUS.SUSPENDED]: "Khóa",
};

const EMPTY_FORM = {
  email: "",
  password: "",
  displayName: "",
  role: "",
  phone: "",
};

export default function UserManagementPage() {
  const runtime = usePlatformRuntime();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [accessPreview, setAccessPreview] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  const roles = useMemo(() => listManageableRoles(), []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const result = await listUsers({ search, role: roleFilter, status: statusFilter });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      setUsers([]);
      return;
    }

    setUsers(result.users);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    try {
      const decision = runtime.accessService.authorize(
        {
          user_id: "demo-admin",
          tenant_id: "platform-access-preview",
          role: "SUPER_ADMIN",
        },
        { tenant_id: "platform-access-preview" },
        "user.manage"
      );

      setAccessAllowed(Boolean(decision.allowed));
      setAccessPreview({
        status: decision.allowed ? "allowed" : "denied",
        permission: decision.permission,
        code: decision.code || "ok",
      });
    } catch (error) {
      setAccessPreview({ status: "error", message: error.message });
    }
  }, [runtime]);

  const openCreate = () => {
    if (!accessAllowed) {
      setMessage({ type: "error", text: "Runtime platform chặn thao tác quản lý user." });
      return;
    }
    setEditingUser(null);
    setForm({ ...EMPTY_FORM, role: roles[0] || "" });
    setDialogOpen(true);
  };

  const openEdit = (user) => {
    if (!accessAllowed) {
      setMessage({ type: "error", text: "Runtime platform chặn thao tác quản lý user." });
      return;
    }
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      displayName: user.displayName,
      role: user.role,
      phone: user.phone || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    const accessDecision = runtime.accessService.authorize(
      {
        user_id: "platform-admin",
        tenant_id: "platform-user-management",
        role: "SUPER_ADMIN",
      },
      { tenant_id: "platform-user-management" },
      "user.manage"
    );

    if (!accessDecision.allowed) {
      runtime.logAuditEvent({
        tenant_id: "platform-user-management",
        actor_user_id: "platform-admin",
        action: "user.manage.denied",
        target_id: editingUser?.id || form.email || "user-management",
      });
      setLoading(false);
      setMessage({ type: "error", text: "Runtime platform chặn thao tác quản lý user." });
      return;
    }

    runtime.logAuditEvent({
      tenant_id: "platform-user-management",
      actor_user_id: "platform-admin",
      action: editingUser ? "user.manage.update" : "user.manage.create",
      target_id: editingUser?.id || form.email || "new-user",
    });

    const result = editingUser
      ? await updateManagedUser(editingUser.id, {
          displayName: form.displayName,
          role: form.role,
          phone: form.phone,
        })
      : await createManagedUser(form);

    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setDialogOpen(false);
    setMessage({
      type: "success",
      text: editingUser ? "Đã cập nhật user." : "Đã tạo user.",
    });
    loadUsers();
  };

  const handleToggleStatus = async (user) => {
    const accessDecision = runtime.accessService.authorize(
      {
        user_id: "platform-admin",
        tenant_id: "platform-user-management",
        role: "SUPER_ADMIN",
      },
      { tenant_id: "platform-user-management" },
      "user.manage"
    );

    if (!accessDecision.allowed) {
      runtime.logAuditEvent({
        tenant_id: "platform-user-management",
        actor_user_id: "platform-admin",
        action: "user.manage.denied",
        target_id: user.id,
      });
      setMessage({ type: "error", text: "Runtime platform chặn thao tác quản lý user." });
      return;
    }

    runtime.logAuditEvent({
      tenant_id: "platform-user-management",
      actor_user_id: "platform-admin",
      action: "user.manage.status-change",
      target_id: user.id,
    });

    const nextStatus =
      user.status === USER_STATUS.ACTIVE ? USER_STATUS.SUSPENDED : USER_STATUS.ACTIVE;
    const result = await setManagedUserStatus(user.id, nextStatus);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    loadUsers();
  };

  const handleResetPassword = async (user) => {
    const result = await requestManagedPasswordReset(user.email);
    setMessage(
      result.ok
        ? { type: "success", text: result.message || "Đã gửi yêu cầu reset." }
        : { type: "error", text: result.error }
    );
  };

  return (
    <PermissionGate
      permission={PERMISSIONS.USER_MANAGE}
      fallback={
        <Alert severity="error">Bạn không có quyền quản lý người dùng.</Alert>
      }
    >
      <Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Typography variant="h4" fontWeight={800}>
            Quản lý người dùng
          </Typography>
          <Button variant="contained" onClick={openCreate} disabled={!accessAllowed}>
            Tạo user
          </Button>
        </Stack>

        {accessPreview && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Platform v5 access preview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {accessPreview.status === "allowed"
                      ? `Quyền ${accessPreview.permission} đã được runtime chấp thuận.`
                      : `Quyền ${accessPreview.permission} bị chặn với mã ${accessPreview.code}.`}
                  </Typography>
                </Box>
                <Chip size="small" color={accessPreview.status === "allowed" ? "success" : "warning"} label={accessPreview.status === "allowed" ? "Allowed" : "Denied"} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                size="small"
                label="Tìm kiếm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Trạng thái"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Tên</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.displayName || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ROLE_LABELS[user.role] || user.role}
                    />
                  </TableCell>
                  <TableCell>{STATUS_LABELS[user.status] || user.status}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => openEdit(user)} disabled={!accessAllowed}>
                        Sửa
                      </Button>
                      <Button size="small" onClick={() => handleToggleStatus(user)} disabled={!accessAllowed}>
                        {user.status === USER_STATUS.ACTIVE ? "Khóa" : "Kích hoạt"}
                      </Button>
                      <Button size="small" onClick={() => handleResetPassword(user)} disabled={!accessAllowed}>
                        Reset MK
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {loading ? "Đang tải…" : "Không có user."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editingUser ? "Sửa user" : "Tạo user"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={Boolean(editingUser)}
                fullWidth
              />
              {!editingUser && (
                <TextField
                  label="Mật khẩu tạm"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  fullWidth
                />
              )}
              <TextField
                label="Họ tên"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                fullWidth
              />
              <TextField
                label="SĐT"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
              <TextField
                select
                label="Role"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                fullWidth
              >
                {roles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button variant="contained" onClick={handleSave} disabled={loading}>
              Lưu
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
}
