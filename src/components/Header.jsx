import { useCallback, useEffect, useMemo, useState } from "react";



import { Link as RouterLink, useNavigate } from "react-router-dom";
import { AppBar, Badge, Box, Button, Chip, Divider, IconButton, Menu, MenuItem, Stack, Toolbar, Typography } from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsIcon from "@mui/icons-material/Notifications";

import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";



import ClubSwitcher from "./ClubSwitcher";
import TenantSwitcher, { TenantBadge } from "./TenantSwitcher";
import VenueSwitcher from "./VenueSwitcher";
import GlobalSearch from "./GlobalSearch";
import SeasonLeagueSwitcher from "./SeasonLeagueSwitcher";

import { useClub } from "../context/ClubContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../auth/roles.js";
import { PERMISSIONS } from "../auth/permissions.js";

import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { usePlatformRuntime } from "../core/platform/app/usePlatformRuntime.js";

import { getTodayCheckedInPlayerIds } from "../utils/playerHelpers.js";

import { computeCourtDashboardStats } from "../utils/courtHelpers.js";

import { loadCourtManagementData } from "../domain/bookingService.js";

import { loadCourts } from "../pages/courts.logic.js";
import { useIsMobile } from "../features/mobile/hooks/useIsMobile.js";



function CommandChip({ label, color = "default", pulse = false, hideOnMobile = false }) {

  return (

    <Chip

      size="small"

      label={label}

      color={color}

      variant={color === "default" ? "outlined" : "filled"}

      icon={

        pulse ? (

          <FiberManualRecordIcon

            sx={{

              fontSize: "10px !important",

              animation: "livePulse 1.8s ease-in-out infinite",

              "@keyframes livePulse": {

                "0%, 100%": { opacity: 1 },

                "50%": { opacity: 0.35 },

              },

            }}

          />

        ) : undefined

      }

      sx={{

        height: 26,

        fontWeight: 700,

        fontSize: 12,

        borderColor: color === "default" ? "rgba(255,255,255,0.35)" : undefined,

        color: color === "default" ? "rgba(255,255,255,0.9)" : undefined,

        display: hideOnMobile ? { xs: "none", md: "inline-flex" } : "inline-flex",

        ...(pulse && {

          bgcolor: "rgba(239, 68, 68, 0.9)",

          color: "#fff",

        }),

      }}

    />

  );

}



