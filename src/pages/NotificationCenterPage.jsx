/**
 * Basic Notification Center — Phase 1.4 canonical inbox UI.
 * Functional integration only (not a full production redesign).
 */
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DoneAllIcon from "@mui/icons-material/DoneAll";

import { useAuth } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useNotificationInbox } from "../features/notifications/runtime/useNotificationInbox.js";
import { NOTIFICATION_STATUSES } from "../features/notifications/constants/notificationStatuses.js";
import { NOTIFICATION_CATEGORIES } from "../features/notifications/constants/notificationCategories.js";
import { NOTIFICATION_PRIORITIES } from "../features/notifications/constants/notificationPriorities.js";

function priorityColor(priority) {
  if (priority === NOTIFICATION_PRIORITIES.HIGH || priority === NOTIFICATION_PRIORITIES.CRITICAL) {
    return "error";
  }
  if (priority === NOTIFICATION_PRIORITIES.LOW) return "default";
  return "info";
}

export default function NotificationCenterPage() {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.venueId || null;
  const userId = user?.id || null;
  const isAuthenticated = Boolean(userId);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState("");

  const {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    listFiltered,
    runtimeStatus,
  } = useNotificationInbox({
    tenantId,
    userId,
    pollMs: 8000,
    enabled: Boolean(isAuthenticated && tenantId && userId),
  });

  const filtered = useMemo(
    () =>
      listFiltered({
        unreadOnly,
        category: category || null,
      }),
    [listFiltered, unreadOnly, category]
  );

  if (!isAuthenticated) {
    return (
      <Alert severity="warning">Đăng nhập để xem hộp thư thông báo.</Alert>
    );
  }

  if (!tenantId || !userId) {
    return (
      <Alert severity="info">
        Chưa xác định được venue/tenant cho tài khoản hiện tại.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} mb={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            Trung tâm thông báo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unreadCount} chưa đọc · chế độ {runtimeStatus?.mode || "—"}
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Làm mới
        </Button>
        <Button
          startIcon={<DoneAllIcon />}
          variant="contained"
          onClick={() => void markAllRead()}
          disabled={loading || unreadCount === 0}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select
            label="Trạng thái"
            value={unreadOnly ? "unread" : "all"}
            onChange={(e) => setUnreadOnly(e.target.value === "unread")}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="unread">Chưa đọc</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Danh mục</InputLabel>
          <Select
            label="Danh mục"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <MenuItem value="">Tất cả danh mục</MenuItem>
            {Object.values(NOTIFICATION_CATEGORIES).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void refresh()}>
              Thử lại
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && items.length === 0 ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">Không có thông báo phù hợp bộ lọc.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((item) => {
            const isUnread = item.status !== NOTIFICATION_STATUSES.READ;
            return (
              <Paper
                key={item.id || item.notificationId}
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: isUnread ? "action.hover" : "background.paper",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5} flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {item.title || "Thông báo"}
                      </Typography>
                      {item.priority && (
                        <Chip
                          size="small"
                          label={item.priority}
                          color={priorityColor(item.priority)}
                          variant="outlined"
                        />
                      )}
                      {item.category && (
                        <Chip size="small" label={item.category} variant="outlined" />
                      )}
                      {isUnread ? (
                        <Chip size="small" label="Chưa đọc" color="warning" />
                      ) : (
                        <Chip size="small" label="Đã đọc" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                      {item.message || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.createdAt || item.created_at
                        ? new Date(item.createdAt || item.created_at).toLocaleString("vi-VN")
                        : "—"}
                    </Typography>
                  </Box>
                  {isUnread && (
                    <Button
                      size="small"
                      onClick={() => void markRead(item.id || item.notificationId)}
                    >
                      Đánh dấu đã đọc
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
