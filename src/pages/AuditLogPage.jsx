import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
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
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";
import { AUDIT_ACTIONS, listAuditLogs } from "../features/identity/services/auditService.js";
import { mergeAuditEntries } from "./auditLogUtils.js";

const ACTION_LABELS = {
  [AUDIT_ACTIONS.LOGIN]: "Đăng nhập",
  [AUDIT_ACTIONS.LOGIN_FAILED]: "Đăng nhập thất bại",
  [AUDIT_ACTIONS.LOGOUT]: "Đăng xuất",
  [AUDIT_ACTIONS.CREATE]: "Tạo",
  [AUDIT_ACTIONS.UPDATE]: "Cập nhật",
  [AUDIT_ACTIONS.DELETE]: "Xóa",
  [AUDIT_ACTIONS.ASSIGN_ROLE]: "Gán role",
  [AUDIT_ACTIONS.PERMISSION_CHANGE]: "Đổi quyền",
  [AUDIT_ACTIONS.PASSWORD_CHANGE]: "Đổi mật khẩu",
  [AUDIT_ACTIONS.RESET_PASSWORD]: "Reset mật khẩu",
};

function formatTime(value) {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return String(value);
  }
}

function summarizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return "—";
  }
  const keys = Object.keys(metadata);
  if (keys.length === 0) {
    return "—";
  }
  return keys
    .slice(0, 4)
    .map((key) => `${key}: ${String(metadata[key]).slice(0, 40)}`)
    .join(" · ");
}

export default function AuditLogPage() {
  const runtime = usePlatformRuntime();
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runtimePreview, setRuntimePreview] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const decision = runtime.accessService.authorize(
        {
          user_id: "demo-admin",
          tenant_id: "platform-audit-preview",
          role: "SUPER_ADMIN",
        },
        { tenant_id: "platform-audit-preview" },
        "audit.read"
      );

      setAccessAllowed(Boolean(decision.allowed));
      if (!decision.allowed) {
        setLogs([]);
        setLoading(false);
        setMessage({ type: "error", text: "Runtime platform chặn quyền xem nhật ký hệ thống." });
        return;
      }
    } catch (error) {
      setAccessAllowed(false);
      setLogs([]);
      setLoading(false);
      setMessage({ type: "error", text: `Runtime platform chặn quyền xem nhật ký: ${error.message}` });
      return;
    }

    setLoading(true);
    const result = await listAuditLogs({ limit: 100, action: actionFilter });
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      setLogs([]);
      return;
    }

    const runtimeEntries = [];
    try {
      const previewEntry = runtime.logAuditEvent({
        tenant_id: "platform-audit-preview",
        actor_user_id: "system",
        action: "audit.view",
        target_id: "audit-page",
      });
      runtimeEntries.push(previewEntry);
    } catch {
      // Ignore runtime preview entry failures when loading logs.
    }

    try {
      const workflowEvents = runtime?.notificationService?.list?.() || [];
      workflowEvents.forEach((notification) => {
        runtimeEntries.push({
          id: `notification-${notification.id}`,
          tenant_id: notification.tenant_id,
          actor_user_id: "system",
          action: "workflow.notification",
          target_id: notification.id,
          created_at: notification.created_at,
          metadata: {
            title: notification.title,
            body: notification.body,
            channel: notification.channel,
            read: notification.read,
          },
        });
      });
    } catch {
      // Ignore runtime notification preview failures when loading logs.
    }

    const mergedLogs = mergeAuditEntries(result.logs || [], runtimeEntries);
    setLogs(mergedLogs.slice(0, 100));
    setMessage(null);
  }, [actionFilter, runtime]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    try {
      const entry = runtime.logAuditEvent({
        tenant_id: "platform-audit-preview",
        actor_user_id: "system",
        action: "audit.view",
        target_id: "audit-page",
      });
      setRuntimePreview({
        status: accessAllowed ? "ready" : "denied",
        entryId: entry.id,
        action: entry.action,
        tenantId: entry.tenant_id,
        access: accessAllowed ? "allowed" : "denied",
      });
    } catch (error) {
      setRuntimePreview({ status: "error", message: error.message });
    }
  }, [accessAllowed, runtime]);

  return (
    <PermissionGate permissions={[PERMISSIONS.USER_MANAGE]}>
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Nhật ký hệ thống
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ghi nhận đăng nhập, quản lý user và thao tác nhạy cảm. Không hiển thị mật khẩu/token.
        </Typography>

        {runtimePreview && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Platform v5 audit preview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {runtimePreview.status === "ready"
                      ? `Đã ghi entry ${runtimePreview.entryId} cho tenant ${runtimePreview.tenantId}.`
                      : runtimePreview.status === "denied"
                        ? `Runtime đang chặn quyền xem audit cho tenant ${runtimePreview.tenantId}.`
                        : `Không thể ghi audit preview: ${runtimePreview.message}`}
                  </Typography>
                </Box>
                <Chip size="small" color={runtimePreview.status === "ready" ? "success" : runtimePreview.status === "denied" ? "warning" : "default"} label={runtimePreview.action || "audit"} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                select
                label="Hành động"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <Chip label={loading ? "Đang tải…" : `${logs.length} bản ghi`} size="small" />
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Hành động</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Đối tượng</TableCell>
                  <TableCell>Chi tiết</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {loading ? "Đang tải…" : "Chưa có nhật ký."}
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((entry) => (
                  <TableRow key={entry.id || `${entry.created_at}-${entry.action}`}>
                    <TableCell>{formatTime(entry.created_at)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ACTION_LABELS[entry.action] || entry.action}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{entry.actor_email || entry.actor_id || "—"}</TableCell>
                    <TableCell>
                      {[entry.resource_type, entry.resource_id].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {summarizeMetadata(entry.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>
    </PermissionGate>
  );
}
