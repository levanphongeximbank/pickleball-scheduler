import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Badge,
  Box,
  Button,
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

import VenueSwitcher from "./VenueSwitcher.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import AccountMenu from "./shell/AccountMenu.jsx";
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";
import { SHELL_COLORS, SHELL_LAYOUT } from "./shell/shellTokens.js";

export default function Header({ onMenuClick }) {
  const isMobile = useIsMobile();
  const runtime = usePlatformRuntime();
  const navigate = useNavigate();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);

  const syncNotificationCount = useCallback(() => {
    const notifications = runtime?.notificationService?.list?.() || [];
    const unread = notifications.filter(
      (notification) => !(notification?.read || notification?.status === "read")
    ).length;
    setUnreadNotificationCount(unread);
  }, [runtime?.notificationService]);

  useEffect(() => {
    syncNotificationCount();
    const intervalId = window.setInterval(syncNotificationCount, 2000);
    return () => window.clearInterval(intervalId);
  }, [syncNotificationCount]);

  const notificationItems = useMemo(() => {
    const notifications = runtime?.notificationService?.list?.() || [];
    return notifications.slice().reverse().slice(0, 6);
  }, [runtime?.notificationService, unreadNotificationCount]);

  const handleNotificationOpen = (event) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    if (!(notification?.read || notification?.status === "read")) {
      runtime?.notificationService?.markAsRead?.(notification.id);
      syncNotificationCount();
    }
    handleNotificationClose();
    navigate("/tournament");
  };

  const handleMarkAllNotificationsAsRead = () => {
    runtime?.notificationService?.markAllAsRead?.();
    syncNotificationCount();
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

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexShrink: 0,
            minWidth: { md: 180, lg: 220 },
          }}
        >
          {!isMobile && <VenueSwitcher variant="light" />}
          {isMobile && (
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              Pickleball Pro
            </Typography>
          )}
        </Box>

        {!isMobile && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              minWidth: 0,
              px: 1,
            }}
          >
            <GlobalSearch variant="light" maxWidth={420} />
          </Box>
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
              badgeContent={unreadNotificationCount}
              color="error"
              max={99}
              invisible={unreadNotificationCount === 0}
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
              {unreadNotificationCount} chưa đọc
            </Typography>
          </Box>
          {unreadNotificationCount > 0 && (
            <Button size="small" variant="text" onClick={handleMarkAllNotificationsAsRead} sx={{ px: 0, mt: 0.25 }}>
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </Box>
        <Divider />
        {notificationItems.length > 0 ? (
          notificationItems.map((notification) => {
            const isUnread = !(notification?.read || notification?.status === "read");
            return (
              <MenuItem
                key={notification.id || `${notification.title}-${notification.created_at}`}
                onClick={() => handleNotificationClick(notification)}
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
                    {notification.body || notification.detail || "Không có chi tiết"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(
                      notification.created_at || notification.createdAt || new Date().toISOString()
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
