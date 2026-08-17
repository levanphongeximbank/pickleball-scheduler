import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { useNotificationInbox } from "../../notifications/runtime/useNotificationInbox.js";
import { NOTIFICATION_STATUSES } from "../../notifications/constants/notificationStatuses.js";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Notifications control for the Figure 1 top bar — reuses existing inbox runtime.
 */
export default function CanonicalNotificationButton() {
  const { palette, layout } = useCanonicalShell();
  const { currentTenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const tenantId = currentTenantId || user?.tenantId || null;
  const userId = user?.id || null;
  const enabled = Boolean(tenantId && userId);

  const { items, unreadCount, loading, refresh, markRead, markAllRead } = useNotificationInbox({
    tenantId,
    userId,
    pollMs: 5000,
    enabled,
  });

  const notificationItems = useMemo(() => (items || []).slice(0, 6), [items]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
    void refresh();
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        aria-label="Thông báo"
        onClick={handleOpen}
        sx={{
          minWidth: layout.touchTargetMin,
          minHeight: layout.touchTargetMin,
          color: palette.textSecondary,
          "&:focus-visible": { outline: `2px solid ${palette.focusRing}`, outlineOffset: 2 },
        }}
      >
        <Badge badgeContent={unreadCount || 0} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1, minWidth: 280, display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Typography fontWeight={600}>Thông báo</Typography>
          <Button size="small" onClick={() => void markAllRead()}>
            Đọc tất cả
          </Button>
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 2 }}>
            <CircularProgress size={22} />
          </Box>
        ) : null}
        {!loading && notificationItems.length === 0 ? (
          <MenuItem disabled>Không có thông báo mới</MenuItem>
        ) : null}
        {notificationItems.map((notification) => {
          const unread = notification?.status !== NOTIFICATION_STATUSES.READ;
          return (
            <MenuItem
              key={notification.id || notification.notificationId}
              onClick={async () => {
                if (unread) {
                  await markRead(notification.id || notification.notificationId);
                }
                handleClose();
                navigate("/notifications");
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={unread ? 700 : 500}>
                  {notification.title || "Thông báo"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.body || notification.message || ""}
                </Typography>
              </Box>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
            navigate("/notifications");
          }}
        >
          Xem tất cả
        </MenuItem>
      </Menu>
    </>
  );
}