export default function Header({ onMenuClick }) {

  const { activeClubId, summary } = useClub();
  const { authProductionEnabled, rbacEnabled, isAuthenticated, user, signOut, can } = useAuth();
  const isMobile = useIsMobile();
  const runtime = usePlatformRuntime();
  const navigate = useNavigate();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);

  const { activeSeason, activeLeague } = useSeasonLeague();



  const opsMeta = useMemo(() => {

    const courts = loadCourts([], activeClubId);

    const bookings = loadCourtManagementData(activeClubId).bookings;

    const courtStats = computeCourtDashboardStats(courts, bookings);

    const checkedInIds = getTodayCheckedInPlayerIds(activeClubId);

    const isLive = courtStats.playing > 0;



    return {

      playerCount: summary?.totals?.players ?? 0,

      courtCount: summary?.totals?.courts ?? 0,

      checkedInToday: checkedInIds.size,

      isLive,

    };

  }, [activeClubId, summary]);



  const syncNotificationCount = useCallback(() => {
    const notifications = runtime?.notificationService?.list?.() || [];
    const unread = notifications.filter((notification) => !(notification?.read || notification?.status === "read")).length;
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

      position="fixed"

      elevation={0}

      sx={{

        zIndex: (theme) => theme.zIndex.drawer + 1,

        bgcolor: "#0f3f2e",

        background: "linear-gradient(90deg, #0f3f2e 0%, #157347 100%)",

        borderBottom: "1px solid rgba(255,255,255,0.08)",

      }}

    >

      <Toolbar

        sx={{

          gap: { xs: 1, md: 1.5 },

          minHeight: { xs: 56, sm: 64 },

          flexWrap: { xs: "wrap", lg: "nowrap" },

          py: { xs: 0.5, sm: 0 },

        }}

      >

        {isMobile && onMenuClick && (
          <IconButton color="inherit" edge="start" onClick={onMenuClick} aria-label="Mở menu">
            <MenuIcon />
          </IconButton>
        )}

        <Typography
          component={RouterLink}
          to="/"
          variant="subtitle1"
          noWrap
          sx={{
            fontWeight: 900,
            flexShrink: 0,
            display: { xs: "none", sm: "block" },
            fontSize: { sm: 15, md: 16 },
            color: "inherit",
            textDecoration: "none",
            "&:hover": { opacity: 0.92 },
          }}
        >
          Pickleball Scheduler Pro
        </Typography>

        {isMobile && (
          <Typography
            variant="caption"
            sx={{
              display: { xs: "block", sm: "none" },
              fontWeight: 700,
              color: "rgba(255,255,255,0.86)",
              ml: 0.25,
            }}
          >
            {opsMeta.isLive ? "LIVE" : "Sẵn sàng"}
          </Typography>
        )}



        <Stack

          direction="row"

          spacing={0.75}

          sx={{

            ml: { xs: 0, sm: 1 },

            alignItems: "center",

            flexWrap: "wrap",

            flex: 1,

            minWidth: 0,

          }}

        >

          {!isMobile && <TenantSwitcher />}
          {!isMobile && <VenueSwitcher />}
          <ClubSwitcher />
          {!isMobile && <SeasonLeagueSwitcher />}
          {!isMobile && <TenantBadge />}
          {!isMobile && <GlobalSearch />}

        </Stack>



        <Stack

          direction="row"

          spacing={0.5}

          alignItems="center"

          sx={{

            flexWrap: "wrap",

            justifyContent: { xs: "flex-start", lg: "flex-end" },

            width: { xs: "100%", lg: "auto" },

          }}

        >

          <CommandChip

            label={activeSeason?.name || "Mùa hiện tại"}

            hideOnMobile

          />

          <CommandChip

            label={activeLeague?.name || "Giao lưu"}

            hideOnMobile

          />

          {opsMeta.isLive && <CommandChip label="LIVE" pulse />}

          <CommandChip

            label={`${opsMeta.playerCount} người`}

            hideOnMobile

          />

          <CommandChip

            label={`${opsMeta.courtCount} sân`}

            hideOnMobile

          />

          {opsMeta.checkedInToday > 0 && (

            <CommandChip

              label={`${opsMeta.checkedInToday} check-in`}

              hideOnMobile

            />

          )}

          <IconButton
            color="inherit"
            aria-label="Thông báo workflow"
            onClick={handleNotificationOpen}
            sx={{
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              p: 0.75,
              ml: 0.25,
            }}
          >
            <Badge badgeContent={unreadNotificationCount} color="error" max={99} invisible={unreadNotificationCount === 0}>
              <NotificationsIcon fontSize="small" />
            </Badge>
          </IconButton>

          <Menu
            anchorEl={notificationAnchorEl}
            open={Boolean(notificationAnchorEl)}
            onClose={handleNotificationClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 320,
                  maxWidth: 360,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Workflow notifications
                </Typography>
                <Chip size="small" label={`${unreadNotificationCount} unread`} color={unreadNotificationCount > 0 ? "primary" : "default"} variant="outlined" />
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
                      bgcolor: isUnread ? "primary.50" : "transparent",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
                        {notification.title || "Workflow notification"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                        {notification.body || notification.detail || "No details"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notification.created_at || notification.createdAt || new Date().toISOString()).toLocaleString("vi-VN")}
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

          <Chip

            size="small"

            icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}

            label="AI Ready"

            sx={{

              height: 26,

              fontWeight: 800,

              fontSize: 12,

              bgcolor: "rgba(255,255,255,0.15)",

              color: "#fff",

              "& .MuiChip-icon": { color: "#a5f3fc" },

            }}

          />

          {(authProductionEnabled || rbacEnabled) && isAuthenticated && user && (

            <Chip

              size="small"

              label={user.displayName || ROLE_LABELS[user.role] || user.role}

              sx={{

                height: 26,

                fontWeight: 700,

                fontSize: 11,

                bgcolor: "rgba(255,255,255,0.22)",

                color: "#fff",

                maxWidth: { xs: 100, sm: 160 },

              }}

            />

          )}

          {(authProductionEnabled || rbacEnabled) && isAuthenticated && (
            <>
              <Button
                component={RouterLink}
                to="/profile"
                size="small"
                color="inherit"
                sx={{ minWidth: 0, fontSize: 11, fontWeight: 700, px: 1 }}
              >
                Hồ sơ
              </Button>
              {can(PERMISSIONS.USER_MANAGE) && (
                <Button
                  component={RouterLink}
                  to="/users"
                  size="small"
                  color="inherit"
                  sx={{ minWidth: 0, fontSize: 11, fontWeight: 700, px: 1 }}
                >
                  Người dùng
                </Button>
              )}
              <Button
                size="small"
                color="inherit"
                onClick={() => signOut()}
                sx={{ minWidth: 0, fontSize: 11, fontWeight: 700, px: 1 }}
              >
                Đăng xuất
              </Button>
            </>
          )}

        </Stack>

      </Toolbar>

    </AppBar>

  );

}


