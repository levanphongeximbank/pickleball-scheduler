import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";
import { AUDIT_ACTIONS, listAuditLogs } from "../features/identity/services/auditService.js";
import { mergeAuditEntries } from "./auditLogUtils.js";
import {
  AppSnackbar,
  AuthFilterBar,
  AuthPageHeader,
  AuthResponsiveDataView,
  StatusToneChip,
} from "../features/web-app-ui/index.js";

function auditActionTone(action) {
  const value = String(action || "");
  if (/FAIL|DELETE|DENIED|ERROR/i.test(value)) return "error";
  if (/CREATE|LOGIN|SUCCESS|ASSIGN/i.test(value)) return "success";
  if (/UPDATE|CHANGE|RESET|PERMISSION/i.test(value)) return "warning";
  return "info";
}

function runtimePreviewTone(status) {
  if (status === "ready") return "success";
  if (status === "denied") return "warning";
  if (status === "error") return "error";
  return "neutral";
}

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
  [AUDIT_ACTIONS.PLAYER_VERIFICATION_STATUS_UPDATED]: "Cập nhật xác minh VĐV",
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
        <AuthPageHeader
          title="Nhật ký hệ thống"
          subtitle="Ghi nhận đăng nhập, quản lý user và thao tác nhạy cảm. Không hiển thị mật khẩu/token."
        />

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
                <StatusToneChip
                  tone={runtimePreviewTone(runtimePreview.status)}
                  label={runtimePreview.action || "audit"}
                />
              </Stack>
            </CardContent>
          </Card>
        )}

        {message ? (
          <AppSnackbar
            open
            message={message.text}
            tone={message.type === "error" ? "error" : message.type === "success" ? "success" : "info"}
            onClose={() => setMessage(null)}
          />
        ) : null}

        <Card>
          <CardContent>
            <AuthFilterBar
              filters={
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
              }
              resultCount={loading ? undefined : logs.length}
              resultCountLabel="bản ghi"
            />

            <AuthResponsiveDataView
              loading={loading}
              columns={[
                {
                  field: "created_at",
                  headerName: "Thời gian",
                  render: (row) => formatTime(row.created_at),
                },
                {
                  field: "action",
                  headerName: "Hành động",
                  render: (row) => (
                    <StatusToneChip
                      tone={auditActionTone(row.action)}
                      label={ACTION_LABELS[row.action] || row.action}
                    />
                  ),
                },
                {
                  field: "actor",
                  headerName: "Actor",
                  render: (row) => row.actor_email || row.actor_id || "—",
                },
                {
                  field: "resource",
                  headerName: "Đối tượng",
                  render: (row) =>
                    [row.resource_type, row.resource_id].filter(Boolean).join(" / ") || "—",
                },
                {
                  field: "detail",
                  headerName: "Chi tiết",
                  render: (row) => summarizeMetadata(row.metadata),
                },
              ]}
              rows={logs}
              getRowId={(row) => row.id || `${row.created_at}-${row.action}`}
              emptyTitle="Chưa có nhật ký"
              emptyDescription="Không có bản ghi audit nào cho bộ lọc hiện tại."
              renderMobileRow={(row) => (
                <>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatTime(row.created_at)}
                  </Typography>
                  <StatusToneChip
                    tone={auditActionTone(row.action)}
                    label={ACTION_LABELS[row.action] || row.action}
                  />
                  <Typography variant="body2">
                    {row.actor_email || row.actor_id || "—"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[row.resource_type, row.resource_id].filter(Boolean).join(" / ") || "—"}
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                    {summarizeMetadata(row.metadata)}
                  </Typography>
                </>
              )}
            />
          </CardContent>
        </Card>
      </Box>
    </PermissionGate>
  );
}
