import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";

import GlobalSearch from "./GlobalSearch.jsx";
import AccountMenu from "./shell/AccountMenu.jsx";
import TenantSwitcher from "./TenantSwitcher.jsx";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { SHELL_COLORS, SHELL_LAYOUT } from "./shell/shellTokens.js";
import { useNotificationInbox } from "../features/notifications/runtime/useNotificationInbox.js";
import { NOTIFICATION_STATUSES } from "../features/notifications/constants/notificationStatuses.js";

export default function Header({ onMenuClick }) {
  const isMobile = useIsMobile();
  const { isSuperAdmin, currentTenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);

  const tenantId = currentTenantId || user?.venueId || null;
  const userId = user?.id || null;
  const inboxEnabled = Boolean(tenantId && userId);

  const {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotificationInbox({
    tenantId,
    userId,
    pollMs: 5000,
    enabled: inboxEnabled,
  });

  const notificationItems = useMemo(() => (items || []).slice(0, 6), [items]);

  const handleNotificationOpen = (event) => {
    setNotificationAnchorEl(event.currentTarget);
    void refresh();
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleNotificationClick = async (notification) => {
    const isUnread = notification?.status !== NOTIFICATION_STATUSES.READ;
    if (isUnread) {
      await markRead(notification.id || notification.notificationId);
    }
    handleNotificationClose();
    navigate("/notifications");
  };

  const handleMarkAllNotificationsAsRead = async () => {
    await markAllRead();
    handleNotificationClose();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: SHELL_COLORS.cardBg,
        color: SHELL_COLORS.textPrimary,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          px: { xs: 1.5, md: 2.5, lg: 3 },
          gap: 1.5,
          minHeight: `${SHELL_LAYOUT.topbarHeight}px !important`,
          height: SHELL_LAYOUT.topbarHeight,
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        {isMobile && onMenuClick && (
          <IconButton edge="start" onClick={onMenuClick} aria-label="Mở menu" sx={{ color: "inherit" }}>
            <MenuIcon />
          </IconButton>
        )}

        {!isMobile && (
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
            {isSuperAdmin && (
              <Box sx={{ flexShrink: 0 }}>
                <TenantSwitcher variant="light" minWidth={200} />
              </Box>
            )}
            <Box sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0, maxWidth: 520 }}>
              <GlobalSearch variant="light" maxWidth={520} />
            </Box>
          </Stack>
        )}

        {isMobile && (
          <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
            Pickleball Pro
          </Typography>
        )}

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ flexShrink: 0, ml: isMobile ? "auto" : 0 }}
        >
          {isMobile && <GlobalSearch variant="light" maxWidth={160} size="small" />}

          <IconButton
            aria-label="Thông báo"
            onClick={handleNotificationOpen}
            sx={{
              border: `1px solid ${SHELL_COLORS.border}`,
              borderRadius: 2,
              color: SHELL_COLORS.textSecondary,
            }}
          >
            <Badge
              badgeContent={unreadCount}
              color="error"
              max={99}
              invisible={unreadCount === 0}
            >
              <NotificationsIcon fontSize="small" />
            </Badge>
          </IconButton>

          {!isMobile && (
            <IconButton
              aria-label="Hỗ trợ"
              onClick={() => navigate("/settings")}
              sx={{
                border: `1px solid ${SHELL_COLORS.border}`,
                borderRadius: 2,
                color: SHELL_COLORS.textSecondary,
              }}
            >
              <HelpOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          )}

          <AccountMenu />
        </Stack>
      </Toolbar>

      <Menu
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        onClose={handleNotificationClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: { mt: 1, minWidth: 320, maxWidth: 360, borderRadius: 2 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Thông báo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {loading ? "…" : `${unreadCount} chưa đọc`}
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Button size="small" variant="text" onClick={handleMarkAllNotificationsAsRead} sx={{ px: 0, mt: 0.25 }}>
              Đánh dấu tất cả đã đọc
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            onClick={() => {
              handleNotificationClose();
              navigate("/notifications");
            }}
            sx={{ px: 0, display: "block" }}
          >
            Xem tất cả
          </Button>
        </Box>
        <Divider />
        {error ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
            <Button size="small" onClick={() => void refresh()} sx={{ mt: 1, px: 0 }}>
              Thử lại
            </Button>
          </Box>
        ) : loading && notificationItems.length === 0 ? (
          <Box sx={{ px: 2, py: 2, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={22} />
          </Box>
        ) : notificationItems.length > 0 ? (
          notificationItems.map((notification) => {
            const isUnread = notification?.status !== NOTIFICATION_STATUSES.READ;
            return (
              <MenuItem
                key={notification.id || notification.notificationId}
                onClick={() => void handleNotificationClick(notification)}
                sx={{
                  alignItems: "flex-start",
                  py: 1.2,
                  bgcolor: isUnread ? SHELL_COLORS.mintBg : "transparent",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
                    {notification.title || "Thông báo hệ thống"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                    {notification.message || notification.body || "Không có chi tiết"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(
                      notification.createdAt || notification.created_at || new Date().toISOString()
                    ).toLocaleString("vi-VN")}
                  </Typography>
                </Box>
              </MenuItem>
            );
          })
        ) : (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Chưa có thông báo nào.
            </Typography>
          </Box>
        )}
      </Menu>
    </AppBar>
  );
}
